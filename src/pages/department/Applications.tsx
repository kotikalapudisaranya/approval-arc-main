import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PageHeader, Section, StatusBadge, EmptyState, Loading, KV, Notice } from "@/components/app/ui";
import { DataTable, Column } from "@/components/app/data";
import { Timeline, WhyApplicablePanel, ReadinessPanel, GatewayPanel, SlaIndicator } from "@/components/app/panels";
import { appStatusMeta as appMeta, slaMeta as slaMetaDirect, fmtDate as fmtDateDirect, fmtDateTime as fmtDateTimeDirect, queryStatusMeta as qMeta, inspectionStatusMeta as iMeta } from "@/lib/format";
import { readErrorMessage } from "@/components/app/docs";
import { ArrowLeft, CheckCircle, FileWarning, Loader2, Search, Send, XCircle } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

const EVENT_TITLES: Record<string, string> = {
  APPLICATION_CREATED: "Application created",
  APPLICATION_MARKED_READY: "Marked ready for submission",
  APPLICATION_SUBMITTED: "Submitted to authority",
  REVIEW_STARTED: "Review started",
  QUERY_RAISED: "Query raised",
  QUERY_ANSWERED: "Applicant response",
  QUERY_RESOLVED: "Query resolved",
  INSPECTION_REQUIRED: "Inspection required",
  INSPECTION_SCHEDULED: "Inspection scheduled",
  INSPECTION_COMPLETED: "Inspection completed",
  DECISION_PENDING: "Decision pending",
  APPLICATION_APPROVED: "Approved",
  APPLICATION_REJECTED: "Rejected",
  APPLICATION_WITHDRAWN: "Withdrawn",
};

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------
export default function DepartmentApplicationsPage() {
  const apps = useQuery(api.applications.listDepartmentApplications, {});
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("");

  if (apps === undefined) return <Loading />;

  const filtered = statusFilter ? apps.filter((a) => a.status === statusFilter) : apps;

  const columns: Column<(typeof apps)[number]>[] = [
    { key: "business", header: "Business", cell: (a) => (<div><p className="font-medium">{a.businessName}</p><p className="text-[11px] text-muted-foreground">{a.sector} · {a.district}</p></div>) },
    { key: "approval", header: "Approval", cell: (a) => (<div><p>{a.approvalTitle}</p><p className="text-[11px] text-muted-foreground">{a.ruleId}</p></div>) },
    { key: "submitted", header: "Submitted", cell: (a) => fmtDateDirect(a.submittedAt) },
    { key: "status", header: "Status", cell: (a) => <StatusBadge meta={appMeta[a.status]} /> },
    { key: "sla", header: "SLA", cell: (a) => a.sla && a.sla.status !== "NOT_STARTED" ? <StatusBadge meta={slaMetaDirect[a.sla.status]} /> : <span className="text-[11px] text-muted-foreground">—</span> },
    { key: "ref", header: "Govt. ref", cell: (a) => a.governmentRefId ? <span className="font-mono text-[11px]">{a.governmentRefId}</span> : <span className="text-muted-foreground">—</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Application queue" description={`${filtered.length} application${filtered.length !== 1 ? "s" : ""} ${statusFilter ? `with status "${statusFilter}"` : "total"}.`} />
      <div className="flex flex-wrap gap-2">
        {["", "SUBMITTED", "UNDER_REVIEW", "QUERY_RAISED", "WAITING_FOR_APPLICANT", "RESUBMITTED", "INSPECTION_REQUIRED", "DECISION_PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-sm border px-2.5 py-1 text-[11px] font-medium transition-colors ${statusFilter === s ? "bg-neutral-900 text-white border-neutral-900" : "hover:bg-muted"}`}>
            {s || "All"}
          </button>
        ))}
      </div>
      <DataTable columns={columns} rows={filtered} keyOf={(a) => a._id} dense onRowClick={(a) => navigate(`/department/applications/${a._id}`)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------
export function DepartmentApplicationReview() {
  const { applicationId } = useParams();
  const detail = useQuery(api.applications.applicationDetail, { applicationId: applicationId as Id<"applications"> });
  const startReview = useMutation(api.applications.startReview);
  const moveToDecision = useMutation(api.applications.moveToDecisionPending);
  const decide = useMutation(api.applications.decideApplication);
  const raiseQuery = useMutation(api.queries.raiseQuery);
  const resolveQuery = useMutation(api.queries.resolveQuery);
  const requireInspection = useMutation(api.inspections.requireInspection);
  const completeInspection = useMutation(api.inspections.completeInspection);
  const scheduleInspection = useMutation(api.inspections.scheduleInspection);
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  // Query form
  const [queryTitle, setQueryTitle] = useState("");
  const [queryMessage, setQueryMessage] = useState("");
  const [queryReason, setQueryReason] = useState("");
  const [queryRequestedInfo, setQueryRequestedInfo] = useState("");

  // Inspection form
  const [inspType, setInspType] = useState("");
  const [inspPurpose, setInspPurpose] = useState("");
  const [inspLocation, setInspLocation] = useState("");
  const [inspDate, setInspDate] = useState("");
  const [inspInspector, setInspInspector] = useState("");

  // Reject form
  const [rejectReason, setRejectReason] = useState("");

  const items = useMemo(() => {
    if (!detail) return [];
    return detail.events.map((e) => ({
      id: e._id,
      title: EVENT_TITLES[e.eventType] ?? e.eventType.replace(/_/g, " "),
      detail: e.detail,
      at: e.occurredAt,
      actor: e.actorName,
    }));
  }, [detail]);

  if (!detail) return <Loading />;
  if (!detail.application) return <EmptyState title="Application not found" />;

  const { application: app, rule, evalInfo, queries, inspections, governmentSubmission, sla, readiness } = detail;
  const appDocs = (detail.organizationDocuments ?? detail.documents).filter(
    (d) => d.applicationId === app._id || (d.documentType && rule?.requiredDocuments?.includes(d.documentType)),
  );

  const action = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      toast.success(`${label} — action recorded.`);
    } catch (err) {
      toast.error(readErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/department/applications")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> Back to queue
      </button>

      <PageHeader title={app.approvalTitle} description={`${app.ruleId} · ${detail.organization?.name}`}>
        <StatusBadge meta={appMeta[app.status]} />
      </PageHeader>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          {/* Officer actions */}
          <Section title="Actions" description="Available workflow transitions for the current state.">
            <div className="flex flex-wrap gap-2 p-4">
              {app.status === "SUBMITTED" && (
                <Button size="sm" disabled={!!busy} onClick={() => action("start review", () => startReview({ applicationId: app._id }))}>
                  {busy === "start review" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Search className="mr-1 size-3.5" />}
                  Start review
                </Button>
              )}
              {["UNDER_REVIEW", "QUERY_RAISED", "WAITING_FOR_APPLICANT", "INSPECTION_REQUIRED", "RESUBMITTED"].includes(app.status) && (
                <Button size="sm" disabled={!!busy} onClick={() => action("move to decision pending", () => moveToDecision({ applicationId: app._id }))}>
                  Move to decision pending
                </Button>
              )}
              {app.status === "DECISION_PENDING" && (
                <>
                  <Button size="sm" disabled={!!busy} onClick={() => action("approve", () => decide({ applicationId: app._id, decision: "APPROVED" }))}>
                    <CheckCircle className="mr-1 size-3.5" /> Approve
                  </Button>
                  <Button variant="outline" size="sm" disabled={!!busy || !rejectReason} onClick={() => action("reject", () => decide({ applicationId: app._id, decision: "REJECTED", reason: rejectReason }))}>
                    <XCircle className="mr-1 size-3.5" /> Reject
                  </Button>
                </>
              )}
            </div>
            {app.status === "DECISION_PENDING" && (
              <div className="border-t px-4 py-3">
                <Label className="text-xs text-muted-foreground">Rejection reason (required for rejection)</Label>
                <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} className="mt-1 text-[13px]" placeholder="Reason for rejection..." />
              </div>
            )}
          </Section>

          {/* Timeline */}
          <Section title="Application timeline" padded>
            <div className="p-4">
              <Timeline items={items} />
            </div>
          </Section>

          {/* Documents */}
          <Section title="Documents" description={`${appDocs.length} document${appDocs.length !== 1 ? "s" : ""} attached.`}>
            {appDocs.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground">No documents attached.</p>
            ) : (
              <ul className="divide-y divide-border">
                {appDocs.map((d) => (
                  <li key={d._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{d.fileName}</p>
                      <p className="text-[11px] text-muted-foreground">{d.documentType} · {fmtDateDirect(d._creationTime)}</p>
                    </div>
                    <StatusBadge meta={{ label: d.validationStatus, tone: d.validationStatus === "PASSED" ? "success" : "warning" }} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Queries */}
          <Section title="Queries" description={`${queries.length} quer${queries.length !== 1 ? "ies" : "y"} raised.`}>
            {queries.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground">No queries raised for this application.</p>
            ) : (
              <div className="space-y-3 p-4">
                {queries.map((q) => (
                  <div key={q._id} className="rounded-md border">
                    <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
                      <p className="text-[13px] font-medium">{q.title}</p>
                      <StatusBadge meta={qMeta[q.status]} />
                    </div>
                    <div className="space-y-2 px-3 py-2.5 text-xs leading-5">
                      <p className="text-muted-foreground">{q.message}</p>
                      {q.responses.length > 0 && q.responses.map((r) => (
                        <div key={r._id} className="rounded-sm bg-muted/50 px-3 py-2">
                          <p className="text-[13px]">{r.response}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">Applicant response · {fmtDateTimeDirect(r.respondedAt)}</p>
                        </div>
                      ))}
                      {q.status === "RESPONDED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={!!busy}
                          onClick={() => action("resolve query", () => resolveQuery({ queryId: q._id }))}
                        >
                          Mark query resolved
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Raise query form */}
                {["UNDER_REVIEW", "QUERY_RAISED", "WAITING_FOR_APPLICANT", "RESUBMITTED"].includes(app.status) && (
                  <div className="rounded-md border border-amber-200 bg-amber-50/40 p-3">
                    <p className="mb-2 text-xs font-medium">Raise a query</p>
                    <div className="space-y-2">
                      <Input value={queryTitle} onChange={(e) => setQueryTitle(e.target.value)} placeholder="Query title" className="h-8 text-[13px]" />
                      <Textarea value={queryMessage} onChange={(e) => setQueryMessage(e.target.value)} rows={2} placeholder="Applicant-visible message (min 10 chars)" className="text-[13px]" />
                      <Input value={queryReason} onChange={(e) => setQueryReason(e.target.value)} placeholder="Internal reason / reason for query" className="h-8 text-[13px]" />
                      <Input value={queryRequestedInfo} onChange={(e) => setQueryRequestedInfo(e.target.value)} placeholder="Requested information or document" className="h-8 text-[13px]" />
                      <Button size="sm" disabled={busy === "raise query" || queryTitle.length < 3 || queryMessage.length < 10} onClick={() => action("raise query", () => raiseQuery({
                        applicationId: app._id, title: queryTitle, message: queryMessage, reason: queryReason || queryTitle, requestedInformation: queryRequestedInfo || queryMessage,
                      }))}>
                        {busy === "raise query" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Send className="mr-1 size-3.5" />}
                        Raise query
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Inspections */}
          <Section title="Inspections" description={`${inspections.length} inspection${inspections.length !== 1 ? "s" : ""} recorded.`}>
            {inspections.length > 0 && (
              <ul className="divide-y divide-border">
                {inspections.map((ins) => (
                  <li key={ins._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium">{ins.type}</p>
                      <p className="text-[11px] text-muted-foreground">{ins.purpose} · {ins.location ?? "—"}</p>
                    </div>
                    <StatusBadge meta={iMeta[ins.status]} />
                  </li>
                ))}
              </ul>
            )}

            {/* Require inspection form */}
            {["UNDER_REVIEW", "QUERY_RAISED", "RESUBMITTED", "DECISION_PENDING"].includes(app.status) && (
              <div className="border-t p-4">
                <p className="mb-2 text-xs font-medium">Schedule inspection</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={inspType} onChange={(e) => setInspType(e.target.value)} placeholder="Type (e.g. Premises)" className="h-8 text-[13px]" />
                  <Input value={inspPurpose} onChange={(e) => setInspPurpose(e.target.value)} placeholder="Purpose" className="h-8 text-[13px]" />
                  <Input value={inspLocation} onChange={(e) => setInspLocation(e.target.value)} placeholder="Location" className="h-8 text-[13px]" />
                  <Input value={inspInspector} onChange={(e) => setInspInspector(e.target.value)} placeholder="Inspector name" className="h-8 text-[13px]" />
                  <Input type="date" value={inspDate} onChange={(e) => setInspDate(e.target.value)} className="h-8 text-[13px]" />
                  <Button size="sm" disabled={busy === "require inspection" || inspType.length < 3 || inspPurpose.length < 3} onClick={async () => {
                    setBusy("require inspection");
                    try {
                      const r = (await requireInspection({ applicationId: app._id, type: inspType, purpose: inspPurpose, location: inspLocation || undefined })) as { inspectionId: string };
                      if (inspDate && inspInspector) {
                        await scheduleInspection({ inspectionId: r.inspectionId as never, scheduledDate: new Date(inspDate).getTime(), inspectorName: inspInspector, location: inspLocation || undefined });
                      }
                      toast.success("Inspection scheduled.");
                    } catch (err) { toast.error(readErrorMessage(err)); } finally { setBusy(null); }
                  }}>
                    {busy === "require inspection" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
                    Schedule
                  </Button>
                </div>
              </div>
            )}

            {/* Complete inspection */}
            {inspections.some((ins) => ins.status === "SCHEDULED") && (
              <div className="border-t p-4">
                {inspections.filter((ins) => ins.status === "SCHEDULED").map((ins) => (
                  <div key={ins._id} className="flex items-center justify-between gap-2">
                    <p className="text-xs">{ins.type} · {ins.inspectorName} · {fmtDateDirect(ins.scheduledDate)}</p>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => action("complete inspection", () => completeInspection({ inspectionId: ins._id, outcome: "PASSED", outcomeNotes: "Inspection passed." }))}>
                        Pass
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-red-700" onClick={() => action("complete inspection", () => completeInspection({ inspectionId: ins._id, outcome: "FAILED", outcomeNotes: "Inspection failed; corrective action required." }))}>
                        Fail
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Why does this apply?" padded>
            <WhyApplicablePanel rule={rule ?? undefined} triggers={evalInfo?.triggers ?? undefined} />
          </Section>

          <Section title="SLA" padded>
            <SlaIndicator sla={sla} />
          </Section>

          <Section title="Gateway" padded>
            <GatewayPanel
              submission={governmentSubmission}
              applicationStatus={app.status}
              readiness={readiness}
              authority={app.authority}
              ruleId={app.ruleId}
              documentCount={appDocs.length}
            />
          </Section>

          <Section title="Readiness" padded>
            <ReadinessPanel readiness={readiness} />
          </Section>
        </div>
      </div>
    </div>
  );
}
