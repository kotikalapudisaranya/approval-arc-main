// Inspection management. Internal officer notes never leak to the applicant;
// anything applicant-visible is stored on its own field.
import { v } from "convex/values";
import { mutation, MutationCtx } from "./_generated/server";
import {
  ApprovalError,
  insertApplicationEvent,
  notify,
  recordAudit,
  requireRole,
} from "./lib/authz";
import { assertDeptLocal } from "./lib/applicationCore";
import { applyStatusChange } from "./applications";
import { ROLES } from "./schema";

export const requireInspection = mutation({
  args: {
    applicationId: v.id("applications"),
    type: v.string(),
    purpose: v.string(),
    location: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    applicantNotes: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.DEPT_OFFICER, ROLES.DEPT_SUPERVISOR, ROLES.ADMIN]);
    await assertDeptLocal(ctx, user, args.applicationId);
    if (args.type.trim().length < 3) throw new ApprovalError("Inspection type is required.", "VALIDATION");
    if (args.purpose.trim().length < 3) throw new ApprovalError("Purpose is required.", "VALIDATION");

    const now = Date.now();
    const inspectionId = await ctx.db.insert("inspections", {
      applicationId: args.applicationId,
      type: args.type,
      purpose: args.purpose,
      location: args.location,
      status: "REQUIRED",
      internalNotes: args.internalNotes,
      applicantNotes: args.applicantNotes,
      requestedBy: user._id,
      requestedAt: now,
    } as never);

    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "INSPECTION_REQUIRED",
      entityType: "inspections",
      entityId: inspectionId,
      detail: args.type,
    });

    await applyStatusChange(ctx, args.applicationId, {
      actor: user,
      to: "INSPECTION_REQUIRED",
      eventType: "INSPECTION_REQUIRED_STATUS",
      detail: args.type,
    });

    const app = await ctx.db.get(args.applicationId);
    const org = app ? await ctx.db.get(app.organizationId) : null;
    const owner = org ? await ctx.db.get(org.ownerId) : null;
    if (owner) {
      await notify(ctx, {
        userId: owner._id,
        title: "Site inspection required",
        message: args.applicantNotes ?? `A ${args.type} inspection is required for your application.`,
        type: "INSPECTION",
        link: `/applicant/applications/${args.applicationId}`,
      });
    }
    return { inspectionId };
  },
});

export const scheduleInspection = mutation({
  args: {
    inspectionId: v.id("inspections"),
    scheduledDate: v.number(),
    inspectorName: v.string(),
    location: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    applicantNotes: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.DEPT_OFFICER, ROLES.DEPT_SUPERVISOR, ROLES.ADMIN]);
    const inspection = await ctx.db.get(args.inspectionId);
    if (!inspection) throw new ApprovalError("Inspection not found.", "NOT_FOUND");
    await assertDeptLocal(ctx, user, inspection.applicationId);
    if (args.scheduledDate < Date.now())
      throw new ApprovalError("Scheduled date must be in the future.", "VALIDATION");
    if (args.inspectorName.trim().length < 3)
      throw new ApprovalError("Inspector name is required.", "VALIDATION");

    const now = Date.now();
    const wasRequired = inspection.status === "REQUIRED" || inspection.status === "RESCHEDULED";
    await ctx.db.patch(inspection._id, {
      status: "SCHEDULED",
      scheduledDate: args.scheduledDate,
      inspectorName: args.inspectorName,
      location: args.location ?? inspection.location,
      internalNotes: args.internalNotes ?? inspection.internalNotes,
      applicantNotes: args.applicantNotes ?? inspection.applicantNotes,
    } as never);

    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "INSPECTION_SCHEDULED",
      entityType: "inspections",
      entityId: inspection._id,
      newValue: { date: args.scheduledDate, inspector: args.inspectorName },
    });

    if (wasRequired) {
      await applyStatusChange(ctx, inspection.applicationId, {
        actor: user,
        to: "INSPECTION_SCHEDULED",
        eventType: "INSPECTION_SCHEDULED_STATUS",
        detail: args.inspectorName,
      });
    }

    const app = await ctx.db.get(inspection.applicationId);
    const org = app ? await ctx.db.get(app.organizationId) : null;
    const owner = org ? await ctx.db.get(org.ownerId) : null;
    if (owner) {
      await notify(ctx, {
        userId: owner._id,
        title: "Inspection scheduled",
        message: `Your ${inspection.type} inspection is scheduled on ${new Date(args.scheduledDate).toLocaleDateString()} (${args.inspectorName}).`,
        type: "INSPECTION",
        link: `/applicant/applications/${inspection.applicationId}`,
      });
    }
    return { ok: true };
  },
});

