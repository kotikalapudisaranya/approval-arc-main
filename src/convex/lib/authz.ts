// Shared authz / audit / notification helpers for the Convex backend.
// Every mutating function goes through `recordAudit` so the trail is
// append-only and immutable from the application UI.
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Auth, GenericDatabaseReader, GenericDatabaseWriter } from "convex/server";
import { DataModel, Doc, Id } from "../_generated/dataModel";
import { Role, ROLES } from "../schema";

export class ApprovalError extends ConvexError<{ message: string; code?: string }> {
  constructor(message: string, code?: string) {
    super({ message, code });
  }
}

export type ReaderCtx = {
  db: GenericDatabaseReader<DataModel>;
  auth: Auth;
};
export type WriterCtx = {
  db: GenericDatabaseWriter<DataModel>;
  auth: Auth;
};

export async function getAuthUser(ctx: ReaderCtx | WriterCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return (await ctx.db.get(userId)) as Doc<"users"> | null;
}

/** Returns the signed-in user or throws. */
export async function requireUser(ctx: ReaderCtx | WriterCtx): Promise<Doc<"users">> {
  const user = await getAuthUser(ctx);
  if (user === null) throw new ApprovalError("You must be signed in.", "UNAUTHENTICATED");
  return user;
}

/** Returns the signed-in user with one of the given roles or throws. */
export async function requireRole(
  ctx: ReaderCtx | WriterCtx,
  roles: Role[],
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!user.role || !roles.includes(user.role)) {
    throw new ApprovalError("You are not authorized to perform this action.", "FORBIDDEN");
  }
  return user;
}

export const isApplicant = (role?: Role) => role === ROLES.APPLICANT;
export const isOfficer = (role?: Role) =>
  role === ROLES.DEPT_OFFICER || role === ROLES.DEPT_SUPERVISOR;
export const isDepartment = (role?: Role) =>
  role === ROLES.DEPT_OFFICER || role === ROLES.DEPT_SUPERVISOR || role === ROLES.ADMIN;
export const isSupervisor = (role?: Role) => role === ROLES.DEPT_SUPERVISOR;
export const isAdmin = (role?: Role) => role === ROLES.ADMIN;

export const roleLabel: Record<string, string> = {
  [ROLES.APPLICANT]: "Applicant",
  [ROLES.DEPT_OFFICER]: "Department Officer",
  [ROLES.DEPT_SUPERVISOR]: "Department Supervisor",
  [ROLES.ADMIN]: "System Administrator",
};

/**
 * Append to the audit trail. Records timestamps explicitly so seeded history
 * can be back-dated. There is deliberately NO update/delete path: the trail is
 * append-only from the application.
 */
export async function recordAudit(
  ctx: WriterCtx,
  entry: {
    actorId?: Id<"users">;
    actorName: string;
    actorRole: string;
    action: string;
    entityType: string;
    entityId?: string;
    previousValue?: unknown;
    newValue?: unknown;
    detail?: string;
    context?: string;
    occurredAt?: number;
  },
) {
  await ctx.db.insert("auditLogs", {
    actorId: entry.actorId,
    actorName: entry.actorName,
    actorRole: entry.actorRole,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    previousValue: entry.previousValue === undefined ? undefined : entry.previousValue,
    newValue: entry.newValue === undefined ? undefined : entry.newValue,
    detail: entry.detail,
    context: entry.context,
    occurredAt: entry.occurredAt ?? Date.now(),
  } as never);
}

export async function notify(
  ctx: WriterCtx,
  n: {
    userId: Id<"users">;
    title: string;
    message: string;
    type: "SLA" | "QUERY" | "DOCUMENT" | "INSPECTION" | "DECISION" | "SYSTEM";
    link?: string;
  },
) {
  await ctx.db.insert("notifications", {
    userId: n.userId,
    title: n.title,
    message: n.message,
    type: n.type,
    read: false,
    link: n.link,
  } as never);
}

export async function insertApplicationEvent(
  ctx: WriterCtx,
  event: {
    applicationId: Id<"applications">;
    eventType: string;
    actorId?: Id<"users">;
    actorName: string;
    from?: string;
    to?: string;
    detail?: string;
    occurredAt?: number;
    visibility?: "APPLICANT_VISIBLE" | "INTERNAL_ONLY";
  },
) {
  await ctx.db.insert("applicationEvents", {
    applicationId: event.applicationId,
    eventType: event.eventType,
    actorId: event.actorId,
    actorName: event.actorName,
    from: event.from,
    to: event.to,
    detail: event.detail,
    occurredAt: event.occurredAt ?? Date.now(),
    visibility: event.visibility ?? "APPLICANT_VISIBLE",
  } as never);
}

// Cast helper for typed inserts from a GenericDatabaseWriter.
export function asDoc<T>(doc: T): T {
  return doc;
}