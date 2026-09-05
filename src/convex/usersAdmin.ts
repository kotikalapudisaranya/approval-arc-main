// User & role administration for System Administrator.
import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { ApprovalError, recordAudit, requireRole } from "./lib/authz";
import { roleValidator, ROLES } from "./schema";

export const listUsers = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    await requireRole(ctx, [ROLES.ADMIN]);
    const users = await ctx.db.query("users").collect();
    const out = [];
    for (const u of users) {
      const org = u.organizationId ? await ctx.db.get(u.organizationId) : null;
      out.push({ ...u, organizationName: org?.name ?? null });
    }
    return out;
  },
});

export const setUserRole = mutation({
  args: { userId: v.id("users"), role: roleValidator },
  handler: async (ctx: MutationCtx, args) => {
    const actor = await requireRole(ctx, [ROLES.ADMIN]);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new ApprovalError("User not found.", "NOT_FOUND");
    const previous = target.role;
    await ctx.db.patch(args.userId, { role: args.role } as never);
    await recordAudit(ctx, {
      actorId: actor._id,
      actorName: actor.name ?? actor.email ?? "Admin",
      actorRole: "admin",
      action: "USER_ROLE_CHANGED",
      entityType: "users",
      entityId: args.userId,
      previousValue: previous,
      newValue: args.role,
    });
    return { ok: true };
  },
});

export const setDepartment = mutation({
  args: { userId: v.id("users"), department: v.string(), employeeId: v.optional(v.string()) },
  handler: async (ctx: MutationCtx, args) => {
    const actor = await requireRole(ctx, [ROLES.ADMIN]);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new ApprovalError("User not found.", "NOT_FOUND");
    await ctx.db.patch(args.userId, {
      department: args.department,
      employeeId: args.employeeId ?? target.employeeId,
    } as never);
    await recordAudit(ctx, {
      actorId: actor._id,
      actorName: actor.name ?? actor.email ?? "Admin",
      actorRole: "admin",
      action: "USER_DEPARTMENT_CHANGED",
      entityType: "users",
      entityId: args.userId,
      previousValue: target.department,
      newValue: args.department,
    });
    return { ok: true };
  },
});

export const departmentsWithCounts = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    await requireRole(ctx, [ROLES.ADMIN, ROLES.DEPT_SUPERVISOR]);
    const users = await ctx.db.query("users").collect();
    const apps = await ctx.db.query("applications").collect();
    const deptSet = new Set<string>();
    for (const u of users) if (u.department) deptSet.add(u.department);
    for (const a of apps) deptSet.add(a.department);
    const counts: { department: string; officers: number; applications: number }[] = [];
    for (const d of deptSet) {
      counts.push({
        department: d,
        officers: users.filter((u) => u.department === d).length,
        applications: apps.filter((a) => a.department === d).length,
      });
    }
    return counts.sort((a, b) => a.department.localeCompare(b.department));
  },
});