// ---------------------------------------------------------------------------
// Deterministic Approval Intelligence Engine.
// No AI / ML / LLM anywhere: applicability is decided purely by structured
// rule composition against the business profile.
// ---------------------------------------------------------------------------
import { Doc } from "../_generated/dataModel";
import { Condition, EvalStatus } from "../schema";

export type ProfileLike = {
  state: string;
  district?: string;
  sector: string;
  projectType: string;
  projectStage?: string;
  investment: number;
  employeeCount: number;
  businessType?: string;
  activity?: string;
  operationalConditions?: string[];
};

/** Resolve a condition field to a comparable value from the profile. */
function resolveField(profile: ProfileLike, field: string): unknown {
  switch (field) {
    case "state":
      return profile.state;
    case "district":
      return profile.district;
    case "sector":
      return profile.sector;
    case "projectType":
      return profile.projectType;
    case "projectStage":
      return profile.projectStage;
    case "investment":
      return profile.investment;
    case "employeeCount":
      return profile.employeeCount;
    case "businessType":
      return profile.businessType;
    case "activity":
      return profile.activity ?? profile.businessType;
    default:
      // operational conditions and anything else are checked as arrays/strings
      if (field.startsWith("condition:")) {
        const wanted = field.slice("condition:".length);
        return (profile.operationalConditions ?? []).includes(wanted);
      }
      return undefined;
  }
}

/** Evaluate one condition against the profile. Returns whether it matched. */
export function evaluateCondition(
  condition: Condition,
  profile: ProfileLike,
): boolean {
  const actual = resolveField(profile, condition.field);
  const expected = condition.value;

  switch (condition.op) {
    case "eq":
      return actual === expected;
    case "ne":
      return actual !== expected;
    case "gte":
      return typeof actual === "number" && typeof expected === "number"
        ? actual >= expected
        : false;
    case "lte":
      return typeof actual === "number" && typeof expected === "number"
        ? actual <= expected
        : false;
    case "in":
      if (typeof expected !== "string") return false;
      if (typeof actual === "string") {
        return expected
          .split(",")
          .map((s) => s.trim())
          .includes(actual);
      }
      if (Array.isArray(actual)) {
        const wanted = expected.split(",").map((s) => s.trim());
        return (actual as string[]).some((a) => wanted.includes(a));
      }
      return false;
    case "contains":
      if (typeof expected !== "string") return false;
      if (typeof actual === "string") return actual.toLowerCase().includes(expected.toLowerCase());
      if (Array.isArray(actual)) return (actual as string[]).includes(expected);
      return false;
    default:
      return false;
  }
}

export type TriggerInfo = {
  field: string;
  op: string;
  value: unknown;
  matched: boolean;
  label?: string;
};

export type RuleEval = {
  rule: Doc<"regulatoryRules">;
  status: EvalStatus;
  triggers: TriggerInfo[];
  reason: string;
};

export function isUsableRule(rule: Pick<Doc<"regulatoryRules">, "verificationStatus">) {
  return rule.verificationStatus !== "SUPERSEDED" && rule.verificationStatus !== "EXPIRED";
}

/**
 * Evaluate a rule against a profile.
 * - NOT_APPLICABLE: jurisdiction/sector clearly outside the rule scope.
 * - CONDITIONAL: only part of the rule's conditions are met.
 * - APPLICABLE: every configured condition matches.
 */
export function evaluateRule(rule: Doc<"regulatoryRules">, profile: ProfileLike): RuleEval {
  const triggers: TriggerInfo[] = rule.conditions.map((c) => ({
    field: c.field,
    op: c.op,
    value: c.value,
    matched: evaluateCondition(c, profile),
  }));

  const matched = triggers.filter((t) => t.matched).length;
  const total = triggers.length;

  let status: EvalStatus;
  let reason: string;
  if (total === 0) {
    status = "NOT_APPLICABLE";
    reason = "No configured conditions for this rule.";
  } else if (matched === total) {
    status = "APPLICABLE";
    reason = "All configured conditions match the business profile.";
  } else if (matched > 0) {
    status = "CONDITIONAL";
    reason = "Only part of the configured conditions match the business profile.";
  } else {
    status = "NOT_APPLICABLE";
    reason = "None of the configured conditions match this business profile.";
  }
  return { rule, status, triggers, reason };
}

/**
 * Evaluate all rules for a profile. Sorted: applicable first, then
 * conditional, then not applicable.
 */
export function evaluateAllRules(
  rules: Doc<"regulatoryRules">[],
  profile: ProfileLike,
): RuleEval[] {
  return rules
    .filter(isUsableRule)
    .map((r) => evaluateRule(r, profile))
    .sort((a, b) => {
      const order: Record<string, number> = {
        APPLICABLE: 0,
        CONDITIONAL: 1,
        NOT_APPLICABLE: 2,
        BLOCKED: 0,
        READY: 0,
      };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    });
}

/** True if a rule is configured for this state+sector at all. */
export function hasConfiguredRules(
  rules: Doc<"regulatoryRules">[],
  state: string,
  sector: string,
): boolean {
  return rules.some(
    (r) => isUsableRule(r) && r.state === state && r.sector === sector,
  );
}