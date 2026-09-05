// Deterministic government scheme matcher: published criteria only, final
// eligibility stays with the scheme authority.
import { Doc } from "./_generated/dataModel";
import { query, QueryCtx } from "./_generated/server";
import { requireUser } from "./lib/authz";
import { evaluateCondition, ProfileLike } from "./lib/engine";
import { ROLES } from "./schema";

export function matchSchemes(
  schemes: Doc<"schemes">[],
  profile: ProfileLike,
): (Doc<"schemes"> & { match: "CRITERIA_MATCH" | "POTENTIAL_MATCH" | "NOT_MATCHED"; matchedCriteria: string[]; unmatchedCriteria: string[] })[] {
  return schemes.map((s) => {
    const results = s.matchCriteria.map((c) => ({
      cond: c,
      matched: evaluateCondition(c, profile),
    }));
    const matchedCriteria = results.filter((r) => r.matched).map((r) => r.cond.field);
    const unmatchedCriteria = results.filter((r) => !r.matched).map((r) => r.cond.field);
    let match: "CRITERIA_MATCH" | "POTENTIAL_MATCH" | "NOT_MATCHED";
    if (results.length === 0) match = "NOT_MATCHED";
    else if (results.every((r) => r.matched)) match = "CRITERIA_MATCH";
    else if (results.some((r) => r.matched)) match = "POTENTIAL_MATCH";
    else match = "NOT_MATCHED";
    return { ...s, match, matchedCriteria, unmatchedCriteria };
  });
}

export const matchedSchemes = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const user = await requireUser(ctx);
    if (user.role !== ROLES.APPLICANT || !user.organizationId) return { schemes: [], profile: null };
    const profile = await ctx.db
      .query("businessProfiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", user.organizationId!))
      .first();
    const all = await ctx.db.query("schemes").collect();
    if (!profile) {
      return {
        schemes: all.map((s) => ({ ...s, match: "NOT_MATCHED" as const, matchedCriteria: [], unmatchedCriteria: [] })),
        profile: null,
      };
    }
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const enriched = all.map((s) => {
      let status = s.status;
      if (s.closingDate && s.closingDate - now < 30 * DAY && s.closingDate > now) status = "CLOSING_SOON";
      else if (s.closingDate && s.closingDate < now && status === "ACTIVE") status = "CLOSED";
      return { ...s, status };
    });
    const schemes = matchSchemes(enriched, {
      state: profile.state,
      district: profile.district,
      sector: profile.sector,
      projectType: profile.projectType,
      projectStage: profile.projectStage,
      investment: profile.investment,
      employeeCount: profile.employeeCount,
      businessType: profile.businessType,
      operationalConditions: profile.operationalConditions,
    });
    schemes.sort((a, b) => rank(a.match) - rank(b.match));
    return { schemes, profile };
  },
});

function rank(m: string) {
  if (m === "CRITERIA_MATCH") return 0;
  if (m === "POTENTIAL_MATCH") return 1;
  return 2;
}