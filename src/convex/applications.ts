// Application workflow: a real state machine with configured transitions,
// applyStatusChange transitions are validated, every transition is audited,
// SLA is recomputed and persisted, and applicant-visible events are recorded.
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import {
  ApprovalError,
  insertApplicationEvent,
  notify,
  ReaderCtx,
  recordAudit,
  requireRole,
  requireUser,
  WriterCtx,
} from "./lib/authz";
import { computeSla, getWorkingCalendar } from "./lib/workdays";
import { computeReadiness } from "./lib/readiness";
import { evaluateRule, isUsableRule } from "./lib/engine";
import { toProfileLike } from "./organizations";
import { generateComplianceForApprovedApp } from "./compliance";
import { AppStatus, ROLES } from "./schema";

export type TransitionOpts = {
  actor: Doc<"users">;
  to: AppStatus;
  eventType: string;
  detail?: string;
  internalNote?: string;
  occurredAt?: number;
  visibility?: "APPLICANT_VISIBLE" | "INTERNAL_ONLY";
  gatewaySync?: GatewayStatusLike;
};

export const WORKFLOW: Record<AppStatus, AppStatus[]> = {
  DRAFT: ["READY_FOR_SUBMISSION", "REJECTED"],
  READY_FOR_SUBMISSION: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW", "QUERY_RAISED", "WAITING_FOR_APPLICANT", "INSPECTION_REQUIRED"],
  UNDER_REVIEW: ["DECISION_PENDING", "QUERY_RAISED", "WAITING_FOR_APPLICANT", "INSPECTION_REQUIRED", "REJECTED"],
  QUERY_RAISED: ["RESUBMITTED", "UNDER_REVIEW"],
  WAITING_FOR_APPLICANT: ["RESUBMITTED", "UNDER_REVIEW"],
  RESUBMITTED: ["UNDER_REVIEW", "QUERY_RAISED", "INSPECTION_REQUIRED", "DECISION_PENDING"],
  INSPECTION_REQUIRED: ["INSPECTION_SCHEDULED", "DECISION_PENDING"],
  INSPECTION_SCHEDULED: ["DECISION_PENDING", "INSPECTION_REQUIRED"],
  DECISION_PENDING: ["APPROVED", "REJECTED", "INSPECTION_REQUIRED"],
  APPROVED: ["REJECTED"],
  REJECTED: [],
};

export type GatewayStatusLike = "RECEIVED" | "UNDER_REVIEW" | "QUERY_RAISED" | "INSPECTION_REQUIRED" | "APPROVED" | "REJECTED";

/** Map a rule authority to the department console that handles it. */
export function departmentFor(rule: Doc<"regulatoryRules">): string {
  const a = rule.officialAuthority.toLowerCase();
  if (a.includes("pollution")) return "Maharashtra Pollution Control Board";
  if (a.includes("safety and health") || a.includes("boiler") || a.includes("electrical"))
    return "Industries & Commerce";
  if (a.includes("fssai")) return "FSSAI";
  if (a.includes("fire")) return "Fire Services";
  if (a.includes("municipal") || a.includes("pmc")) return "Municipal Administration";
  if (a.includes("groundwater") || a.includes("metrology")) return "Industries & Commerce";
  return "Industries & Commerce";
}

async function getActiveRule(ctx: ReaderCtx, ruleId: string): Promise<Doc<"regulatoryRules">> {
  const rules = await ctx.db.query("regulatoryRules").collect();
  const versions = rules.filter(
    (r) => r.ruleId === ruleId && isUsableRule(r),
  );
  if (versions.length === 0) throw new ApprovalError(`No active verified rule for ${ruleId}.`, "NO_RULE");
  versions.sort((a, b) => b.version - a.version);
  return versions[0];
}

async function getOrgProfile(
  ctx: ReaderCtx,
  orgId: Id<"organizations">,
): Promise<{ profile: Doc<"businessProfiles">; org: Doc<"organizations"> }> {
  const profile = await ctx.db
    .query("businessProfiles")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .first();
  const org = await ctx.db.get(orgId);
  if (!profile || !org) throw new ApprovalError("Complete your business profile first.", "NO_PROFILE");
  return { profile, org };
}

