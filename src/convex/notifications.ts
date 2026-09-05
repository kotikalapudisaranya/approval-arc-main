// Notifications + append-only audit log reads.
import { v } from "convex/values";
import { query, mutation, MutationCtx, QueryCtx } from "./_generated/server";
import { requireUser } from "./lib/authz";
import { ROLES } from "./schema";

export const myNotifications = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const user = await requireUser(ctx);
    const items = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
    return items;
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const user = await requireUser(ctx);
    const items = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("read", false))
      .take(100);
    return items.length;
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx: MutationCtx) => {
    const user = await requireUser(ctx);
    const items = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("read", false))
      .take(100);
    for (const n of items) await ctx.db.patch(n._id, { read: true } as never);
    return { ok: true };
  },
});

export const listAudit = query({
  args: { limit: v.optional(v.number()), actorId: v.optional(v.id("users")), entityType: v.optional(v.string()) },
  handler: async (ctx: QueryCtx, args) => {
    const user = await requireUser(ctx);
    // Audit is visible to department staff (own compartment) and admins.
    // Applicants only see audit events tied to their own organization.
    if (user.role === ROLES.APPLICANT) {
      const all = await ctx.db.query("auditLogs").order("desc").take(300);
      const org = user.organizationId ? await ctx.db.get(user.organizationId) : null;
      const relevant: string[] = [];
      if (org) {
        const appIdsByOrg = await ctx.db
          .query("applications")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .collect();
        for (const a of appIdsByOrg) relevant.push(a._id);
      }
      const relevantSet = new Set(relevant);
      const mine = all.filter((e) => {
        if (["applications", "documents", "queries", "inspections", "complianceObligations"].includes(e.entityType)) {
          return !e.entityId || relevantSet.has(e.entityId);
        }
        // login / profile events for this user or their organization
        return e.actorId === user._id || e.entityId === user._id;
      });
      return mine.slice(0, args.limit ?? 100);
    }
    let all = await ctx.db.query("auditLogs").order("desc").collect();
    if (args.actorId) all = all.filter((e) => e.actorId === args.actorId);
    if (args.entityType) all = all.filter((e) => e.entityType === args.entityType);
    if (user.role === ROLES.DEPT_OFFICER && user.department) {
      // Compartment filter: only audit entries for that department's apps.
      const apps = await ctx.db.query("applications").collect();
      const ids = new Set(
        apps.filter((a) => a.department === user.department).map((a) => a._id),
      );
      all = all.filter(
        (e) =>
          e.entityType === "applications" || e.entityType === "documents" || e.entityType === "queries" || e.entityType === "inspections"
            ? (e.entityId && ids.has(e.entityId as never)) || !e.entityId
            : e.context === user.department || !e.entityId,
      );
    }
    return all.slice(0, args.limit ?? 200);
  },
});