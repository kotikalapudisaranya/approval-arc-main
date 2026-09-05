import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { PageHeader, Stat, StatusBadge, Section, Loading, EmptyState, Notice } from "@/components/app/ui";
import { appStatusMeta, slaMeta, fmtDate } from "@/lib/format";
import { AlertTriangle, FileText } from "lucide-react";

export default function DepartmentDashboard() {
  const metrics = useQuery(api.applications.departmentMetrics);
  const apps = useQuery(api.applications.listDepartmentApplications, {});
  const navigate = useNavigate();

  if (metrics === undefined || apps === undefined) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Department overview"
        description={`Viewing: ${metrics.department} · ${metrics.total} application${metrics.total !== 1 ? "s" : ""} total.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pending" value={metrics.byStatus["SUBMITTED"] ?? 0} hint="Submitted, awaiting review" />
        <Stat label="Under review" value={metrics.byStatus["UNDER_REVIEW"] ?? 0} hint="Officer has started review" />
        <Stat label="Queries open" value={(metrics.byStatus["QUERY_RAISED"] ?? 0) + (metrics.byStatus["WAITING_FOR_APPLICANT"] ?? 0)} tone="warning" hint="Awaiting applicant response" />
        <Stat label="SLA at risk" value={metrics.atRisk} tone={metrics.atRisk > 0 ? "warning" : "success"} hint={`${metrics.breached} breached`} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
        <Section title="Application queue" description="Latest submitted applications across your department.">
          {apps.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={<FileText className="size-6" />} title="No applications" description="Applications will appear here when submitted by applicants." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Business</th>
                    <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Approval</th>
                    <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Submitted</th>
                    <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Status</th>
                    <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.slice(0, 15).map((a) => (
                    <tr key={a._id} className="border-b last:border-0 cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/department/applications/${a._id}`)}>
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{a.businessName}</p>
                        <p className="text-[11px] text-muted-foreground">{a.sector}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p>{a.approvalTitle}</p>
                        <p className="text-[11px] text-muted-foreground">{a.ruleId}</p>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(a.submittedAt)}</td>
                      <td className="px-3 py-2.5"><StatusBadge meta={appStatusMeta[a.status]} /></td>
                      <td className="px-3 py-2.5">
                        {a.sla && a.sla.status !== "NOT_STARTED" ? (
                          <StatusBadge meta={slaMeta[a.sla.status]} />
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <div className="space-y-6">
          <Section title="SLA monitoring" padded>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-4 py-2 text-[13px]">
                <span>At risk</span>
                <span className="font-medium">{metrics.atRisk}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2 text-[13px]">
                <span>Breached</span>
                <span className="font-medium text-red-600">{metrics.breached}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2 text-[13px]">
                <span>With SLA clock</span>
                <span className="font-medium">{metrics.withSla}</span>
              </div>
            </div>
          </Section>

          {metrics.bottlenecks.length > 0 && (
            <Section title="Current bottlenecks" padded>
              <div className="space-y-2">
                {metrics.bottlenecks.map((b, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-sm border border-amber-200 bg-amber-50/50 px-3 py-2">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                    <div>
                      <p className="text-[13px] font-medium">{b.label}</p>
                      <p className="text-[11px] text-muted-foreground">{b.count} application{b.count !== 1 ? "s" : ""} · {b.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Status breakdown" padded>
            <div className="space-y-1">
              {Object.entries(metrics.byStatus).sort(([, a], [, b]) => b - a).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between px-4 py-1.5 text-[12px]">
                  <StatusBadge meta={appStatusMeta[status]} />
                  <span className="tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>

      <Notice tone="muted">
        Prototype Simulation — Not a Live Government Connection. All data shown is from seeded demo records.
      </Notice>
    </div>
  );
}