/** Apply a validated transition + SLA recompute + pause/resume + persistence. */
export async function applyStatusChange(ctx: WriterCtx, appId: Id<"applications">, opts: TransitionOpts) {
  const app = await ctx.db.get(appId);
  if (!app) throw new ApprovalError("Application not found.", "NOT_FOUND");
  const allowed = WORKFLOW[app.status] ?? [];
  if (!allowed.includes(opts.to))
    throw new ApprovalError(
      `Invalid workflow transition: ${app.status} → ${opts.to} is not a configured transition.`,
      "INVALID_TRANSITION",
    );

  const now = opts.occurredAt ?? Date.now();
  const patch: Record<string, unknown> = { status: opts.to };

  // Pause management: entering pause states starts the clock stop; leaving ends it.
  const PAUSES: AppStatus[] = ["QUERY_RAISED", "WAITING_FOR_APPLICANT"];
  const nowPaused = PAUSES.includes(app.status);
  const nextPaused = PAUSES.includes(opts.to);

  if (!nowPaused && nextPaused) {
    patch.pauseStart = now;
  } else if (nowPaused && !nextPaused) {
    const intervals = [...app.pauseIntervals];
    const start = app.pauseStart ?? now;
    intervals.push({ start, end: now });
    patch.pauseIntervals = intervals;
    patch.pauseStart = undefined;
    patch.applicantWaitMs = app.applicantWaitMs + (now - start);
  } else if (nowPaused && nextPaused) {
    // stays paused (e.g. query → waiting); keep the same interval running.
  }

  if (opts.gatewaySync === "APPROVED") patch.decisionAt = now;
  await ctx.db.patch(appId, patch as never);

  await insertApplicationEvent(ctx, {
    applicationId: appId,
    eventType: opts.eventType,
    actorId: opts.actor._id,
    actorName: opts.actor.name ?? opts.actor.email ?? "System",
    from: app.status,
    to: opts.to,
    detail: opts.detail,
    occurredAt: now,
    visibility: opts.visibility ?? "APPLICANT_VISIBLE",
  });

  if (opts.internalNote) {
    await ctx.db.patch(appId, { internalNote: opts.internalNote } as never);
  }

  await recordAudit(ctx, {
    actorId: opts.actor._id,
    actorName: opts.actor.name ?? opts.actor.email ?? "Unknown",
    actorRole: opts.actor.role ?? "",
    action: "APPLICATION_STATUS_CHANGED",
    entityType: "applications",
    entityId: appId,
    previousValue: app.status,
    newValue: opts.to,
    detail: opts.detail,
    context: opts.eventType,
    occurredAt: now,
  });

  await recomputeAndPersistSla(ctx, appId, now, opts.actor);
}

/** Recompute SLA (working-day aware), persist a record, notify on risk/breach. */
export async function recomputeAndPersistSla(
  ctx: WriterCtx,
  appId: Id<"applications">,
  now: number,
  actor: Doc<"users">,
) {
  const app = await ctx.db.get(appId);
  if (!app || !app.submittedAt) return;
  const profile = await ctx.db
    .query("businessProfiles")
    .withIndex("by_organization", (q) => q.eq("organizationId", app.organizationId))
    .first();
  const cal = await getWorkingCalendar(ctx, profile?.state ?? "Maharashtra");
  const result = await computeSla(ctx, app, profile?.state ?? "Maharashtra");
  await ctx.db.insert("slaRecords", {
    applicationId: appId,
    appliedRuleDays: result.slaWorkingDays,
    grossElapsedMs: result.grossElapsedMs,
    officialElapsedMs: result.officialElapsedMs,
    applicantWaitMs: result.applicantWaitMs,
    remainingMs: result.remainingWorkingDays * 24 * 60 * 60 * 1000,
    status: result.status === "NOT_STARTED" ? "ON_TRACK" : (result.status as (typeof SLA_STATUSES)[number]),
    computedAt: now,
    note: cal.name,
  } as never);

  const s = result.status === "NOT_STARTED" ? "ON_TRACK" : result.status;
  const prev = app.lastSlaStatus;
  if ((s === "AT_RISK" || s === "BREACHED") && prev !== s) {
    const org = await ctx.db.get(app.organizationId);
    const owner = org ? await ctx.db.get(org.ownerId) : null;
    if (owner && s === "AT_RISK") {
      await notify(ctx, {
        userId: owner._id,
        title: "SLA at risk",
        message: `Your application "${app.approvalTitle}" is at risk of breaching its ${app.slaWorkingDays}-working-day SLA.`,
        type: "SLA",
        link: `/applicant/applications/${appId}`,
      });
    }
    if (owner && s === "BREACHED") {
      await notify(ctx, {
        userId: owner._id,
        title: "SLA breached",
        message: `Application "${app.approvalTitle}" has breached its configured processing period. A department supervisor has been alerted.`,
        type: "SLA",
        link: `/applicant/applications/${appId}`,
      });
    }
    await notify(ctx, {
      userId: actor._id,
      title: s === "AT_RISK" ? "SLA at risk" : "SLA breached — supervisor alert",
      message:
        s === "AT_RISK"
          ? `Application "${app.approvalTitle}" is at risk of breaching its working-day SLA.`
          : `Application "${app.approvalTitle}" breached its working-day SLA. Escalate per department process.`,
      type: "SLA",
      link: `/department/applications/${appId}`,
    });
  }
  await ctx.db.patch(appId, { lastSlaStatus: s } as never);
}

