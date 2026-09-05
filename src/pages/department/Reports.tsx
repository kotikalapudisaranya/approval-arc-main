import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, Section, StatusBadge, Loading, Stat } from "@/components/app/ui";
import { appStatusMeta } from "@/lib/format";

export default function DepartmentReportsPage() {
  const metrics = useQuery(api.applications.departmentMetrics);

  if (metrics === undefined) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description={`Department: ${metrics.department} · ${metrics.total} total applications.`} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total applications" value={metrics.total} />
        <Stat label="With SLA clock" value={metrics.withSla} hint="Submitted or beyond" />
        <Stat label="SLA at risk" value={metrics.atRisk} tone={metrics.atRisk > 0 ? "warning" : "success"} />
        <Stat label="SLA breached" value={metrics.breached} tone={metrics.breached > 0 ? "danger" : "success"} />
      </div>

      <Section title="Status breakdown">
        <div className="space-y-1 p-4">
          {Object.entries(metrics.byStatus)
            .sort(([, a], [, b]) => b - a)
            .map(([status, count]) => (
              <div key={status} className="flex items-center justify-between py-1.5 text-[13px]">
                <StatusBadge meta={appStatusMeta[status]} />
                <span className="tabular-nums">{count}</span>
              </div>
            ))}
          {Object.keys(metrics.byStatus).length === 0 && (
            <p className="text-xs text-muted-foreground">No application data available.</p>
          )}
        </div>
      </Section>

      {metrics.bottlenecks.length > 0 && (
        <Section title="Current bottlenecks">
          <div className="space-y-2 p-4">
            {metrics.bottlenecks.map((b, i) => (
              <div key={i} className="rounded-sm border px-3 py-2">
                <p className="text-[13px] font-medium">{b.label}</p>
                <p className="text-[11px] text-muted-foreground">{b.count} application{b.count !== 1 ? "s" : ""} · {b.detail}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
