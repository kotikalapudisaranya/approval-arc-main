// Shared application helpers: department compartment checks.
import { Doc, Id } from "../_generated/dataModel";
import { ApprovalError, WriterCtx } from "./authz";
import { ROLES } from "../schema";

/**
 * Department compartment access control: officers may only act on
 * applications belonging to their configured department. Supervisors and
 * admins are not compartment-restricted.
 */
export async function assertDeptLocal(
  ctx: WriterCtx,
  user: Doc<"users">,
  applicationId: Id<"applications">,
) {
  const app = await ctx.db.get(applicationId);
  if (!app) throw new ApprovalError("Application not found.", "NOT_FOUND");
  if (user.role === ROLES.ADMIN) return;
  if (user.role === ROLES.DEPT_SUPERVISOR) return;
  if (user.role !== ROLES.DEPT_OFFICER) throw new ApprovalError("Forbidden.", "FORBIDDEN");
  if (user.department && app.department !== user.department)
    throw new ApprovalError("This application belongs to another department compartment.", "FORBIDDEN");
}