import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { PageHeader, Stat, StatusBadge, EmptyState, Section, Loading } from "@/components/app/ui";
import { DataTable, Column } from "@/components/app/data";
import { appStatusMeta, complianceMeta, slaMeta, verificationMeta, docStatusMeta, extractionMeta, fmtDate } from "@/lib/format";
import { AlertTriangle, ArrowRight, FileWarning, ClipboardList } from "lucide-react";

const ACTIVE = [
  "DRAFT",
  "READY_FOR_SUBMISSION",
  "SUBMITTED",
  "UNDER_REVIEW",
  "QUERY_RAISED",
  "WAITING_FOR_APPLICANT",
  "RESUBMITTED",
  "INSPECTION_REQUIRED",
  "INSPECTION_SCHEDULED",
  "DECISION_PENDING",
];

export default function ApplicantDashboard() {
  const apps = useQuery(api.applications.listMyApplications);
  const org = useQuery(api.organizations.myOrganization);
  const docs = useQuery(api.documents.myDocuments);
  const compliance = useQuery(api.compliance.listCompliance);
  const navigate = useNavigate();

  if (apps === undefined || docs === undefined || compliance === undefined || org === undefined) {
    return <Loading />;
  }

  const profile = org?.profile;
  if (!profile) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Overview of your approval journey." />
        <EmptyState
          icon={<ClipboardList className="size-6" />}
          title="Set up your business profile to begin"
          description="ApprovalArc evaluates your business profile against verified regulatory rules to determine which approvals apply. No profile — no applicability results."
          action={
            <button
              onClick={() => navigate("/applicant/profile")}
              className="rounded-sm bg-neutral-900 px-3.5 py-2 text-[13px] font-medium text-white hover:opacity-85"
            >
              Configure business profile
            </button>
          }
        />
      </div>
    );
  }

  const activeApps = apps.filter((a) => ACTIVE.includes(a.status));
  const attentionDocs = docs.filter(
    (d) => d.status === "ACTIVE" && (!d.fieldsConfirmed || d.validationStatus !== "PASSED" || ["NEEDS_REVIEW", "DUPLICATE", "VERIFICATION_FAILED"].includes(d.verificationStatus)),
  );
  const openObligations = compliance.obligations.filter((o) => o.status !== "COMPLETED");
  const slaAlerts = apps.filter((a) => a.sla && ["AT_RISK", "BREACHED"].includes(a.sla.status));

  const pendingActionApps = apps.filter((a) =>
    ["READY_FOR_SUBMISSION", "QUERY_RAISED", "WAITING_FOR_APPLICANT", "SUBMITTED"].includes(a.status),
  );

  const columns: Column<(typeof apps)[number]>[] = [
    {
      key: "approval",
      header: "Approval",
      cell: (a) => (
        <div>
          <p className="font-medium">{a.approvalTitle}</p>
          <p className="text-[11px] text-muted-foreground">{a.ruleId}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => <StatusBadge meta={appStatusMeta[a.status] ?? { label: a.status, tone: "muted" }} />,
    },
    {
      key: "submitted",
      header: "Submitted",
      cell: (a) => (a.submittedAt ? fmtDate(a.submittedAt) : <span className="text-muted-foreground">Not yet</span>),
    },
    {
      key: "sla",
      header: "SLA",
      cell: (a) =>
        a.sla && a.sla.status !== "NOT_STARTED" ? (
          <StatusBadge meta={slaMeta[a.sla.status]} />
        ) : (
          <span className="text-[11px] text-muted-foreground">Not started</span>
        ),
    },
    {
      key: "docs",
      header: "Documents",
      cell: (a) => <span className="text-muted-foreground tabular-nums">{a.documentCount}</span>,
    },
    {
      key: "ref",
      header: "Govt. reference",
      cell: (a) =>
        a.governmentRefId ? (
          <span className="font-mono text-[11px]">{a.governmentRefId}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of your approval journey across departments." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active applications" value={activeApps.length} hint="Across all configured approvals" />
        <Stat
          label="Pending actions"
          value={pendingActionApps.length}
          tone={pendingActionApps.length > 0 ? "warning" : "success"}
          hint="Ready to submit, queries to answer"
        />
        <Stat
          label="Documents needing attention"
          value={attentionDocs.length}
          tone={attentionDocs.length > 0 ? "warning" : "success"}
          hint="Confirmation, validation or verification"
        />
        <Stat
          label="Compliance open"
          value={openObligations.length}
          tone={openObligations.some((o) => o.status === "OVERDUE" || o.status === "DUE_SOON") ? "warning" : "neutral"}
          hint={openObligations[0] ? `Next due ${fmtDate(openObligations[0].dueDate)}` : "Nothing due"}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_330px]">
        <div className="space-y-6">
          <Section title="Applications" description="Only states recorded in your application timeline are shown.">
            {apps.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No applications yet"
                  description="Evaluate your business profile to see which configured approvals apply, then start an application."
                  action={
                    <button
                      onClick={() => navigate("/applicant/journey")}
                      className="inline-flex items-center gap-1.5 rounded-sm bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:opacity-85"
                    >
                      Open approval journey <ArrowRight className="size-3.5" />
                    </button>
                  }
                />
              </div>
            ) : (
              <DataTable
                columns={columns}
                rows={apps.slice(0, 8)}
                keyOf={(a) => a._id}
                onRowClick={(a) => navigate(`/applicant/applications/${a._id}`)}
                dense
              />
            )}
          </Section>

          {slaAlerts.length > 0 && (
            <Section
              title="SLA alerts"
              description="Calculated in working days from submission; applicant-waiting states pause the clock."
            >
              <ul className="divide-y divide-border text-[13px]">
                {slaAlerts.map((a) => (
                  <li key={a._id}>
                    <button
                      onClick={() => navigate(`/applicant/applications/${a._id}`)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/40"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                        <span className="truncate font-medium">{a.approvalTitle}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        {a.sla && (
                          <span className="text-[11px] text-muted-foreground">
                            {a.sla.remainingWorkingDays} working days remaining
                          </span>
                        )}
                        <StatusBadge meta={slaMeta[a.sla?.status ?? ""]} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Needs your attention">
            {pendingActionApps.length === 0 && attentionDocs.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground">Nothing is waiting on you right now.</p>
            ) : (
              <ul className="divide-y divide-border">
                {pendingActionApps.slice(0, 4).map((a) => (
                  <li key={a._id}>
                    <button
                      onClick={() => navigate(`/applicant/applications/${a._id}`)}
                      className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-muted/40"
                    >
                      <ClipboardList className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium">{a.approvalTitle}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {a.status === "READY_FOR_SUBMISSION"
                            ? "Ready to submit to the gateway"
                            : a.status === "QUERY_RAISED" || a.status === "WAITING_FOR_APPLICANT"
                              ? "Department query awaiting your response"
                              : "Submitted — awaiting department action"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {attentionDocs.length > 0 && (
                  <li>
                    <button
                      onClick={() => navigate("/applicant/documents")}
                      className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-muted/40"
                    >
                      <FileWarning className="mt-0.5 size-4 shrink-0 text-amber-500" />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium">
                          {attentionDocs.length} document{attentionDocs.length > 1 ? "s" : ""} need attention
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {attentionDocs[0]?.fileName}
                        </span>
                      </span>
                    </button>
                  </li>
                )}
              </ul>
            )}
          </Section>

          <Section title="Document pipeline snapshot">
            {docs.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {docs.slice(0, 5).map((d) => (
                  <li key={d._id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-xs font-medium">{d.fileName}</p>
                      <StatusBadge meta={verificationMeta[d.verificationStatus]} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                      <StatusBadge meta={extractionMeta[d.extractionStatus]} dot={false} />
                      <span>{d.fieldsConfirmed ? "fields confirmed" : "confirmation pending"}</span>
                      <StatusBadge meta={docStatusMeta[d.validationStatus]} dot={false} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Upcoming compliance">
            {openObligations.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground">
                No compliance obligations are currently due. Obligations appear after an approval.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {openObligations.slice(0, 4).map((o) => (
                  <li key={o._id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{o.title}</p>
                      <p className="text-[11px] text-muted-foreground">Due {fmtDate(o.dueDate)}</p>
                    </div>
                    <StatusBadge meta={complianceMeta[o.status]} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
