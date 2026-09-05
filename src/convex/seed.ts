// ---------------------------------------------------------------------------
// Demo bootstrap (action layer).
//
// Convex actions cannot write directly to the database, so this action only
// creates the demo password accounts (createAccount is action-scoped) and then
// delegates every database write to an internal mutation (seedData.ts).
// ---------------------------------------------------------------------------
import { createAccount } from "@convex-dev/auth/server";
import { action, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import type { SeedDataResult } from "./seedData";

type BootstrapResult = {
  alreadySeeded: boolean;
  accounts?: Record<string, { email: string; password: string }>;
  organizationId?: string;
  businessProfileId?: string;
  applicationIds?: SeedDataResult["applicationIds"];
  rules?: number;
  schemes?: number;
};

async function createUser(
  ctx: ActionCtx,
  opts: {
    email: string;
    password: string;
    name: string;
  },
) {
  const { user } = await createAccount(ctx, {
    provider: "password",
    account: { id: opts.email, secret: opts.password },
    profile: {
      email: opts.email,
      emailVerificationTime: Date.now(),
      name: opts.name,
    },
  });
  return user as Doc<"users">;
}

export const bootstrapDemo = action({
  args: {},
  handler: async (ctx): Promise<BootstrapResult> => {
    const seeded = await ctx.runQuery(internal.seedData.isSeededInternal, {});
    if (seeded) return { alreadySeeded: true };

    const applicant = await createUser(ctx, {
      email: "demo.applicant@approvalarc.in",
      password: "DemoPass@2026",
      name: "Demo Applicant",
    });
    const officer = await createUser(ctx, {
      email: "demo.officer@mpcb.in",
      password: "DemoPass@2026",
      name: "Demo Officer",
    });
    const supervisor = await createUser(ctx, {
      email: "demo.supervisor@mpcb.in",
      password: "DemoPass@2026",
      name: "Demo Supervisor",
    });
    const admin = await createUser(ctx, {
      email: "demo.admin@approvalarc.in",
      password: "DemoPass@2026",
      name: "Demo Administrator",
    });

    const result = (await ctx.runMutation(internal.seedData.seedDataMutation, {
      applicantId: applicant._id,
      officerId: officer._id,
      supervisorId: supervisor._id,
      adminId: admin._id,
    })) as SeedDataResult;

    return {
      alreadySeeded: false,
      accounts: {
        applicant: { email: "demo.applicant@approvalarc.in", password: "DemoPass@2026" },
        officer: { email: "demo.officer@mpcb.in", password: "DemoPass@2026" },
        supervisor: { email: "demo.supervisor@mpcb.in", password: "DemoPass@2026" },
        admin: { email: "demo.admin@approvalarc.in", password: "DemoPass@2026" },
      },
      organizationId: result.organizationId,
      businessProfileId: result.businessProfileId,
      applicationIds: result.applicationIds,
      rules: result.rules,
      schemes: result.schemes,
    };
  },
});