// Government Integration Layer.
// Abstraction supporting OFFICIAL_API / FILE_EXCHANGE / PORTAL_HANDOFF /
// MANUAL_STATUS. For the prototype we ship a clearly-labelled MOCK gateway:
// "Prototype Simulation — Not a Live Government Connection".
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, MutationCtx } from "./_generated/server";
import { ApprovalError, insertApplicationEvent, recordAudit, requireRole } from "./lib/authz";
import { computeSla, getWorkingCalendar } from "./lib/workdays";
import { ROLES } from "./schema";
import { isUsableRule } from "./lib/engine";

type GatewayStatusLike =
  | "RECEIVED"
  | "UNDER_REVIEW"
  | "QUERY_RAISED"
  | "INSPECTION_REQUIRED"
  | "APPROVED"
  | "REJECTED";

export function generateGovernmentRefId(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MH-GATE-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

/** Deterministic mock sync — derives the gateway status from app state. */
export function deriveGatewayStatus(status: string): GatewayStatusLike {
  switch (status) {
    case "SUBMITTED":
    case "READY_FOR_SUBMISSION":
      return "RECEIVED";
    case "UNDER_REVIEW":
    case "RESUBMITTED":
      return "UNDER_REVIEW";
    case "QUERY_RAISED":
    case "WAITING_FOR_APPLICANT":
      return "QUERY_RAISED";
    case "INSPECTION_REQUIRED":
    case "INSPECTION_SCHEDULED":
      return "INSPECTION_REQUIRED";
    case "DECISION_PENDING":
      return "UNDER_REVIEW";
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
      return "REJECTED";
    default:
      return "RECEIVED";
  }
}

/** Server-side readiness gates before submission. */
export async function assertSubmitReady(ctx: MutationCtx, applicationId: Id<"applications">) {
  const app = await ctx.db.get(applicationId);
  if (!app) throw new ApprovalError("Application not found.", "NOT_FOUND");
  if (app.status !== "READY_FOR_SUBMISSION")
    throw new ApprovalError("Application must be marked ready before submission.", "INVALID_STATE");

  const org = await ctx.db.get(app.organizationId);
  const profile = await ctx.db.get(app.businessProfileId);
  const rules = await ctx.db.query("regulatoryRules").collect();
  const rule =
    rules
      .filter((r) => r.ruleId === app.ruleId && isUsableRule(r))
      .sort((a, b) => b.version - a.version)[0] ?? null;
  if (!org || !profile || !rule)
    throw new ApprovalError("Application configuration is incomplete.", "VALIDATION");

  const docs = await ctx.db
    .query("documents")
    .withIndex("by_organization", (q) => q.eq("organizationId", app.organizationId))
    .collect();
  for (const key of rule.requiredDocuments) {
    const ok = docs.some(
      (d) =>
        d.status === "ACTIVE" &&
        d.documentType === key &&
        d.fieldsConfirmed &&
        d.validationStatus === "PASSED",
    );
    if (!ok)
      throw new ApprovalError(
        `"${key}" must be uploaded, confirmed and validated before submission.`,
        "NOT_READY",
      );
  }
  return { app, org, profile, rule, docs };
}

/** Submit an application through the prototype government gateway. */
export const submitApplication = mutation({
  args: { applicationId: v.id("applications") },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.APPLICANT]);
    const { app, org, profile, rule, docs } = await assertSubmitReady(ctx, args.applicationId);

    const existing = await ctx.db
      .query("governmentSubmissions")
      .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
      .first();
    if (existing)
      throw new ApprovalError("This application was already submitted to the gateway.", "ALREADY_SUBMITTED");

    const now = Date.now();
    const govRef = generateGovernmentRefId();

    // Create the gateway submission record (MOCK mode, simulation).
    const manifest = {
      protocol: "APPROVALARC-MOCK-GATEWAY/1.0",
      receivedAt: new Date(now).toISOString(),
      applicationId: app._id,
      ruleId: rule.ruleId,
      authority: app.authority,
      applicant: { organizationId: app.organizationId, name: org.name },
      profile: {
        state: profile.state,
        district: profile.district,
        sector: profile.sector,
        projectType: profile.projectType,
      },
      documents: docs.filter((d) => d.status === "ACTIVE").map((d) => ({
        documentId: d._id,
        type: d.documentType,
        fileName: d.fileName,
        sha256: d.sha256,
        validationStatus: d.validationStatus,
        verificationStatus: d.verificationStatus,
      })),
      acknowledgement: "RECEIVED_FOR_DEPARTMENT_REVIEW",
    };

    await ctx.db.insert("governmentSubmissions", {
      applicationId: args.applicationId,
      governmentRefId: govRef,
      gatewayMode: "MOCK",
      status: "RECEIVED",
      submittedAt: now,
      lastSyncAt: now,
      rawResponse: JSON.stringify(manifest),
      isSimulation: true,
    } as never);

    await ctx.db.patch(app._id, {
      submittedAt: now,
      governmentRefId: govRef,
      status: "SUBMITTED",
    } as never);

    await insertApplicationEvent(ctx, {
      applicationId: args.applicationId,
      eventType: "APPLICATION_SUBMITTED",
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Applicant",
      from: "READY_FOR_SUBMISSION",
      to: "SUBMITTED",
      detail: `Submitted via prototype government gateway. Reference: ${govRef}`,
      occurredAt: now,
    });

    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "APPLICATION_SUBMITTED",
      entityType: "applications",
      entityId: app._id,
      previousValue: "READY_FOR_SUBMISSION",
      newValue: "SUBMITTED",
      detail: govRef,
    });

    // SLA clock starts at submission.
    await recomputeSlaFor(ctx, app._id, now);
    return { governmentRefId: govRef, submittedAt: now };
  },
});

export async function updateGatewayStatus(
  ctx: MutationCtx,
  applicationId: Id<"applications">,
  status: GatewayStatusLike,
  note?: string,
) {
  const sub = await ctx.db
    .query("governmentSubmissions")
    .withIndex("by_application", (q) => q.eq("applicationId", applicationId))
    .first();
  if (!sub) return;
  await ctx.db.patch(sub._id, {
    status,
    lastSyncAt: Date.now(),
    rawResponse: `MOCK_GATEWAY: ${status}${note ? ` — ${note}` : ""}`,
  } as never);
}

async function recomputeSlaFor(ctx: MutationCtx, appId: Id<"applications">, now: number) {
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
    status: result.status === "NOT_STARTED" ? "ON_TRACK" : result.status,
    computedAt: now,
    note: cal.name,
  } as never);
  await ctx.db.patch(appId, {
    lastSlaStatus: result.status === "NOT_STARTED" ? "ON_TRACK" : result.status,
  } as never);
}

export type { GatewayStatusLike, Doc };