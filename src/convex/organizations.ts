// Business profiles + deterministic rule evaluation per organization.
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { recordAudit, requireRole, requireUser, WriterCtx, ReaderCtx, ApprovalError } from "./lib/authz";
import { evaluateAllRules, hasConfiguredRules, isUsableRule } from "./lib/engine";
import { ROLES } from "./schema";
import { DISTRICTS, STATES, SECTORS, PROJECT_TYPES, PROJECT_STAGES, OPERATIONAL_CONDITIONS, BUSINESS_TYPES, normalize } from "./lib/config";
import { DEMO_RULES } from "./seed/rules";

export const myOrganization = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const user = await requireUser(ctx);
    if (user.role !== ROLES.APPLICANT) return null;
    if (!user.organizationId) return null;
    const org = await ctx.db.get(user.organizationId);
    const profile = await ctx.db
      .query("businessProfiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", user.organizationId!))
      .first();
    return { user, organization: org, profile: profile ?? null };
  },
});

export const hasVerifiedRules = query({
  args: { state: v.string(), sector: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    const rules = await ctx.db.query("regulatoryRules").collect();
    return hasConfiguredRules(rules, args.state, args.sector);
  },
});

export const evalsForOrganization = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const user = await requireUser(ctx);
    if (user.role !== ROLES.APPLICANT || !user.organizationId) return { profile: null, evals: [], configured: false };
    const profile = await ctx.db
      .query("businessProfiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", user.organizationId!))
      .first();
    let evals = await ctx.db
      .query("approvalEvals")
      .withIndex("by_organization", (q) => q.eq("organizationId", user.organizationId!))
      .collect();
    if (profile && evals.length === 0) {
      const live = evaluateAllRules(await ctx.db.query("regulatoryRules").collect(), toProfileLike(profile));
      evals = live.map((ev) => ({
        _id: `live-${ev.rule.ruleId}` as never,
        _creationTime: Date.now(),
        organizationId: user.organizationId!,
        businessProfileId: profile._id,
        ruleId: ev.rule.ruleId,
        ruleVersion: ev.rule.version,
        title: ev.rule.title,
        authority: ev.rule.officialAuthority,
        status: ev.status,
        triggers: ev.triggers.map((t) => ({ field: t.field, op: t.op, value: t.value ?? null, matched: t.matched })),
        reason: ev.reason,
        evaluatedAt: Date.now(),
      })) as typeof evals;
    }
    return { profile: profile ?? null, evals, configured: profile ? hasConfiguredRules(await ctx.db.query("regulatoryRules").collect(), profile.state, profile.sector) : false };
  },
});

export async function recomputeEvals(ctx: WriterCtx, organizationId: Id<"organizations">, profile: Doc<"businessProfiles">) {
  const old = await ctx.db
    .query("approvalEvals")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();
  for (const e of old) await ctx.db.delete(e._id);

  const rules = await ctx.db.query("regulatoryRules").collect();
  const evals = evaluateAllRules(rules, toProfileLike(profile));
  const evaluatedAt = Date.now();
  for (const ev of evals) {
    await ctx.db.insert("approvalEvals", {
      organizationId,
      businessProfileId: profile._id,
      ruleId: ev.rule.ruleId,
      ruleVersion: ev.rule.version,
      title: ev.rule.title,
      authority: ev.rule.officialAuthority,
      status: ev.status,
      triggers: ev.triggers.map((t) => ({ field: t.field, op: t.op, value: t.value ?? null, matched: t.matched })),
      reason: ev.reason,
      evaluatedAt,
    } as never);
  }
  return evals.length;
}

export function toProfileLike(p: Doc<"businessProfiles">) {
  return {
    state: p.state,
    district: p.district,
    sector: p.sector,
    projectType: p.projectType,
    projectStage: p.projectStage,
    investment: p.investment,
    employeeCount: p.employeeCount,
    businessType: p.businessType,
    operationalConditions: p.operationalConditions,
  };
}

