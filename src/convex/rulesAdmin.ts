// Regulatory rule administration (System Administrator / supervisor).
// Only ACTIVE verified rules affect applicability. Rule changes are versioned
// and every change is audited + appended to the rule's change history.
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { ApprovalError, recordAudit, requireRole } from "./lib/authz";
import { conditionValidator, ROLES } from "./schema";

export const listAllRules = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx: QueryCtx, args) => {
    await requireRole(ctx, [ROLES.ADMIN, ROLES.DEPT_SUPERVISOR, ROLES.DEPT_OFFICER]);
    const rules = await ctx.db.query("regulatoryRules").collect();
    rules.sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.version - b.version);
    return args.includeInactive ? rules : rules.filter((r) => r.verificationStatus === "ACTIVE");
  },
});

export const listRuleVersions = query({
  args: { ruleId: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    await requireRole(ctx, [ROLES.ADMIN, ROLES.DEPT_SUPERVISOR, ROLES.DEPT_OFFICER]);
    const rules = await ctx.db.query("regulatoryRules").collect();
    return rules.filter((r) => r.ruleId === args.ruleId).sort((a, b) => b.version - a.version);
  },
});

export const listSources = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    await requireRole(ctx, [ROLES.ADMIN, ROLES.DEPT_SUPERVISOR]);
    return await ctx.db.query("regulatorySources").collect();
  },
});

const ruleInput = {
  state: v.string(),
  districtScope: v.optional(v.string()),
  sector: v.string(),
  activity: v.string(),
  approvalType: v.string(),
  projectConditions: v.array(v.string()),
  conditions: v.array(conditionValidator),
  requiredInformation: v.array(v.string()),
  requiredDocuments: v.array(v.string()),
  prerequisites: v.array(v.string()),
  dependencies: v.array(v.string()),
  parallelizable: v.boolean(),
  slaWorkingDays: v.number(),
  validityDays: v.number(),
  renewalRules: v.string(),
  officialAuthority: v.string(),
  officialSource: v.string(),
  title: v.string(),
};