// ---------------------------------------------------------------------------
// Applicant mutations
// ---------------------------------------------------------------------------

export const createApplication = mutation({
  args: { ruleId: v.string() },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.APPLICANT]);
    const orgId = user.organizationId;
    if (!orgId) throw new ApprovalError("Complete your business profile first.", "NO_PROFILE");
    const { profile, org } = await getOrgProfile(ctx, orgId);

    const rule = await getActiveRule(ctx, args.ruleId);
    const ev = evaluateRule(rule, toProfileLike(profile));
    if (ev.status === "NOT_APPLICABLE")
      throw new ApprovalError("This approval is not applicable to your current business profile.", "NOT_APPLICABLE");

    const existing = await ctx.db
      .query("applications")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();
    const live = existing.find(
      (a) => a.ruleId === args.ruleId && !["APPROVED", "REJECTED"].includes(a.status),
    );
    if (live)
      throw new ApprovalError("An active application for this approval already exists.", "DUPLICATE_APPLICATION");

    const department = departmentFor(rule);
    const appId = await ctx.db.insert("applications", {
      organizationId: orgId,
      businessProfileId: profile._id,
      ruleId: rule.ruleId,
      approvalTitle: rule.title,
      authority: rule.officialAuthority,
      department,
      status: "DRAFT",
      slaWorkingDays: rule.slaWorkingDays,
      pauseIntervals: [],
      applicantWaitMs: 0,
    } as never);

    const now = Date.now();
    await insertApplicationEvent(ctx, {
      applicationId: appId,
      eventType: "APPLICATION_CREATED",
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Applicant",
      to: "DRAFT",
      detail: `Created draft for ${rule.title}`,
      occurredAt: now,
    });
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "APPLICATION_CREATED",
      entityType: "applications",
      entityId: appId,
      newValue: { ruleId: args.ruleId, title: rule.title },
    });
    return { appId, department };
  },
});

export const markReadyForSubmission = mutation({
  args: { applicationId: v.id("applications") },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.APPLICANT]);
    const app = await ctx.db.get(args.applicationId);
    if (!app || app.organizationId !== user.organizationId)
      throw new ApprovalError("Application not found.", "NOT_FOUND");
    await applyStatusChange(ctx, args.applicationId, {
      actor: user,
      to: "READY_FOR_SUBMISSION",
      eventType: "APPLICATION_MARKED_READY",
      detail: "Applicant marked the application as ready for submission.",
    });
    return { ok: true };
  },
});

export const withdrawApplication = mutation({
  args: { applicationId: v.id("applications") },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.APPLICANT]);
    const app = await ctx.db.get(args.applicationId);
    if (!app || app.organizationId !== user.organizationId)
      throw new ApprovalError("Application not found.", "NOT_FOUND");
    if (app.status === "APPROVED")
      throw new ApprovalError("An approved application cannot be withdrawn.", "INVALID_TRANSITION");
    await applyStatusChange(ctx, args.applicationId, {
      actor: user,
      to: "REJECTED",
      eventType: "APPLICATION_WITHDRAWN",
      detail: "Applicant withdrew the application.",
    });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Department mutations
// ---------------------------------------------------------------------------

