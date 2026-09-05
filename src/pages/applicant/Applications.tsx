import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PageHeader, Section, StatusBadge, EmptyState, Loading, KV, Notice } from "@/components/app/ui";
import { DataTable, Column } from "@/components/app/data";
import { Timeline, WhyApplicablePanel, ReadinessPanel, GatewayPanel, SlaIndicator } from "@/components/app/panels";
import { appStatusMeta, slaMeta, fmtDate, fmtDateTime } from "@/lib/format";
import { readErrorMessage } from "@/components/app/docs";
import { FilePlus2, Loader2, Send } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// List + start new application
// ---------------------------------------------------------------------------
export default function ApplicantApplicationsPage() {
  const apps = useQuery(api.applications.listMyApplications);
  const evalsData = useQuery(api.organizations.evalsForOrganization);
  const createApplication = useMutation(api.applications.createApplication);
  const navigate = useNavigate();
  const [creating, setCreating] = useState<string | null>(null);

  if (apps === undefined || evalsData === undefined) return <Loading />;

  const profile = evalsData.profile;
  const liveRuleIds = new Set(apps.filter((a) => !["APPROVED", "REJECTED"].includes(a.status)).map((a) => a.ruleId));
  const startable = evalsData.evals.filter(
    (e) => ["APPLICABLE", "CONDITIONAL"].includes(e.status) && !liveRuleIds.has(e.ruleId),
  );

  const columns: Column<(typeof apps)[number]>[] = [
    { key: "approval", header: "Approval", cell: (a) => (<div><p className="font-medium">{a.approvalTitle}</p><p className="text-[11px] text-muted-foreground">{a.authority}</p></div>) },
    { key: "created", header: "Created", cell: (a) => fmtDate(a._creationTime) },
    { key: "status", header: "Status", cell: (a) => <StatusBadge meta={appStatusMeta[a.status]} /> },
    { key: "sla", header: "SLA", cell: (a) => (a.sla && a.sla.status !== "NOT_STARTED" ? <StatusBadge meta={slaMeta[a.sla.status]} /> : <span className="text-[11px] text-muted-foreground">Not started</span>) },
    { key: "ref", header: "Govt. reference", cell: (a) => (a.governmentRefId ? <span className="font-mono text-[11px]">{a.governmentRefId}</span> : <span className="text-muted-foreground">—</span>) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My applications"
        description="Applications follow the configured workflow state machine. Every transition is recorded and audited."
      />

      {!profile && (
        <Notice tone="warning" title="Business profile required">
          Evaluate your business profile against verified regulatory rules before starting applications.{" "}
          <button onClick={() => navigate("/applicant/profile")} className="underline">Configure profile</button>
        </Notice>
      )}

      <Section title="Start an application" description="Based on deterministic evaluation of your current business profile.">
        {!profile ? (
          <div className="p-4">
            <EmptyState title="No business profile yet" description="Configure state, district, sector and project details to compute applicable approvals." />
          </div>
        ) : startable.length === 0 ? (
          <p className="px-4 py-6 text-xs text-muted-foreground">
            No applicable approvals are waiting to be started — all applicable approvals either have an active application or are already decided.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {startable.map((e) => (
              <li key={e.ruleId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{e.title}</p>
                  <p className="text-[11px] text-muted-foreground">{e.ruleId} · {e.authority}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 text-xs"
                  disabled={creating !== null}
                  onClick={async () => {
                    setCreating(e.ruleId);
                    try {
                      const r = (await createApplication({ ruleId: e.ruleId })) as { appId: string };
                      toast.success("Application created as draft.");
                      navigate(`/applicant/applications/${r.appId}`);
                    } catch (err) {
                      toast.error(readErrorMessage(err));
                      setCreating(null);
                    }
                  }}
                >
                  {creating === e.ruleId ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <FilePlus2 className="mr-1 size-3.5" />}
                  Start
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="All applications">
        {apps.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No applications yet" description="Start one from the list above once your profile is configured." />
          </div>
        ) : (
          <DataTable columns={columns} rows={apps} keyOf={(a) => a._id} dense onRowClick={(a) => navigate(`/applicant/applications/${a._id}`)} />
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------
const EVENT_TITLES: Record<string, string> = {
  APPLICATION_CREATED: "Application created",
  DOCUMENTS_UPLOADED: "Documents uploaded",
  APPLICATION_MARKED_READY: "Marked ready for submission",
  APPLICATION_SUBMITTED: "Submitted to authority",
  REVIEW_STARTED: "Under review",
  QUERY_RAISED: "Query raised",
  QUERY_ANSWERED: "Applicant response submitted",
  QUERY_RESOLVED: "Query resolved",
  INSPECTION_REQUIRED: "Inspection required",
  INSPECTION_SCHEDULED: "Inspection scheduled",
  INSPECTION_COMPLETED: "Inspection completed",
  DECISION_PENDING: "Decision pending",
  APPLICATION_APPROVED: "Approved",
  APPLICATION_REJECTED: "Rejected",
  APPLICATION_WITHDRAWN: "Withdrawn",
};

export function ApplicantApplicationDetail() {
  const { applicationId } = useParams();
  const detail = useQuery(api.applications.applicationDetail, {
    applicationId: applicationId as Id<"applications">,
  });
  const compliance = useQuery(api.compliance.listCompliance);
  const markReady = useMutation(api.applications.markReadyForSubmission);
  const withdraw = useMutation(api.applications.withdrawApplication);
  const submit = useMutation(api.gateway.submitApplication);
  const respond = useMutation(api.queries.respondToQuery);
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<string>("");

  const app = detail?.application;
  const items = useMemo(() => {
    if (!detail) return [];
    return detail.events
      .filter((e) => e.visibility === "APPLICANT_VISIBLE")
      .map((e) => ({
        id: e._id,
        title: EVENT_TITLES[e.eventType] ?? e.eventType.replace(/_/g, " "),
        detail: e.detail,
        at: e.occurredAt,
        actor: e.actorName,
      }));
  }, [detail]);

  if (!detail || compliance === undefined) return <Loading />;
  if (!app) return <EmptyState title="Application not found" />;

  const orgDocs = detail.organizationDocuments ?? detail.documents;
  const requiredDocumentKeys = new Set(detail.rule?.requiredDocuments ?? []);
  const appDocs = orgDocs.filter(
    (d) => d.applicationId === app._id || (d.documentType && requiredDocumentKeys.has(d.documentType)),
  );
  const openQuery = detail.queries.find((q) => ["OPEN", "RESPONDED", "REOPENED"].includes(q.status));

  const canSubmit = app.status === "READY_FOR_SUBMISSION";
  const canMarkReady = app.status === "DRAFT" && !!detail.readiness?.overall;
  const respondBusy = busy === "respond";

  const submitResponse = async (queryId: Id<"queries">) => {
    if (responseText.trim().length < 5) {
      toast.error("Write a response before submitting.");
      return;
    }
    setBusy("respond");
    try {
      await respond({ queryId, response: responseText.trim() });
      setResponseText("");
      toast.success("Response submitted to the department.");
    } catch (err) {
      toast.error(readErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/applicant/applications")} className="text-xs text-muted-foreground hover:text-foreground">
        ← Back to applications
      </button>

      <PageHeader
        title={app.approvalTitle}
        description={`${app.ruleId} · ${app.authority} · ${fmtDate(app._creationTime)}`}
      >
        <StatusBadge meta={appStatusMeta[app.status]} />
        {app.governmentRefId && <span className="rounded-sm border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{app.governmentRefId}</span>}
      </PageHeader>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {app.status === "DRAFT" && !detail.readiness?.overall && detail.readiness && (
            <Notice tone="warning" title="Pre-submission checks are incomplete">
              Review the readiness panel and complete required documents and information first.
            </Notice>
          )}

          <Section title="Submission readiness" description="Deterministic checks — no approval guarantee.">
            <div className="p-4">
              <ReadinessPanel readiness={detail.readiness} />
            </div>
            <div className="flex flex-wrap gap-2 border-t px-4 py-3">
              {canMarkReady && (
                <Button size="sm" disabled={busy === "ready"} onClick={async () => {
                  setBusy("ready");
                  try { await markReady({ applicationId: app._id }); toast.success("Application is ready for submission."); }
                  catch (err) { toast.error(readErrorMessage(err)); }
                  finally { setBusy(null); }
                }}>
                  {busy === "ready" && <Loader2 className="mr-1 size-3.5 animate-spin" />}
                  Mark ready for submission
                </Button>
              )}
              {canSubmit && (
                <Button size="sm" disabled={busy === "submit"} onClick={async () => {
                  setBusy("submit");
                  try { await submit({ applicationId: app._id }); toast.success("Submitted through the prototype government gateway."); }
                  catch (err) { toast.error(readErrorMessage(err)); }
                  finally { setBusy(null); }
                }}>
                  {busy === "submit" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Send className="mr-1 size-3.5" />}
                  Submit to government gateway
                </Button>
              )}
              {app.status !== "APPROVED" && app.status !== "REJECTED" && (
                <Button variant="ghost" size="sm" disabled={busy === "withdraw"} className="text-muted-foreground hover:text-red-600"
                  onClick={async () => {
                    if (!window.confirm("Withdraw this application? The action is recorded in the audit trail.")) return;
                    setBusy("withdraw");
                    try { await withdraw({ applicationId: app._id }); toast.success("Application withdrawn."); }
                    catch (err) { toast.error(readErrorMessage(err)); }
                    finally { setBusy(null); }
                  }}>
                  Withdraw
                </Button>
              )}
            </div>
          </Section>

          <Section title="Government gateway" description="Where this application stands with the authority.">
            <div className="p-4">
              <GatewayPanel
                submission={detail.governmentSubmission}
                applicationStatus={app.status}
                readiness={detail.readiness}
                authority={app.authority}
                ruleId={app.ruleId}
                documentCount={appDocs.length}
              />
            </div>
          </Section>

          <Section title="Documents for this approval">
            {appDocs.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground">
                No matching documents in the organization vault. Upload the required documents from the Document Vault.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {appDocs.map((d) => (
                  <li key={d._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{d.fileName}</p>
                      <p className="text-[11px] text-muted-foreground">{d.documentType ?? "Unclassified"} · {fmtDate(d._creationTime)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge meta={{ label: d.fieldsConfirmed ? "Fields confirmed" : "Awaiting confirmation", tone: d.fieldsConfirmed ? "success" : "warning" }} />
                      <StatusBadge meta={{ label: d.validationStatus, tone: d.validationStatus === "PASSED" ? "success" : d.validationStatus === "FAILED" ? "danger" : "muted" }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Department queries">
            {detail.queries.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground">No queries raised for this application.</p>
            ) : (
              <div className="space-y-4 p-4">
                {detail.queries.map((q) => (
                  <div key={q._id} className="rounded-md border">
                    <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
                      <p className="text-[13px] font-medium">{q.title}</p>
                      <StatusBadge meta={{ label: q.status, tone: q.status === "RESOLVED" ? "success" : q.status === "RESPONDED" ? "info" : "warning" }} />
                    </div>
                    <div className="space-y-2 px-3 py-2.5 text-xs leading-5">
                      <p className="text-muted-foreground">{q.message}</p>
                      {q.responseDeadline && <p className="text-[11px] text-amber-700">Response requested by {fmtDate(q.responseDeadline)}</p>}
                      {q.responses.map((r) => (
                        <div key={r._id} className="rounded-sm bg-muted/50 px-3 py-2">
                          <p className="text-[13px]">{r.response}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">Responded by applicant · {fmtDateTime(r.respondedAt)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {openQuery && (
                  <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/40 p-3">
                    <Label htmlFor="resp" className="text-xs font-medium">Respond to the open query</Label>
                    <Textarea id="resp" value={responseText} onChange={(e) => setResponseText(e.target.value)} rows={3}
                      placeholder="Provide the requested information. Upload supporting documents in the Document Vault first." />
                    <Button size="sm" disabled={respondBusy} onClick={() => void submitResponse(openQuery._id)}>
                      {respondBusy && <Loader2 className="mr-1 size-3.5 animate-spin" />}
                      Submit response
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Section>

          {app.status === "APPROVED" && (
            <Section title="Post-approval compliance" description="Generated from the verified rule that governs this approval.">
              {compliance.obligations.filter((o) => o.applicationId === app._id).length === 0 ? (
                <p className="px-4 py-6 text-xs text-muted-foreground">No configured obligations for this approval.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {compliance.obligations.filter((o) => o.applicationId === app._id).map((o) => (
                    <li key={o._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div>
                        <p className="text-[13px] font-medium">{o.title}</p>
                        <p className="text-[11px] text-muted-foreground">{o.type} · {o.authority} · due {fmtDate(o.dueDate)}</p>
                      </div>
                      <StatusBadge meta={{ label: o.status, tone: o.status === "COMPLETED" ? "success" : o.status === "OVERDUE" ? "danger" : o.status === "DUE_SOON" ? "warning" : "info" }} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Why does this apply?" padded>
            <WhyApplicablePanel rule={detail.rule ?? undefined} triggers={detail.evalInfo?.triggers ?? undefined} />
          </Section>

          {detail.sla ? (
            <Section title="SLA" padded>
              <SlaIndicator sla={detail.sla} />
              <p className="mt-3 text-[11px] text-muted-foreground">
                SLA is measured in working days against the configured department calendar. Applicant-waiting
                states pause the official clock.
              </p>
            </Section>
          ) : (
            <Section title="SLA" padded>
              <SlaIndicator sla={null} />
            </Section>
          )}

          <Section title="Application timeline" description="Actual recorded events for this application." padded>
            <Timeline items={items} emptyLabel="No timeline events recorded." />
          </Section>
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 px-4 py-3 text-[11px] leading-5 text-muted-foreground">
        <p className="font-medium text-foreground">Authority decision</p>
        Final approval remains with the competent government authority. ApprovalArc coordinates the journey
        and tracks the configured SLA — it does not make or guarantee the approval decision.
      </div>
    </div>
  );
}
