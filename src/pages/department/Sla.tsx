import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { PageHeader, Section, StatusBadge, EmptyState, Loading, Stat } from "@/components/app/ui";
import { appStatusMeta, slaMeta, fmtDate } from "@/lib/format";
import { AlertTriangle } from "lucide-react";

export default function DepartmentSlaPage() {
  const apps = useQuery(api.applications.listDepartmentApplications, {});
  const navigate = useNavigate();

  if (apps === undefined) return <Loading />;

  const slaApps = apps.filter((a) => a.sla && a.sla.status !== "NOT_STARTED");
  const atRisk = slaApps.filter((a) => a.sla?.status === "AT_RISK");
  const breached = slaApps.filter((a) => a.sla?.status === "BREACHED");

  return (
    <div className="space-y-6">
      <PageHeader title="SLA monitoring" description="Applications with active SLA clocks, measured in working days against the department calendar." />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="With SLA clock" value={slaApps.length} hint="Submitted applications" />
        <Stat label="At risk" value={atRisk.length} tone={atRisk.length > 0 ? "warning" : "success"} hint="Approaching SLA threshold" />
        <Stat label="Breached" value={breached.length} tone={breached.length > 0 ? "danger" : "success"} hint="SLA exceeded" />
      </div>

      {breached.length > 0 && (
        <Section title="SLA breached" description="Applications that have exceeded the configured SLA.">
          <ul className="divide-y divide-border">
            {breached.map((a) => (
              <li key={a._id}>
                <button onClick={() => navigate(`/department/applications/${a._id}`)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{a.approvalTitle}</p>
                    <p className="text-[11px] text-muted-foreground">{a.businessName} · {a.ruleId}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {a.sla && <span className="text-[11px] text-red-600">{a.sla.remainingWorkingDays} days remaining</span>}
                    <StatusBadge meta={slaMeta["BREACHED"]} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {atRisk.length > 0 && (
        <Section title="At risk" description="Applications approaching the SLA threshold.">
          <ul className="divide-y divide-border">
            {atRisk.map((a) => (
              <li key={a._id}>
                <button onClick={() => navigate(`/department/applications/${a._id}`)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{a.approvalTitle}</p>
                    <p className="text-[11px] text-muted-foreground">{a.businessName} · {a.ruleId}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {a.sla && <span className="text-[11px] text-amber-600">{a.sla.remainingWorkingDays} days remaining</span>}
                    <StatusBadge meta={slaMeta["AT_RISK"]} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {slaApps.length === 0 && (
        <EmptyState
          icon={<AlertTriangle className="size-6" />}
          title="No applications with SLA clocks"
          description="SLA tracking begins when an application is submitted. No applications have been submitted yet."
        />
      )}
    </div>
  );
}