export const completeInspection = mutation({
  args: {
    inspectionId: v.id("inspections"),
    outcome: v.union(v.literal("PASSED"), v.literal("FAILED"), v.literal("PARTIAL")),
    outcomeNotes: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.DEPT_OFFICER, ROLES.DEPT_SUPERVISOR, ROLES.ADMIN]);
    const inspection = await ctx.db.get(args.inspectionId);
    if (!inspection) throw new ApprovalError("Inspection not found.", "NOT_FOUND");
    await assertDeptLocal(ctx, user, inspection.applicationId);
    if (inspection.status !== "SCHEDULED")
      throw new ApprovalError("Only a scheduled inspection can be marked complete.", "INVALID_STATE");

    const now = Date.now();
    await ctx.db.patch(inspection._id, {
      status: "COMPLETED",
      outcome: args.outcome,
      applicantNotes: args.outcomeNotes ?? inspection.applicantNotes,
      completedAt: now,
    } as never);

    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "INSPECTION_COMPLETED",
      entityType: "inspections",
      entityId: inspection._id,
      previousValue: "SCHEDULED",
      newValue: args.outcome,
      detail: args.outcomeNotes,
    });

    const nextStatus = args.outcome === "PASSED" ? "DECISION_PENDING" : "INSPECTION_REQUIRED";
    await applyStatusChange(ctx, inspection.applicationId, {
      actor: user,
      to: nextStatus,
      eventType: "INSPECTION_COMPLETED",
      detail: `Inspection outcome: ${args.outcome}${args.outcomeNotes ? ` — ${args.outcomeNotes}` : ""}`,
    });

    const app = await ctx.db.get(inspection.applicationId);
    const org = app ? await ctx.db.get(app.organizationId) : null;
    const owner = org ? await ctx.db.get(org.ownerId) : null;
    if (owner) {
      await notify(ctx, {
        userId: owner._id,
        title: "Inspection completed",
        message: `The ${inspection.type} inspection was completed (${args.outcome}).`,
        type: "INSPECTION",
        link: `/applicant/applications/${inspection.applicationId}`,
      });
    }
    return { ok: true };
  },
});

export const cancelInspection = mutation({
  args: { inspectionId: v.id("inspections"), reason: v.string() },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.DEPT_OFFICER, ROLES.DEPT_SUPERVISOR, ROLES.ADMIN]);
    const inspection = await ctx.db.get(args.inspectionId);
    if (!inspection) throw new ApprovalError("Inspection not found.", "NOT_FOUND");
    await assertDeptLocal(ctx, user, inspection.applicationId);
    await ctx.db.patch(inspection._id, { status: "CANCELLED" } as never);
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "INSPECTION_CANCELLED",
      entityType: "inspections",
      entityId: inspection._id,
      detail: args.reason,
    });
    await insertApplicationEvent(ctx, {
      applicationId: inspection.applicationId,
      eventType: "INSPECTION_CANCELLED",
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Officer",
      detail: args.reason,
    });
    return { ok: true };
  },
});

export const rescheduleInspection = mutation({
  args: { inspectionId: v.id("inspections"), scheduledDate: v.number(), inspectorName: v.optional(v.string()) },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.DEPT_OFFICER, ROLES.DEPT_SUPERVISOR, ROLES.ADMIN]);
    const inspection = await ctx.db.get(args.inspectionId);
    if (!inspection) throw new ApprovalError("Inspection not found.", "NOT_FOUND");
    await assertDeptLocal(ctx, user, inspection.applicationId);
    await ctx.db.patch(inspection._id, {
      status: "RESCHEDULED",
      scheduledDate: args.scheduledDate,
      inspectorName: args.inspectorName ?? inspection.inspectorName,
    } as never);
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "INSPECTION_RESCHEDULED",
      entityType: "inspections",
      entityId: inspection._id,
      newValue: { date: args.scheduledDate },
    });
    await insertApplicationEvent(ctx, {
      applicationId: inspection.applicationId,
      eventType: "INSPECTION_RESCHEDULED",
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Officer",
      detail: new Date(args.scheduledDate).toLocaleDateString(),
    });
    return { ok: true };
  },
});