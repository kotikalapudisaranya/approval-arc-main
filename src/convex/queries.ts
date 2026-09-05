// Query management: raise / respond / resolve / reopen. All activity is
// audited and the application state machine is driven accordingly.
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, MutationCtx } from "./_generated/server";
import {
  ApprovalError,
  notify,
  recordAudit,
  requireRole,
} from "./lib/authz";
import { assertDeptLocal } from "./lib/applicationCore";
import { applyStatusChange } from "./applications";
import { ROLES } from "./schema";

export const raiseQuery = mutation({
  args: {
    applicationId: v.id("applications"),
    title: v.string(),
    reason: v.string(),
    requestedInformation: v.string(),
    responseDeadline: v.optional(v.number()),
    internalNote: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.DEPT_OFFICER, ROLES.DEPT_SUPERVISOR, ROLES.ADMIN]);
    await assertDeptLocal(ctx, user, args.applicationId);
    if (args.title.trim().length < 3) throw new ApprovalError("Query title is required.", "VALIDATION");
    if (args.message.trim().length < 10)
      throw new ApprovalError("A clear applicant-visible message is required.", "VALIDATION");

    const now = Date.now();
    const queryId = await ctx.db.insert("queries", {
      applicationId: args.applicationId,
      title: args.title,
      reason: args.reason,
      requestedInformation: args.requestedInformation,
      responseDeadline: args.responseDeadline,
      internalNote: args.internalNote,
      message: args.message,
      status: "OPEN",
      raisedBy: user._id,
      raisedAt: now,
    } as never);

    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "QUERY_RAISED",
      entityType: "queries",
      entityId: queryId,
      newValue: { title: args.title },
      detail: `Query raised on application ${args.applicationId}`,
    });

    await applyStatusChange(ctx, args.applicationId, {
      actor: user,
      to: "QUERY_RAISED",
      eventType: "QUERY_RAISED_STATUS",
      detail: args.title,
      internalNote: args.internalNote ? `Query: ${args.internalNote}` : undefined,
    });

    const app = await ctx.db.get(args.applicationId);
    const org = app ? await ctx.db.get(app.organizationId) : null;
    const owner = org ? await ctx.db.get(org.ownerId) : null;
    if (owner) {
      await notify(ctx, {
        userId: owner._id,
        title: "Query raised by department",
        message: args.title,
        type: "QUERY",
        link: `/applicant/applications/${args.applicationId}`,
      });
    }
    return { queryId };
  },
});

export const respondToQuery = mutation({
  args: {
    queryId: v.id("queries"),
    response: v.string(),
    attachmentDocumentId: v.optional(v.id("documents")),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.APPLICANT]);
    const query = await ctx.db.get(args.queryId);
    if (!query) throw new ApprovalError("Query not found.", "NOT_FOUND");
    const app = await ctx.db.get(query.applicationId);
    if (!app || app.organizationId !== user.organizationId)
      throw new ApprovalError("Forbidden.", "FORBIDDEN");
    if (!["OPEN", "RESPONDED", "REOPENED"].includes(query.status))
      throw new ApprovalError("This query is already resolved.", "INVALID_STATE");
    if (args.response.trim().length < 5)
      throw new ApprovalError("A response is required.", "VALIDATION");

    const now = Date.now();
    await ctx.db.insert("queryResponses", {
      queryId: query._id,
      applicationId: query.applicationId,
      response: args.response,
      attachmentDocumentId: args.attachmentDocumentId,
      respondedBy: user._id,
      respondedAt: now,
    } as never);
    await ctx.db.patch(query._id, { status: "RESPONDED" } as never);

    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "QUERY_RESPONDED",
      entityType: "queries",
      entityId: query._id,
      detail: "Applicant responded to query.",
    });

    // Move application out of pause (resumes the SLA clock).
    await applyStatusChange(ctx, query.applicationId, {
      actor: user,
      to: "RESUBMITTED",
      eventType: "APPLICANT_RESPONSE",
      detail: "Applicant responded to the department query.",
    });

    if (app.assignedOfficerId) {
      await notify(ctx, {
        userId: app.assignedOfficerId,
        title: "Query response received",
        message: "The applicant responded to your query.",
        type: "QUERY",
        link: `/department/applications/${app._id}`,
      });
    }
    return { ok: true };
  },
});

export const resolveQuery = mutation({
  args: { queryId: v.id("queries"), note: v.optional(v.string()) },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.DEPT_OFFICER, ROLES.DEPT_SUPERVISOR, ROLES.ADMIN]);
    const query = await ctx.db.get(args.queryId);
    if (!query) throw new ApprovalError("Query not found.", "NOT_FOUND");
    await assertDeptLocal(ctx, user, query.applicationId);
    if (query.status !== "RESPONDED")
      throw new ApprovalError("Only a responded query can be resolved.", "INVALID_STATE");

    await ctx.db.patch(query._id, { status: "RESOLVED" } as never);
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "QUERY_RESOLVED",
      entityType: "queries",
      entityId: query._id,
      detail: args.note,
    });

    // If every query on the application is resolved, resume review.
    const open = await ctx.db
      .query("queries")
      .withIndex("by_application", (q) => q.eq("applicationId", query.applicationId))
      .collect();
    const stillOpen = open.filter((q) => ["OPEN", "RESPONDED", "REOPENED"].includes(q.status));
    const app = await ctx.db.get(query.applicationId);
    if (app && stillOpen.length === 0 && app.status === "RESUBMITTED") {
      await applyStatusChange(ctx, app._id, {
        actor: user,
        to: "UNDER_REVIEW",
        eventType: "QUERY_RESOLVED_STATUS",
        detail: "All queries resolved; review resumed.",
      });
    } else if (app && stillOpen.length === 0 && app.status === "QUERY_RAISED") {
      await applyStatusChange(ctx, app._id, {
        actor: user,
        to: "UNDER_REVIEW",
        eventType: "QUERY_RESOLVED_STATUS",
        detail: "All queries resolved; review resumed.",
      });
    }
    return { ok: true };
  },
});

export const reopenQuery = mutation({
  args: { queryId: v.id("queries"), reason: v.string() },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireRole(ctx, [ROLES.DEPT_OFFICER, ROLES.DEPT_SUPERVISOR, ROLES.ADMIN]);
    const query = await ctx.db.get(args.queryId);
    if (!query) throw new ApprovalError("Query not found.", "NOT_FOUND");
    await assertDeptLocal(ctx, user, query.applicationId);
    await ctx.db.patch(query._id, { status: "REOPENED" } as never);
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "QUERY_REOPENED",
      entityType: "queries",
      entityId: query._id,
      detail: args.reason,
    });
    const app = await ctx.db.get(query.applicationId);
    if (app && ["UNDER_REVIEW", "RESUBMITTED"].includes(app.status)) {
      await applyStatusChange(ctx, app._id, {
        actor: user,
        to: "QUERY_RAISED",
        eventType: "QUERY_REOPENED_STATUS",
        detail: args.reason,
      });
    }
    return { ok: true };
  },
});