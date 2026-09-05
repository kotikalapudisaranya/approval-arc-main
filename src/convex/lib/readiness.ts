// Submission-readiness computation: deterministic pre-submission checks.
// This NEVER predicts or guarantees departmental approval — it only reports
// whether configured pre-submission checks have passed.
import { Doc } from "../_generated/dataModel";
import { ReaderCtx } from "./authz";
import { DOCUMENT_TYPES } from "./config";

export type ReadinessCategory = {
  key: string;
  label: string;
  required: number;
  passed: number;
  items: { label: string; status: "PASSED" | "FAILED" | "WARNING" | "N/A"; detail: string }[];
};

export type ReadinessResult = {
  categories: ReadinessCategory[];
  overall: boolean;
  notes: string[];
};

export async function computeReadiness(
  ctx: ReaderCtx,
  app: Doc<"applications">,
  rule: Doc<"regulatoryRules">,
  profile: Doc<"businessProfiles">,
  org: Doc<"organizations">,
  docs: Doc<"documents">[],
): Promise<ReadinessResult> {
  const notes: string[] = [];
  const activeDocs = docs.filter((d) => d.status === "ACTIVE");

  // 1. Required documents
  const docItems = rule.requiredDocuments.map((key) => {
    const label = DOCUMENT_TYPES[key] ?? key;
    const matches = activeDocs.filter((d) => d.documentType === key);
    const confirmed = matches.filter((d) => d.fieldsConfirmed);
    const valid = confirmed.filter((d) => d.validationStatus === "PASSED");
    if (valid.length > 0)
      return { label, status: "PASSED" as const, detail: `${valid.length} valid document(s) on file` };
    if (confirmed.length > 0)
      return { label, status: "WARNING" as const, detail: "Document uploaded but checks outstanding" };
    if (matches.length > 0)
      return { label, status: "WARNING" as const, detail: "Document uploaded, fields not confirmed" };
    return { label, status: "FAILED" as const, detail: "Required document not uploaded" };
  });
  const docPassed = docItems.filter((i) => i.status === "PASSED").length;
  const partialInfo = docItems.some((i) => i.status === "WARNING");
  if (partialInfo) notes.push("Some uploaded documents still need field confirmation or validation.");

  // 2. Mandatory information (business profile)
  const infoChecks: { label: string; ok: boolean; detail: string }[] = [
    { label: "Business name", ok: org.name.trim().length >= 3, detail: org.name },
    { label: "State & district", ok: !!profile.state && !!profile.district, detail: `${profile.state}, ${profile.district}` },
    { label: "Sector", ok: !!profile.sector, detail: profile.sector },
    { label: "Project type", ok: !!profile.projectType, detail: profile.projectType },
    { label: "Investment declared", ok: profile.investment > 0, detail: `₹ ${profile.investment} lakh` },
    { label: "Employee count declared", ok: profile.employeeCount > 0, detail: `${profile.employeeCount}` },
  ];
  const infoItems = infoChecks.map((c) => ({
    label: c.label,
    status: (c.ok ? "PASSED" : "FAILED") as "PASSED" | "FAILED",
    detail: c.detail,
  }));

  // 3. Data consistency (cross-document business-name match)
  const confirmedDocs = activeDocs.filter((d) => d.fieldsConfirmed && d.validationStatus !== "FAILED");
  const nameMismatches = confirmedDocs.filter((d) => {
    const bn = d.extractedFields.find((f) => f.key === "businessName");
    return bn?.value && norm(bn.value) !== norm(org.name);
  });
  const consistencyItems: ReadinessCategory["items"] = [
    {
      label: "Business name consistent across documents",
      status: nameMismatches.length === 0 ? "PASSED" : "FAILED",
      detail:
        nameMismatches.length === 0
          ? `${confirmedDocs.length} confirmed document(s) consistent`
          : `${nameMismatches.length} document(s) carry a different business name`,
    },
  ];
  if (nameMismatches.length > 0) notes.push("Cross-document consistency check failed for business name.");

  // 4. Prerequisites (statutory prerequisites cannot be bypassed)
  const apps = ctx.db.query("applications").withIndex("by_organization", (q) => q.eq("organizationId", org._id));
  const orgApps: Doc<"applications">[] = [];
  for await (const a of apps) orgApps.push(a);
  const prereqItems = rule.prerequisites.map((rid) => {
    const approved = orgApps.find((a) => a.ruleId === rid && a.status === "APPROVED");
    return {
      label: `${rid} — prerequisite approval`,
      status: (approved ? "PASSED" : "FAILED") as "PASSED" | "FAILED",
      detail: approved ? "Prerequisite approved" : "Prerequisite not yet approved",
    };
  });

  // 5. Verification status (informational, does not block submission by itself)
  const requiredKeys = new Set(rule.requiredDocuments);
  const requiredConfirmed = activeDocs.filter((d) => d.documentType && requiredKeys.has(d.documentType) && d.fieldsConfirmed);
  const verified = requiredConfirmed.filter(
    (d) => d.verificationStatus === "VERIFIED" || d.verificationStatus === "AUTHENTICITY_UNAVAILABLE",
  );
  const verifyItems: ReadinessCategory["items"] = [
    {
      label: "Issuer verification for required documents",
      status: verified.length === requiredConfirmed.length ? "PASSED" : "N/A",
      detail:
        requiredConfirmed.length === 0
          ? "No required documents uploaded yet"
          : `${verified.length}/${requiredConfirmed.length} processed for verification`,
    },
  ];

  const categories: ReadinessCategory[] = [
    { key: "documents", label: "Required Documents", required: docItems.length, passed: docPassed, items: docItems },
    { key: "information", label: "Mandatory Information", required: infoChecks.length, passed: infoChecks.filter((c) => c.ok).length, items: infoItems },
    { key: "consistency", label: "Data Consistency", required: 1, passed: nameMismatches.length === 0 ? 1 : 0, items: consistencyItems },
    { key: "prerequisites", label: "Known Prerequisites", required: prereqItems.length, passed: prereqItems.filter((i) => i.status === "PASSED").length, items: prereqItems },
    { key: "verification", label: "Verification Status", required: 1, passed: verified.length === requiredConfirmed.length && requiredConfirmed.length > 0 ? 1 : 0, items: verifyItems },
  ];

  const blocking = categories.filter((c) => c.key !== "verification" && c.passed < c.required);
  const allDocsRequiredOk = docItems.length === 0 || docPassed === docItems.length;
  const overall = blocking.length === 0 && allDocsRequiredOk;
  if (!overall)
    notes.push(
      "All configured pre-submission checks must pass before submission. This does not guarantee departmental approval.",
    );
  return { categories, overall, notes };
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}