export const createRule = mutation({
  args: { ruleInput: v.object(ruleInput) },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.ADMIN, ROLES.DEPT_SUPERVISOR]);
    if (args.ruleInput.state.trim().length < 2) throw new ApprovalError("State is required.", "VALIDATION");
    if (!args.ruleInput.title.trim()) throw new ApprovalError("Title is required.", "VALIDATION");

    const now = Date.now();
    const ruleId = `RULE-${args.ruleInput.state.slice(0, 3).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const id = await ctx.db.insert("regulatoryRules", {
      ruleId,
      title: args.ruleInput.title,
      jurisdiction: `${args.ruleInput.state} (Prototype candidate)`,
      state: args.ruleInput.state,
      districtScope: args.ruleInput.districtScope,
      sector: args.ruleInput.sector,
      activity: args.ruleInput.activity,
      approvalType: args.ruleInput.approvalType,
      projectConditions: args.ruleInput.projectConditions,
      conditions: args.ruleInput.conditions,
      requiredInformation: args.ruleInput.requiredInformation,
      requiredDocuments: args.ruleInput.requiredDocuments,
      prerequisites: args.ruleInput.prerequisites,
      dependencies: args.ruleInput.dependencies,
      parallelizable: args.ruleInput.parallelizable,
      slaWorkingDays: args.ruleInput.slaWorkingDays,
      validityDays: args.ruleInput.validityDays,
      renewalRules: args.ruleInput.renewalRules,
      officialAuthority: args.ruleInput.officialAuthority,
      officialSource: args.ruleInput.officialSource,
      publicationDate: now,
      effectiveDate: now,
      version: 1,
      verificationStatus: "DRAFT",
      changeHistory: [{ at: now, actor: user.name ?? user.email ?? "Admin", note: "Rule created as DRAFT." }],
      postApprovalObligations: [],
    } as never);
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "RULE_CREATED",
      entityType: "regulatoryRules",
      entityId: id,
      newValue: { ruleId, title: args.ruleInput.title },
    });
    return { ruleId, id };
  },
});

export const updateRule = mutation({
  args: { id: v.id("regulatoryRules"), ruleInput: v.object(ruleInput) },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.ADMIN, ROLES.DEPT_SUPERVISOR]);
    const rule = await ctx.db.get(args.id);
    if (!rule) throw new ApprovalError("Rule not found.", "NOT_FOUND");
    if (rule.verificationStatus === "ACTIVE")
      throw new ApprovalError("Active rules cannot be edited directly. Create a new version instead.", "INVALID_STATE");
    const now = Date.now();
    await ctx.db.patch(args.id, { ...args.ruleInput } as never);
    await ctx.db.patch(args.id, {
      changeHistory: [
        ...rule.changeHistory,
        { at: now, actor: user.name ?? user.email ?? "Admin", note: "Rule edited." },
      ],
    } as never);
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "RULE_UPDATED",
      entityType: "regulatoryRules",
      entityId: args.id,
      previousValue: { title: rule.title },
      newValue: { title: args.ruleInput.title },
    });
    return { ok: true };
  },
});

export const submitRuleForVerification = mutation({
  args: { id: v.id("regulatoryRules") },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.ADMIN, ROLES.DEPT_SUPERVISOR]);
    const rule = await ctx.db.get(args.id);
    if (!rule) throw new ApprovalError("Rule not found.", "NOT_FOUND");
    if (rule.verificationStatus === "ACTIVE")
      throw new ApprovalError("Rule is already active.", "INVALID_STATE");
    await ctx.db.patch(args.id, { verificationStatus: "PENDING_VERIFICATION" } as never);
    await ctx.db.patch(args.id, {
      changeHistory: [
        ...rule.changeHistory,
        { at: Date.now(), actor: user.name ?? user.email ?? "Admin", note: "Submitted for verification." },
      ],
    } as never);
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "RULE_PENDING_VERIFICATION",
      entityType: "regulatoryRules",
      entityId: args.id,
      previousValue: rule.verificationStatus,
      newValue: "PENDING_VERIFICATION",
    });
    return { ok: true };
  },
});

export const verifyRule = mutation({
  args: { id: v.id("regulatoryRules"), reviewer: v.string(), effectiveDate: v.optional(v.number()) },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.ADMIN]);
    const rule = await ctx.db.get(args.id);
    if (!rule) throw new ApprovalError("Rule not found.", "NOT_FOUND");
    if (rule.verificationStatus !== "PENDING_VERIFICATION" && rule.verificationStatus !== "DRAFT")
      throw new ApprovalError("Only draft or pending rules can be verified.", "INVALID_STATE");
    if (args.reviewer.trim().length < 3) throw new ApprovalError("Reviewer name is required.", "VALIDATION");
    const now = Date.now();
    await ctx.db.patch(args.id, {
      verificationStatus: "ACTIVE",
      reviewer: args.reviewer,
      lastVerified: now,
      effectiveDate: args.effectiveDate ?? now,
    } as never);
    await ctx.db.patch(args.id, {
      changeHistory: [
        ...rule.changeHistory,
        { at: now, actor: user.name ?? user.email ?? "Admin", note: `Verified ACTIVE by ${args.reviewer}.` },
      ],
    } as never);
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "RULE_VERIFIED",
      entityType: "regulatoryRules",
      entityId: args.id,
      previousValue: rule.verificationStatus,
      newValue: "ACTIVE",
      detail: args.reviewer,
    });
    return { ok: true };
  },
});

export const supersedeRule = mutation({
  args: { id: v.id("regulatoryRules"), supersedingRuleId: v.string() },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.ADMIN]);
    const rule = await ctx.db.get(args.id);
    if (!rule) throw new ApprovalError("Rule not found.", "NOT_FOUND");
    await ctx.db.patch(args.id, {
      verificationStatus: "SUPERSEDED",
      supersedes: args.supersedingRuleId,
    } as never);
    await ctx.db.patch(args.id, {
      changeHistory: [
        ...rule.changeHistory,
        { at: Date.now(), actor: user.name ?? user.email ?? "Admin", note: `Superseded by ${args.supersedingRuleId}.` },
      ],
    } as never);
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "RULE_SUPERSEDED",
      entityType: "regulatoryRules",
      entityId: args.id,
      previousValue: rule.verificationStatus,
      newValue: "SUPERSEDED",
    });
    return { ok: true };
  },
});

export const expireRule = mutation({
  args: { id: v.id("regulatoryRules"), expiryDate: v.number() },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.ADMIN]);
    const rule = await ctx.db.get(args.id);
    if (!rule) throw new ApprovalError("Rule not found.", "NOT_FOUND");
    await ctx.db.patch(args.id, { verificationStatus: "EXPIRED", expiryDate: args.expiryDate } as never);
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "RULE_EXPIRED",
      entityType: "regulatoryRules",
      entityId: args.id,
      previousValue: rule.verificationStatus,
      newValue: "EXPIRED",
    });
    return { ok: true };
  },
});

/** Create a new version of an existing rule (DRAFT by default). */
export const createRuleVersion = mutation({
  args: { sourceRuleId: v.id("regulatoryRules"), ruleInput: v.object(ruleInput) },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.ADMIN, ROLES.DEPT_SUPERVISOR]);
    const source = await ctx.db.get(args.sourceRuleId);
    if (!source) throw new ApprovalError("Source rule not found.", "NOT_FOUND");
    const now = Date.now();
    const newVersion = source.version + 1;
    const id = await ctx.db.insert("regulatoryRules", {
      ruleId: source.ruleId,
      title: args.ruleInput.title,
      jurisdiction: source.jurisdiction,
      state: args.ruleInput.state,
      districtScope: args.ruleInput.districtScope,
      sector: args.ruleInput.sector,
      activity: args.ruleInput.activity,
      approvalType: args.ruleInput.approvalType,
      projectConditions: args.ruleInput.projectConditions,
      conditions: args.ruleInput.conditions,
      requiredInformation: args.ruleInput.requiredInformation,
      requiredDocuments: args.ruleInput.requiredDocuments,
      prerequisites: args.ruleInput.prerequisites,
      dependencies: args.ruleInput.dependencies,
      parallelizable: args.ruleInput.parallelizable,
      slaWorkingDays: args.ruleInput.slaWorkingDays,
      validityDays: args.ruleInput.validityDays,
      renewalRules: args.ruleInput.renewalRules,
      officialAuthority: args.ruleInput.officialAuthority,
      officialSource: args.ruleInput.officialSource,
      publicationDate: source.publicationDate,
      effectiveDate: now,
      version: newVersion,
      verificationStatus: "DRAFT",
      changeHistory: [
        ...source.changeHistory,
        { at: now, actor: user.name ?? user.email ?? "Admin", note: `Created version ${newVersion} from v${source.version}.` },
      ],
      postApprovalObligations: source.postApprovalObligations,
    } as never);
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "RULE_VERSION_CREATED",
      entityType: "regulatoryRules",
      entityId: id,
      newValue: { ruleId: source.ruleId, version: newVersion },
    });
    return { id };
  },
});

export type { Doc };