// Compliance engine: after a rule-based approval, configured post-approval
// obligations are generated from the rule (never invented at runtime).
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { ApprovalError, recordAudit, requireUser } from "./lib/authz";
import { ROLES } from "./schema";

/**
 * Generate compliance obligations from an approved application's rule.
 * Idempotent: re-running never duplicates existing obligations.
 */
export async function generateComplianceForApprovedApp(
  ctx: { db: MutationCtx["db"] },
  app: Doc<"applications">,
  rule: Doc<"regulatoryRules">,
  approvalAt: number,
) {
  const existing = await ctx.db
    .query("complianceObligations")
    .withIndex("by_organization", (q) => q.eq("organizationId", app.organizationId))
    .collect();
  const have = new Set(existing.map((o) => `${o.ruleId}:${o.title}:${o.dueDate}`));

  const DAY = 24 * 60 * 60 * 1000;
  for (const ob of rule.postApprovalObligations) {
    const offsetDays = ob.dueOffsetDays ?? 0;
    const dueDate = approvalAt + offsetDays * DAY;
    const key = `${rule.ruleId}:${ob.title}:${dueDate}`;
    if (have.has(key)) continue;
    await ctx.db.insert("complianceObligations", {
      organizationId: app.organizationId,
      applicationId: app._id,
      ruleId: rule.ruleId,
      title: ob.title,
      authority: rule.officialAuthority,
      type: ob.type,
      source: rule.officialSource,
      frequencyMonths: ob.frequencyMonths,
      dueDate,
      status: "UPCOMING",
      responsiblePerson: undefined,
    } as never);
    have.add(key);
  }
}

export const listCompliance = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const user = await requireUser(ctx);
    if (user.role !== ROLES.APPLICANT || !user.organizationId) return { obligations: [], calendar: [] };
    const obligations = await ctx.db
      .query("complianceObligations")
      .withIndex("by_organization", (q) => q.eq("organizationId", user.organizationId!))
      .collect();
    const now = Date.now();
    const enriched = obligations.map((o) => {
      let status = o.status;
      if (o.status !== "COMPLETED") {
        if (o.dueDate < now) status = "OVERDUE";
        else if (o.dueDate - now < 30 * 24 * 60 * 60 * 1000) status = "DUE_SOON";
      }
      return { ...o, status };
    });
    enriched.sort((a, b) => a.dueDate - b.dueDate);
    const calendar = enriched
      .filter((o) => ["UPCOMING", "DUE_SOON", "OVERDUE"].includes(o.status))
      .map((o) => ({
        date: o.dueDate,
        title: o.title,
        type: o.type,
        rules: [o.ruleId],
      }));
    return { obligations: enriched, calendar };
  },
});

export const completeObligation = mutation({
  args: { obligationId: v.id("complianceObligations"), note: v.optional(v.string()) },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireUser(ctx);
    const ob = await ctx.db.get(args.obligationId);
    if (!ob) throw new ApprovalError("Obligation not found.", "NOT_FOUND");
    if (user.role === ROLES.APPLICANT) {
      const org = await ctx.db.get(ob.organizationId);
      if (!org || org.ownerId !== user._id) throw new ApprovalError("Forbidden.", "FORBIDDEN");
    }
    const now = Date.now();
    await ctx.db.patch(ob._id, {
      status: "COMPLETED",
      lastCompletedAt: now,
      responsiblePerson: user.name ?? user.email,
    } as never);
    // Recurring obligations schedule the next due date.
    if (ob.frequencyMonths && ob.frequencyMonths > 0) {
      const days = Math.round(ob.frequencyMonths * 30.44);
      await ctx.db.insert("complianceObligations", {
        organizationId: ob.organizationId,
        applicationId: ob.applicationId,
        ruleId: ob.ruleId,
        title: ob.title,
        authority: ob.authority,
        type: ob.type,
        source: ob.source,
        frequencyMonths: ob.frequencyMonths,
        dueDate: now + days * 24 * 60 * 60 * 1000,
        status: "UPCOMING",
        responsiblePerson: undefined,
      } as never);
    }
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "COMPLIANCE_COMPLETED",
      entityType: "complianceObligations",
      entityId: ob._id,
      previousValue: ob.status,
      newValue: "COMPLETED",
      detail: args.note,
    });
    return { ok: true };
  },
});

export type { Id, Doc };