// Formatting + status metadata helpers (shared by applicant/department/admin UI).

export function fmtDate(ms?: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(ms?: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function fmtINR(lakh: number | null | undefined): string {
  if (lakh === null || lakh === undefined) return "—";
  if (lakh >= 100) {
    const crore = lakh / 100;
    return `₹${crore.toLocaleString("en-IN", { maximumFractionDigits: 2 })} crore`;
  }
  return `₹${lakh.toLocaleString("en-IN")} lakh`;
}

export function timeAgo(ms: number | null | undefined): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "muted";

export const toneClasses: Record<Tone, string> = {
  neutral: "bg-neutral-100 text-neutral-700 border-neutral-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  muted: "bg-muted/60 text-muted-foreground border-border",
};

const dotTone: Record<Tone, string> = {
  neutral: "bg-neutral-400",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
  muted: "bg-neutral-300",
};

export { dotTone };

export type StatusMeta = { label: string; tone: Tone };

export const appStatusMeta: Record<string, StatusMeta> = {
  DRAFT: { label: "Draft", tone: "muted" },
  READY_FOR_SUBMISSION: { label: "Ready to submit", tone: "info" },
  SUBMITTED: { label: "Submitted", tone: "info" },
  UNDER_REVIEW: { label: "Under review", tone: "info" },
  QUERY_RAISED: { label: "Query raised", tone: "warning" },
  WAITING_FOR_APPLICANT: { label: "Awaiting applicant", tone: "warning" },
  RESUBMITTED: { label: "Resubmitted", tone: "info" },
  INSPECTION_REQUIRED: { label: "Inspection required", tone: "warning" },
  INSPECTION_SCHEDULED: { label: "Inspection scheduled", tone: "warning" },
  DECISION_PENDING: { label: "Decision pending", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

export const evalStatusMeta: Record<string, StatusMeta> = {
  APPLICABLE: { label: "Applicable", tone: "success" },
  NOT_APPLICABLE: { label: "Not applicable", tone: "muted" },
  CONDITIONAL: { label: "Conditional", tone: "warning" },
  READY: { label: "Ready", tone: "info" },
  BLOCKED: { label: "Blocked", tone: "danger" },
};

export const docStatusMeta: Record<string, StatusMeta> = {
  PENDING: { label: "Pending", tone: "muted" },
  PASSED: { label: "Validated", tone: "success" },
  PARTIAL: { label: "Partial", tone: "warning" },
  FAILED: { label: "Failed", tone: "danger" },
};

export const verificationMeta: Record<string, StatusMeta> = {
  VERIFIED: { label: "Verified", tone: "success" },
  NEEDS_REVIEW: { label: "Needs review", tone: "warning" },
  DUPLICATE: { label: "Duplicate", tone: "danger" },
  VERIFICATION_FAILED: { label: "Verification failed", tone: "danger" },
  AUTHENTICITY_UNAVAILABLE: { label: "Verification unavailable", tone: "muted" },
};

export const extractionMeta: Record<string, StatusMeta> = {
  PENDING: { label: "Pending", tone: "muted" },
  EXTRACTED: { label: "Text extracted", tone: "success" },
  EXTRACTION_FAILED: { label: "Extraction failed", tone: "danger" },
  NO_OCR: { label: "No OCR available", tone: "warning" },
  MANUAL_ENTRY: { label: "Manual entry", tone: "info" },
};

export const slaMeta: Record<string, StatusMeta> = {
  ON_TRACK: { label: "On track", tone: "success" },
  AT_RISK: { label: "At risk", tone: "warning" },
  BREACHED: { label: "Breached", tone: "danger" },
  NOT_STARTED: { label: "Not started", tone: "muted" },
};

export const queryStatusMeta: Record<string, StatusMeta> = {
  OPEN: { label: "Open", tone: "warning" },
  RESPONDED: { label: "Responded", tone: "info" },
  RESOLVED: { label: "Resolved", tone: "success" },
  REOPENED: { label: "Reopened", tone: "warning" },
};

export const inspectionStatusMeta: Record<string, StatusMeta> = {
  REQUIRED: { label: "Required", tone: "warning" },
  SCHEDULED: { label: "Scheduled", tone: "info" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
  RESCHEDULED: { label: "Rescheduled", tone: "warning" },
};

export const complianceMeta: Record<string, StatusMeta> = {
  UPCOMING: { label: "Upcoming", tone: "info" },
  DUE_SOON: { label: "Due soon", tone: "warning" },
  OVERDUE: { label: "Overdue", tone: "danger" },
  COMPLETED: { label: "Completed", tone: "success" },
};

export const schemeMatchMeta: Record<string, StatusMeta> = {
  CRITERIA_MATCH: { label: "Criteria match", tone: "success" },
  POTENTIAL_MATCH: { label: "Potential match", tone: "warning" },
  NOT_MATCHED: { label: "Not matched", tone: "muted" },
};

export const schemeStatusMeta: Record<string, StatusMeta> = {
  ACTIVE: { label: "Active", tone: "success" },
  CLOSING_SOON: { label: "Closing soon", tone: "warning" },
  UPCOMING: { label: "Upcoming", tone: "info" },
  CLOSED: { label: "Closed", tone: "muted" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
  HISTORICAL: { label: "Historical", tone: "muted" },
};

export const ruleStatusMeta: Record<string, StatusMeta> = {
  DRAFT: { label: "Draft", tone: "muted" },
  PENDING_VERIFICATION: { label: "Pending verification", tone: "warning" },
  ACTIVE: { label: "Active", tone: "success" },
  SUPERSEDED: { label: "Superseded", tone: "muted" },
  EXPIRED: { label: "Expired", tone: "danger" },
};

export const gatewayStatusMeta: Record<string, StatusMeta> = {
  RECEIVED: { label: "Received", tone: "info" },
  UNDER_REVIEW: { label: "Under review", tone: "info" },
  QUERY_RAISED: { label: "Query raised", tone: "warning" },
  INSPECTION_REQUIRED: { label: "Inspection required", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

export const approvalTypeMeta: Record<string, StatusMeta> = {
  REGISTRATION: { label: "Registration", tone: "neutral" },
  LICENCE: { label: "Licence", tone: "neutral" },
  CONSENT: { label: "Consent", tone: "neutral" },
  NOC: { label: "NOC", tone: "neutral" },
  PERMISSION: { label: "Permission", tone: "neutral" },
  CERTIFICATE: { label: "Certificate", tone: "neutral" },
  AUTHORISATION: { label: "Authorisation", tone: "neutral" },
};