function assertDept(user: Doc<"users">, app: Doc<"applications">) {
  if (user.role === ROLES.ADMIN) return;
  if (user.role === ROLES.DEPT_SUPERVISOR) return;
  if (user.role !== ROLES.DEPT_OFFICER) throw new ApprovalError("Forbidden.", "FORBIDDEN");
  if (user.department && app.department !== user.department)
    throw new ApprovalError("This application belongs to another department compartment.", "FORBIDDEN");
}

export const startReview = mutation({
  args: { applicationId: v.id("applications") },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.DEPT_OFFICER, ROLES.DEPT_SUPERVISOR, ROLES.ADMIN]);
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new ApprovalError("Application not found.", "NOT_FOUND");
    assertDept(user, app);
    await ctx.db.patch(app._id, { assignedOfficerId: user._id } as never);
    await applyStatusChange(ctx, args.applicationId, {
      actor: user,
      to: "UNDER_REVIEW",
      eventType: "REVIEW_STARTED",
      detail: `Review started by ${user.name ?? user.email ?? "officer"}.`,
    });
    return { ok: true };
  },
});

export const moveToDecisionPending = mutation({
  args: { applicationId: v.id("applications"), note: v.optional(v.string()) },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.DEPT_OFFICER, ROLES.DEPT_SUPERVISOR, ROLES.ADMIN]);
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new ApprovalError("Application not found.", "NOT_FOUND");
    assertDept(user, app);
    await applyStatusChange(ctx, args.applicationId, {
      actor: user,
      to: "DECISION_PENDING",
      eventType: "DECISION_PENDING",
      detail: args.note ?? "Moved to decision pending.",
    });
    return { ok: true };
  },
});

export const decideApplication = mutation({
  args: { applicationId: v.id("applications"), decision: v.union(v.literal("APPROVED"), v.literal("REJECTED")), reason: v.optional(v.string()) },
  handler: async (ctx: MutationCtx, args) => {
    // Approval/rejection requires supervisor (or admin).
    const user = await requireRole(ctx, [ROLES.DEPT_SUPERVISOR, ROLES.ADMIN]);
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new ApprovalError("Application not found.", "NOT_FOUND");
    assertDept(user, app);
    if (args.decision === "REJECTED" && !args.reason)
      throw new ApprovalError("A reason is required to reject an application.", "VALIDATION");
    const now = Date.now();
    await applyStatusChange(ctx, args.applicationId, {
      actor: user,
      to: args.decision,
      eventType: args.decision === "APPROVED" ? "APPLICATION_APPROVED" : "APPLICATION_REJECTED",
      detail: args.decision === "APPROVED" ? "Approved by department" : `Rejected: ${args.reason}`,
      occurredAt: now,
      visibility: "APPLICANT_VISIBLE",
    });
    await ctx.db.patch(app._id, {
      decisionAt: now,
      decisionBy: user._id,
    } as never);

    // On approval, generate post-approval compliance obligations from the rule.
    if (args.decision === "APPROVED") {
      const rule = await getActiveRule(ctx, app.ruleId).catch(() => null);
      if (rule) {
        await generateComplianceForApprovedApp(ctx, app, rule, now);
      }
    }

    // Gateway sync
    const sub = await ctx.db
      .query("governmentSubmissions")
      .withIndex("by_application", (q) => q.eq("applicationId", app._id))
      .first();
    if (sub) {
      await ctx.db.patch(sub._id, {
        status: args.decision === "APPROVED" ? "APPROVED" : "REJECTED",
        lastSyncAt: now,
      } as never);
    }
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "APPLICATION_DECISION",
      entityType: "applications",
      entityId: app._id,
      previousValue: "DECISION_PENDING",
      newValue: args.decision,
      detail: args.reason,
    });
    const org = await ctx.db.get(app.organizationId);
    const owner = org ? await ctx.db.get(org.ownerId) : null;
    if (owner) {
      await notify(ctx, {
        userId: owner._id,
        title: args.decision === "APPROVED" ? "Approval granted" : "Application rejected",
        message:
          args.decision === "APPROVED"
            ? `"${app.approvalTitle}" was approved by the competent authority.`
            : `"${app.approvalTitle}" was rejected. Reason: ${args.reason}.`,
        type: "DECISION",
        link: `/applicant/applications/${app._id}`,
      });
    }
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Queries (department read + writes for most reads)
// ---------------------------------------------------------------------------

export const listMyApplications = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const user = await requireUser(ctx);
    if (user.role !== ROLES.APPLICANT || !user.organizationId) return [];
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_organization", (q) => q.eq("organizationId", user.organizationId!))
      .collect();
    const profile = await ctx.db
      .query("businessProfiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", user.organizationId!))
      .first();
    const state = profile?.state ?? "Maharashtra";
    const cal = await ctx.db.query("workingCalendars").collect();
    const evals = await ctx.db
      .query("approvalEvals")
      .withIndex("by_organization", (q) => q.eq("organizationId", user.organizationId!))
      .collect();
    const out = [];
    for (const a of apps) {
      const sla = a.submittedAt ? await computeSla(ctx, a, state) : null;
      const evalInfo = evals.find((e) => e.ruleId === a.ruleId) ?? null;
      const docs = await ctx.db
        .query("documents")
        .withIndex("by_organization", (q) => q.eq("organizationId", user.organizationId!))
        .collect();
      const rule = await getActiveRule(ctx, a.ruleId).catch(() => null);
      const appDocs = docs.filter(
        (d) =>
          d.status === "ACTIVE" &&
          (d.applicationId === a._id ||
            (d.documentType && !!rule?.requiredDocuments.includes(d.documentType))),
      );
      out.push({
        ...a,
        sla,
        evalStatus: evalInfo?.status ?? null,
        documentCount: appDocs.length,
        requiredDocumentCount: 0,
        calendarName: cal[0]?.name ?? "",
      });
    }
    out.sort((x, y) => y._creationTime - x._creationTime);
    return out;
  },
});

