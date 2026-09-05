import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { StatusBadge, Section, Notice, EmptyState } from "./ui";
import { CheckCircle2, Circle, Dot, Loader2, Lock } from "lucide-react";
import { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Timeline (application events / activity)
// ---------------------------------------------------------------------------
export type TimelineItem = {
  id?: string;
  title: string;
  detail?: string;
  at: number;
  actor?: string;
  current?: boolean;
  icon?: ReactNode;
  muted?: boolean;
};

export function Timeline({
  items,
  emptyLabel = "No events recorded yet.",
}: {
  items: TimelineItem[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyLabel} />;
  }
  return (
    <ol className="relative">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <li key={it.id ?? `${it.title}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && <span className="absolute top-5 left-[7px] h-[calc(100%-1.25rem)] w-px bg-border" />}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex size-[15px] shrink-0 items-center justify-center rounded-full border",
                it.current ? "border-neutral-900 bg-neutral-900" : "border-border bg-background",
              )}
            >
              {it.icon ??
                (it.current ? (
                  <span className="size-1.5 rounded-full bg-white" />
                ) : it.muted ? (
                  <Dot />
                ) : (
                  <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                ))}
            </span>
            <div className="min-w-0 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-[13px] font-medium">{it.title}</p>
                <p className="text-[11px] text-muted-foreground">{fmtDateTime(it.at)}</p>
              </div>
              {it.detail && <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{it.detail}</p>}
              {it.actor && <p className="mt-0.5 text-[11px] text-muted-foreground/80">By {it.actor}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Provenance / "why" panel for a rule
// ---------------------------------------------------------------------------
export type WhyPanelProps = {
  rule?: {
    ruleId?: string;
    title?: string;
    officialAuthority?: string;
    officialSource?: string;
    state?: string;
    sector?: string;
    activity?: string;
    version?: number;
    lastVerified?: number;
    reviewer?: string;
    publicationDate?: number;
    effectiveDate?: number;
    verificationStatus?: string;
    parallelizable?: boolean;
    slaWorkingDays?: number;
    validityDays?: number;
    renewalRules?: string;
    approvalType?: string;
  } | null;
  triggers?: { field: string; op: string; value?: unknown; matched: boolean; label?: string }[];
};

export function WhyApplicablePanel({ rule, triggers }: WhyPanelProps) {
  if (!rule) return null;
  const fieldLabel: Record<string, string> = {
    state: "Jurisdiction",
    district: "District",
    sector: "Sector",
    projectType: "Project type",
    projectStage: "Project stage",
    investment: "Investment",
    employeeCount: "Employees",
    businessType: "Business type",
  };
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Why does this apply?</p>
        <div className="mt-2 space-y-1.5">
          {triggers && triggers.length > 0 ? (
            triggers.map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-3 border-b py-1.5 text-[13px] last:border-0">
                <span className="text-muted-foreground">{fieldLabel[t.field] ?? t.field}</span>
                <span className={cn("flex items-center gap-1.5 font-medium", t.matched ? "" : "text-muted-foreground")}>
                  {t.matched ? (
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                  ) : (
                    <Circle className="size-3.5 text-muted-foreground" />
                  )}
                  {String(t.value ?? "—")}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No configured trigger conditions.</p>
          )}
        </div>
      </div>
      <RuleSourcePanel rule={rule} />
    </div>
  );
}

export function RuleSourcePanel({ rule }: { rule: WhyPanelProps["rule"] }) {
  if (!rule) return null;
  const rows: [string, string | undefined][] = [
    ["Rule version", rule.ruleId ? `${rule.ruleId} · v${rule.version ?? 1}` : undefined],
    ["Approval type", rule.approvalType],
    ["Official authority", rule.officialAuthority],
    ["Official source", rule.officialSource],
    ["Published", fmtDate(rule.publicationDate)],
    ["Effective", fmtDate(rule.effectiveDate)],
    ["Last verified", fmtDate(rule.lastVerified)],
    ["Verified by", rule.reviewer],
    ["Configured SLA", rule.slaWorkingDays ? `${rule.slaWorkingDays} working days` : undefined],
    ["Validity", rule.validityDays ? `${rule.validityDays} days` : undefined],
    ["Renewal", rule.renewalRules],
  ];
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Verified source & provenance</p>
      <dl className="divide-y divide-border/60 text-[12px]">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
      </dl>
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground/80">
        Configured rule for demo/prototype purposes. Final approval remains with the competent government authority.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SLA indicator
// ---------------------------------------------------------------------------
export function SlaIndicator({
  sla,
}: {
  sla?: {
    status: string;
    slaWorkingDays: number;
    officialElapsedWorkingDays: number;
    applicantWaitWorkingDays: number;
    grossWorkingDays: number;
    remainingWorkingDays: number;
    calendarName?: string;
    note?: string;
  } | null;
}) {
  if (!sla || sla.status === "NOT_STARTED") {
    return <p className="text-xs text-muted-foreground">SLA clock starts on submission.</p>;
  }
  const pct = Math.min(100, Math.round((sla.officialElapsedWorkingDays / Math.max(1, sla.slaWorkingDays)) * 100));
  const barColor =
    sla.status === "BREACHED" ? "bg-red-500" : sla.status === "AT_RISK" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <StatusBadge meta={{ label: sla.status === "BREACHED" ? "Breached" : sla.status === "AT_RISK" ? "At risk" : "On track", tone: sla.status === "BREACHED" ? "danger" : sla.status === "AT_RISK" ? "warning" : "success" }} dot />
        <span className="text-muted-foreground">{sla.remainingWorkingDays} working days remaining</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] leading-4 text-muted-foreground">
        {sla.officialElapsedWorkingDays} of {sla.slaWorkingDays} working days elapsed · {sla.applicantWaitWorkingDays} working
        days paused awaiting applicant{sla.calendarName ? ` · ${sla.calendarName}` : ""}
      </p>
      {sla.note && <p className="text-[11px] text-muted-foreground/70">{sla.note}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submission readiness
// ---------------------------------------------------------------------------
export function ReadinessPanel({
  readiness,
}: {
  readiness?: {
    categories: { key: string; label: string; required: number; passed: number; items: { label: string; status: string; detail: string }[] }[];
    overall: boolean;
    notes: string[];
  } | null;
}) {
  if (!readiness) {
    return <p className="text-xs text-muted-foreground">Readiness is computed once the application references a rule.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {readiness.categories.map((c) => {
          const pct = c.required === 0 ? 100 : Math.round((c.passed / c.required) * 100);
          return (
            <div key={c.key} className="rounded-md border p-3">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {c.passed}/{c.required}
                </p>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full", pct === 100 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-right text-[11px] font-medium tabular-nums">{pct}%</p>
              <ul className="mt-1 space-y-1">
                {c.items.map((it, i) => (
                  <li key={i} className="flex items-start justify-between gap-2 text-[11px] leading-4">
                    <span className="text-muted-foreground">{it.label}</span>
                    <span
                      className={cn(
                        "font-medium",
                        it.status === "PASSED" && "text-emerald-700",
                        it.status === "FAILED" && "text-red-700",
                        it.status === "WARNING" && "text-amber-700",
                      )}
                    >
                      {it.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {readiness.notes.map((n, i) => (
        <p key={i} className="text-[11px] leading-4 text-muted-foreground">
          {n}
        </p>
      ))}
      <Notice tone={readiness.overall ? "success" : "warning"} title={readiness.overall ? "All configured pre-submission checks have passed." : "Configured pre-submission checks are not complete."}>
        This does not guarantee departmental approval. Final approval remains with the competent government authority.
      </Notice>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Government gateway panel
// ---------------------------------------------------------------------------
export function GatewayPanel({
  submission,
  applicationStatus,
  readiness,
  authority,
  ruleId,
  documentCount = 0,
}: {
  submission?: {
    governmentRefId?: string;
    gatewayMode?: string;
    status?: string;
    submittedAt?: number;
    lastSyncAt?: number;
    isSimulation?: boolean;
    rawResponse?: string;
  } | null;
  applicationStatus?: string;
  readiness?: { overall: boolean; categories: { label: string; passed: number; required: number }[] } | null;
  authority?: string;
  ruleId?: string;
  documentCount?: number;
}) {
  if (!submission) {
    return (
      <div className="space-y-3">
        <Notice tone={readiness?.overall ? "success" : "warning"} title="Mock government gateway — preflight">
          {readiness?.overall
            ? "This application has passed local preflight and is ready to be packaged for the simulated authority gateway."
            : "The simulated gateway will reject this application until every blocking readiness check passes."}
        </Notice>
        <dl className="divide-y divide-border rounded-md border text-[13px]">
          <div className="flex justify-between px-3 py-2"><dt className="text-muted-foreground">Target authority</dt><dd>{authority ?? "Not configured"}</dd></div>
          <div className="flex justify-between px-3 py-2"><dt className="text-muted-foreground">Protocol</dt><dd className="font-mono text-xs">APPROVALARC-MOCK-GATEWAY/1.0</dd></div>
          <div className="flex justify-between px-3 py-2"><dt className="text-muted-foreground">Rule package</dt><dd className="font-mono text-xs">{ruleId ?? "—"}</dd></div>
          <div className="flex justify-between px-3 py-2"><dt className="text-muted-foreground">Documents staged</dt><dd>{documentCount}</dd></div>
          <div className="flex justify-between px-3 py-2"><dt className="text-muted-foreground">Current status</dt><dd>Awaiting preflight</dd></div>
        </dl>
        <p className="text-[11px] text-muted-foreground">No live government request is sent. Submission creates a traceable mock acknowledgement, reference ID, document manifest and audit event.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Notice tone="warning" title="Prototype Simulation — Not a Live Government Connection">
        This gateway is a mock for demonstration. Real integrations (OFFICIAL_API / FILE_EXCHANGE / PORTAL_HANDOFF /
        MANUAL_STATUS) can be connected behind this layer.
      </Notice>
      <dl className="divide-y divide-border rounded-md border text-[13px]">
        <div className="flex justify-between px-3 py-2">
          <dt className="text-muted-foreground">Government reference ID</dt>
          <dd className="font-mono text-xs font-medium">{submission.governmentRefId}</dd>
        </div>
        <div className="flex justify-between px-3 py-2">
          <dt className="text-muted-foreground">Gateway mode</dt>
          <dd>{submission.gatewayMode} (simulation)</dd>
        </div>
        <div className="flex justify-between px-3 py-2">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <StatusBadge meta={gatewayMeta(submission.status)} />
          </dd>
        </div>
        <div className="flex justify-between px-3 py-2">
          <dt className="text-muted-foreground">Submitted</dt>
          <dd>{fmtDateTime(submission.submittedAt)}</dd>
        </div>
        <div className="flex justify-between px-3 py-2">
          <dt className="text-muted-foreground">Last sync</dt>
          <dd>{fmtDateTime(submission.lastSyncAt)}</dd>
        </div>
        {submission.rawResponse && (
          <div className="px-3 py-2">
            <dt className="text-muted-foreground">Raw response</dt>
            <dd className="mt-1 font-mono text-[11px] text-muted-foreground">{submission.rawResponse}</dd>
          </div>
        )}
      </dl>
      <p className="text-[11px] text-muted-foreground">Application status: {applicationStatus ?? "—"}</p>
    </div>
  );
}

function gatewayMeta(status?: string) {
  const map: Record<string, { label: string; tone: "success" | "warning" | "info" | "danger" | "muted" }> = {
    RECEIVED: { label: "Received", tone: "info" },
    UNDER_REVIEW: { label: "Under review", tone: "info" },
    QUERY_RAISED: { label: "Query raised", tone: "warning" },
    INSPECTION_REQUIRED: { label: "Inspection required", tone: "warning" },
    APPROVED: { label: "Approved", tone: "success" },
    REJECTED: { label: "Rejected", tone: "danger" },
  };
  return map[status ?? ""] ?? { label: status ?? "—", tone: "muted" as const };
}

// ---------------------------------------------------------------------------
// Dependency graph (data-driven, minimal columns)
// ---------------------------------------------------------------------------
export type GraphNode = {
  ruleId: string;
  title: string;
  status: string; // eval status
  appStatus?: string | null;
  depth: number;
  blockedBy?: string[];
};

export function DependencyGraph({ nodes }: { nodes: GraphNode[] }) {
  if (nodes.length === 0) return <EmptyState title="No configured approvals." />;
  const maxDepth = Math.max(...nodes.map((n) => n.depth), 0);
  const columns: GraphNode[][] = Array.from({ length: maxDepth + 1 }, () => []);
  for (const n of nodes) columns[n.depth].push(n);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-muted-foreground">
        {["Ready to submit", "Blocked by prerequisite", "In progress", "Approved", "Conditional / not applicable"].map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full border border-neutral-300 bg-white" />
            {k}
          </span>
        ))}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col, depth) => (
          <div key={depth} className="flex w-56 shrink-0 flex-col gap-3">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              {depth === 0 ? "Start" : `Step ${depth}`}
            </p>
            {col.map((n) => (
              <GraphCard key={n.ruleId} node={n} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function GraphCard({ node }: { node: GraphNode }) {
  const tone =
    node.appStatus === "APPROVED"
      ? "border-emerald-200 bg-emerald-50/50"
      : node.appStatus && ["SUBMITTED", "UNDER_REVIEW", "DECISION_PENDING", "INSPECTION_REQUIRED", "INSPECTION_SCHEDULED", "RESUBMITTED", "QUERY_RAISED", "WAITING_FOR_APPLICANT"].includes(node.appStatus)
        ? "border-sky-200 bg-sky-50/40"
        : node.blockedBy && node.blockedBy.length > 0
          ? "border-red-200 bg-red-50/40"
          : node.status === "CONDITIONAL"
            ? "border-amber-200 bg-amber-50/40"
            : node.status === "NOT_APPLICABLE"
              ? "border-border opacity-60"
              : "border-emerald-200 bg-emerald-50/40";
  return (
    <div className={cn("rounded-md border p-2.5", tone)}>
      <p className="text-[11px] font-medium text-muted-foreground">{node.ruleId}</p>
      <p className="mt-0.5 text-xs leading-4 font-medium">{node.title}</p>
      <p className="mt-1.5 text-[11px]">
        {node.appStatus === "APPROVED" ? (
          <span className="font-medium text-emerald-700">Approved</span>
        ) : node.appStatus ? (
          <span className="font-medium text-sky-700">{appLabel(node.appStatus)}</span>
        ) : node.blockedBy && node.blockedBy.length > 0 ? (
          <span className="font-medium text-red-700">Blocked by {node.blockedBy.join(", ")}</span>
        ) : node.status === "APPLICABLE" ? (
          <span className="font-medium text-emerald-700">Ready to start</span>
        ) : node.status === "CONDITIONAL" ? (
          <span className="font-medium text-amber-700">Conditional</span>
        ) : (
          <span className="text-muted-foreground">Not applicable</span>
        )}
      </p>
    </div>
  );
}

function appLabel(s: string): string {
  const m: Record<string, string> = {
    DRAFT: "Draft",
    READY_FOR_SUBMISSION: "Ready to submit",
    SUBMITTED: "Submitted",
    UNDER_REVIEW: "Under review",
    QUERY_RAISED: "Query raised",
    WAITING_FOR_APPLICANT: "Awaiting applicant",
    RESUBMITTED: "Resubmitted",
    INSPECTION_REQUIRED: "Inspection required",
    INSPECTION_SCHEDULED: "Inspection scheduled",
    DECISION_PENDING: "Decision pending",
    REJECTED: "Rejected",
  };
  return m[s] ?? s;
}

export function LoadingDots() {
  return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
}