async function ensureRuleCatalog(ctx: MutationCtx) {
  const existingRules = await ctx.db.query("regulatoryRules").collect();
  if (existingRules.length > 0) {
    const now = Date.now();
    for (const rule of existingRules) {
      if (!isUsableRule(rule)) {
        await ctx.db.patch(rule._id, {
          jurisdiction: rule.jurisdiction || rule.state,
          verificationStatus: "ACTIVE",
          reviewer: rule.reviewer || "ApprovalArc prototype reviewer",
          lastVerified: rule.lastVerified || now,
          changeHistory: rule.changeHistory?.length
            ? rule.changeHistory
            : [{ at: now, actor: "ApprovalArc system", note: "Activated local prototype rule." }],
        } as never);
      }
    }
    return;
  }

  const now = Date.now();
  for (const rule of DEMO_RULES) {
    await ctx.db.insert("regulatoryRules", {
      ...rule,
      jurisdiction: rule.state,
      verificationStatus: "ACTIVE",
      reviewer: "ApprovalArc prototype reviewer",
      lastVerified: now,
      changeHistory: [
        {
          at: now,
          actor: "ApprovalArc system",
          note: "Initialized from the local prototype rule catalog.",
        },
      ],
    } as never);
  }
}

export const saveBusinessProfile = mutation({
  args: {
    businessName: v.string(),
    businessType: v.string(),
    sector: v.string(),
    state: v.string(),
    district: v.string(),
    projectType: v.string(),
    projectStage: v.string(),
    investment: v.number(),
    employeeCount: v.number(),
    premisesOwnership: v.optional(v.string()),
    landArea: v.optional(v.string()),
    operationalConditions: v.array(v.string()),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.APPLICANT, ROLES.ADMIN]);

    // A custom account must not depend on demo login having run first.
    await ensureRuleCatalog(ctx);

    // ---- server-side input validation ----
    if (args.businessName.trim().length < 3)
      throw new ApprovalError("Business name must be at least 3 characters.", "VALIDATION");
    if (!STATES.includes(args.state as (typeof STATES)[number]))
      throw new ApprovalError("This state is not supported by the demo configuration.", "VALIDATION");
    if (!(args.district && (DISTRICTS[args.state] ?? []).includes(args.district)))
      throw new ApprovalError("Select a valid district for the chosen state.", "VALIDATION");
    if (!SECTORS.includes(args.sector as (typeof SECTORS)[number]))
      throw new ApprovalError("Select a valid sector.", "VALIDATION");
    if (!PROJECT_TYPES.includes(args.projectType as (typeof PROJECT_TYPES)[number]))
      throw new ApprovalError("Select a valid project type.", "VALIDATION");
    if (!PROJECT_STAGES.includes(args.projectStage as (typeof PROJECT_STAGES)[number]))
      throw new ApprovalError("Select a valid project stage.", "VALIDATION");
    if (args.investment < 0 || args.investment > 100000)
      throw new ApprovalError("Investment must be between ₹0 and ₹100,000 lakh.", "VALIDATION");
    if (args.employeeCount < 1 || args.employeeCount > 100000)
      throw new ApprovalError("Employee count must be between 1 and 100,000.", "VALIDATION");
    for (const c of args.operationalConditions) {
      if (!OPERATIONAL_CONDITIONS.includes(c as (typeof OPERATIONAL_CONDITIONS)[number]))
        throw new ApprovalError("Unknown operational condition.", "VALIDATION");
    }
    if (!BUSINESS_TYPES.includes(args.businessType))
      throw new ApprovalError("Select a valid business type.", "VALIDATION");

    // ---- organization (upsert) ----
    let org = user.organizationId ? await ctx.db.get(user.organizationId) : null;
    const previous = org ? { name: org.name, address: org.address } : null;
    if (user.role === ROLES.ADMIN) {
      // Admin edits require an org to exist; treat as profile edit only.
      org = null;
    }
    if (!org) {
      const orgId = await ctx.db.insert("organizations", {
        name: args.businessName,
        ownerId: user._id,
        contactName: args.contactName,
        contactEmail: args.contactEmail,
        contactPhone: args.contactPhone,
        address: args.address,
      } as never);
      await ctx.db.patch(user._id, { organizationId: orgId } as never);
      org = (await ctx.db.get(orgId)) as Doc<"organizations">;
      await recordAudit(ctx, {
        actorId: user._id,
        actorName: user.name ?? user.email ?? "Unknown",
        actorRole: user.role ?? "",
        action: "ORGANIZATION_CREATED",
        entityType: "organizations",
        entityId: orgId,
        newValue: { name: org.name },
        detail: args.businessName,
      });
    } else {
      await ctx.db.patch(org._id, {
        name: args.businessName,
        contactName: args.contactName,
        contactEmail: args.contactEmail,
        contactPhone: args.contactPhone,
        address: args.address,
      } as never);
      await recordAudit(ctx, {
        actorId: user._id,
        actorName: user.name ?? user.email ?? "Unknown",
        actorRole: user.role ?? "",
        action: "ORGANIZATION_UPDATED",
        entityType: "organizations",
        entityId: org._id,
        previousValue: previous,
        newValue: { name: args.businessName, address: args.address },
      });
    }

    // ---- business profile (upsert) ----
    const existing = await ctx.db
      .query("businessProfiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", org!._id))
      .first();
    let profile: Doc<"businessProfiles">;
    if (existing) {
      await ctx.db.patch(existing._id, {
        businessType: args.businessType,
        sector: args.sector,
        state: args.state,
        district: args.district,
        projectType: args.projectType,
        projectStage: args.projectStage,
        investment: args.investment,
        employeeCount: args.employeeCount,
        premisesOwnership: args.premisesOwnership,
        landArea: args.landArea,
        operationalConditions: args.operationalConditions,
      } as never);
      profile = (await ctx.db.get(existing._id)) as Doc<"businessProfiles">;
      await recordAudit(ctx, {
        actorId: user._id,
        actorName: user.name ?? user.email ?? "Unknown",
        actorRole: user.role ?? "",
        action: "BUSINESS_PROFILE_UPDATED",
        entityType: "businessProfiles",
        entityId: profile._id,
        previousValue: { sector: existing.sector, state: existing.state },
        newValue: { sector: args.sector, state: args.state, district: args.district },
      });
    } else {
      const pid = await ctx.db.insert("businessProfiles", {
        organizationId: org!._id,
        businessType: args.businessType,
        sector: args.sector,
        state: args.state,
        district: args.district,
        projectType: args.projectType,
        projectStage: args.projectStage,
        investment: args.investment,
        employeeCount: args.employeeCount,
        premisesOwnership: args.premisesOwnership,
        landArea: args.landArea,
        operationalConditions: args.operationalConditions,
      } as never);
      profile = (await ctx.db.get(pid)) as Doc<"businessProfiles">;
      await recordAudit(ctx, {
        actorId: user._id,
        actorName: user.name ?? user.email ?? "Unknown",
        actorRole: user.role ?? "",
        action: "BUSINESS_PROFILE_CREATED",
        entityType: "businessProfiles",
        entityId: pid,
        newValue: { sector: args.sector, state: args.state },
      });
    }

    // ---- deterministic re-evaluation ----
    const configured = hasConfiguredRules(
      await ctx.db.query("regulatoryRules").collect(),
      args.state,
      args.sector,
    );
    if (configured) {
      const count = await recomputeEvals(ctx, org!._id, profile);
      await recordAudit(ctx, {
        actorId: user._id,
        actorName: user.name ?? user.email ?? "Unknown",
        actorRole: user.role ?? "",
        action: "RULE_EVALUATION_RUN",
        entityType: "approvalEvals",
        entityId: org!._id,
        detail: `${count} rules evaluated deterministically for ${args.state} / ${args.sector}.`,
      });
    }
    return { orgId: org!._id, profileId: profile._id, configured, count: undefined as number | undefined };
  },
});

// Get rule docs (for journey UI). Filtered by status ACTIVE for public read.
export const getRuleAt = query({
  args: { ruleId: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    const active = (await ctx.db.query("regulatoryRules").collect()).filter(
      (rule) => isUsableRule(rule),
    );
    const byId: Record<string, Doc<"regulatoryRules">[]> = {};
    for (const r of active) {
      (byId[r.ruleId] ??= []).push(r);
    }
    const versions = byId[args.ruleId] ?? [];
    versions.sort((a, b) => a.version - b.version);
    return versions[versions.length - 1] ?? null;
  },
});

export const normalizeName = normalize;

/** ACTIVE rules matching a state + sector (for the journey dependency graph). */
export const rulesForProfile = query({
  args: { state: v.string(), sector: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    await requireUser(ctx);
    const rules = await ctx.db.query("regulatoryRules").collect();
    return rules.filter(
      (r) => isUsableRule(r) && r.state === args.state && r.sector === args.sector,
    );
  },
});