export const listDepartmentApplications = query({
  args: { status: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx: QueryCtx, args) => {
    const user = await requireRole(ctx, [ROLES.DEPT_OFFICER, ROLES.DEPT_SUPERVISOR, ROLES.ADMIN]);
    const all = await ctx.db.query("applications").collect();
    let apps = all;
    if (user.role === ROLES.DEPT_OFFICER && user.department) {
      apps = apps.filter((a) => a.department === user.department);
    }
    if (args.status) apps = apps.filter((a) => a.status === args.status);
    apps.sort((a, b) => (b.submittedAt ?? b._creationTime) - (a.submittedAt ?? a._creationTime));
    const limit = args.limit ?? 200;
    apps = apps.slice(0, limit);

    const profiles = new Map<string, Doc<"businessProfiles"> | null>();
    const orgs = new Map<string, Doc<"organizations"> | null>();
    const out = [];
    for (const a of apps) {
      if (!profiles.has(a.businessProfileId)) {
        profiles.set(a.businessProfileId, (await ctx.db.get(a.businessProfileId)) ?? null);
      }
      if (!orgs.has(a.organizationId)) {
        orgs.set(a.organizationId, (await ctx.db.get(a.organizationId)) ?? null);
      }
      const profile = profiles.get(a.businessProfileId);
      const org = orgs.get(a.organizationId);
      const sla = a.submittedAt
        ? await computeSla(ctx, a, profile?.state ?? "Maharashtra")
        : null;
      out.push({
        ...a,
        sla,
        businessName: org?.name ?? "—",
        sector: profile?.sector ?? "—",
        district: profile?.district ?? "—",
      });
    }
    return out;
  },
});

export const departmentMetrics = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const user = await requireRole(ctx, [ROLES.DEPT_OFFICER, ROLES.DEPT_SUPERVISOR, ROLES.ADMIN]);
    const all = await ctx.db.query("applications").collect();
    let apps = all;
    if (user.role === ROLES.DEPT_OFFICER && user.department) {
      apps = apps.filter((a) => a.department === user.department);
    }
    const byStatus: Record<string, number> = {};
    let atRisk = 0;
    let breached = 0;
    const profiles = new Map<string, Doc<"businessProfiles"> | null>();
    for (const a of apps) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
      if (a.submittedAt) {
        if (!profiles.has(a.businessProfileId)) {
          profiles.set(a.businessProfileId, (await ctx.db.get(a.businessProfileId)) ?? null);
        }
        const sla = await computeSla(ctx, a, profiles.get(a.businessProfileId)?.state ?? "Maharashtra");
        if (sla.status === "AT_RISK") atRisk++;
        if (sla.status === "BREACHED") breached++;
      }
    }
    // Bottleneck detection from actual application records
    const inspectionWaiting = apps.filter(
      (a) => a.status === "INSPECTION_REQUIRED" || a.status === "INSPECTION_SCHEDULED",
    ).length;
    const queriesOpen = apps.filter((a) => ["QUERY_RAISED", "WAITING_FOR_APPLICANT"].includes(a.status)).length;
    const bottlenecks: { label: string; count: number; detail: string }[] = [];
    if (inspectionWaiting > 0)
      bottlenecks.push({
        label: "Inspection scheduling",
        count: inspectionWaiting,
        detail: "Applications waiting on inspection scheduling or completion.",
      });
    if (queriesOpen > 0)
      bottlenecks.push({
        label: "Awaiting applicant response",
        count: queriesOpen,
        detail: "Applications paused waiting for applicant responses.",
      });
    return {
      total: apps.length,
      byStatus,
      atRisk,
      breached,
      withSla: apps.filter((a) => a.status !== "DRAFT" && a.status !== "READY_FOR_SUBMISSION").length,
      bottlenecks,
      department: user.department ?? "All departments",
    };
  },
});

export const applicationDetail = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx: QueryCtx, args) => {
    const user = await requireUser(ctx);
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new ApprovalError("Application not found.", "NOT_FOUND");

    if (user.role === ROLES.APPLICANT && app.organizationId !== user.organizationId)
      throw new ApprovalError("Forbidden.", "FORBIDDEN");
    if ([ROLES.DEPT_OFFICER, ROLES.DEPT_SUPERVISOR].includes(user.role as never)) {
      if (user.role === ROLES.DEPT_OFFICER && user.department && app.department !== user.department)
        throw new ApprovalError("This application belongs to another department compartment.", "FORBIDDEN");
    }

    const org = await ctx.db.get(app.organizationId);
    const profile = await ctx.db.get(app.businessProfileId);
    const rule = await getActiveRule(ctx, app.ruleId).catch(() => null);
    const events = await ctx.db
      .query("applicationEvents")
      .withIndex("by_application", (q) => q.eq("applicationId", app._id))
      .collect();
    events.sort((a, b) => a.occurredAt - b.occurredAt);

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_application", (q) => q.eq("applicationId", app._id))
      .collect();
    const orgDocs = await ctx.db
      .query("documents")
      .withIndex("by_organization", (q) => q.eq("organizationId", app.organizationId))
      .collect();

    const queries = await ctx.db
      .query("queries")
      .withIndex("by_application", (q) => q.eq("applicationId", app._id))
      .collect();
    queries.sort((a, b) => b.raisedAt - a.raisedAt);
    const queryResponsesByQuery = new Map<string, Doc<"queryResponses">[]>();
    for (const q of queries) {
      const rs = await ctx.db
        .query("queryResponses")
        .withIndex("by_query", (qy) => qy.eq("queryId", q._id))
        .collect();
      queryResponsesByQuery.set(q._id, rs.sort((a, b) => a.respondedAt - b.respondedAt));
    }

    const inspections = await ctx.db
      .query("inspections")
      .withIndex("by_application", (q) => q.eq("applicationId", app._id))
      .collect();
    inspections.sort((a, b) => b.requestedAt - a.requestedAt);

    const submission = await ctx.db
      .query("governmentSubmissions")
      .withIndex("by_application", (q) => q.eq("applicationId", app._id))
      .first();

    const sla = app.submittedAt
      ? await computeSla(ctx, app, profile?.state ?? "Maharashtra")
      : null;

    const readiness =
      rule && profile && org
        ? await computeReadiness(ctx, app, rule, profile, org, orgDocs)
        : null;

    const evalInfo = await ctx.db
      .query("approvalEvals")
      .withIndex("by_organization", (q) => q.eq("organizationId", app.organizationId))
      .collect()
      .then((evals) => evals.find((e) => e.ruleId === app.ruleId) ?? null);

    return {
      application: app,
      organization: org,
      businessProfile: profile,
      rule,
      evalInfo,
      events,
      documents: docs,
      organizationDocuments: orgDocs,
      queries: queries.map((q) => ({ ...q, responses: queryResponsesByQuery.get(q._id) ?? [] })),
      inspections,
      governmentSubmission: submission,
      sla,
      readiness,
    };
  },
});

export const SLA_STATUSES = ["ON_TRACK", "AT_RISK", "BREACHED"] as const;