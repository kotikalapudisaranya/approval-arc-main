import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, Section, StatusBadge, Loading, Stat } from "@/components/app/ui";
import { ruleStatusMeta, appStatusMeta } from "@/lib/format";
import { useNavigate } from "react-router";

export default function AdminDashboard() {
  const rules = useQuery(api.rulesAdmin.listAllRules, { includeInactive: true });
  const users = useQuery(api.usersAdmin.listUsers);
  const apps = useQuery(api.applications.listDepartmentApplications, {});
  const departments = useQuery(api.usersAdmin.departmentsWithCounts);
  const navigate = useNavigate();

  if (rules === undefined || users === undefined || apps === undefined) return <Loading />;

  const statusCounts: Record<string, number> = {};
  for (const r of rules) statusCounts[r.verificationStatus] = (statusCounts[r.verificationStatus] ?? 0) + 1;

  const appCounts: Record<string, number> = {};
  for (const a of apps) appCounts[a.status] = (appCounts[a.status] ?? 0) + 1;

  return (
    <div className="space-y-6">
      <PageHeader title="System administration" description="Manage regulatory rules, users and roles." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total rules" value={rules.length} hint={`${statusCounts["ACTIVE"] ?? 0} active, ${statusCounts["DRAFT"] ?? 0} draft`} />
        <Stat label="Users" value={users.length} hint="All roles" />
        <Stat label="Applications" value={apps.length} hint="Across all departments" />
        <Stat label="Departments" value={departments?.length ?? 0} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Section title="Rule lifecycle" padded>
          <div className="space-y-1 p-4">
            {["ACTIVE", "DRAFT", "PENDING_VERIFICATION", "SUPERSEDED", "EXPIRED"].map((s) => (
              <div key={s} className="flex items-center justify-between py-1.5 text-[13px]">
                <StatusBadge meta={ruleStatusMeta[s]} />
                <span className="tabular-nums">{statusCounts[s] ?? 0}</span>
              </div>
            ))}
          </div>
          <div className="border-t px-4 py-3">
            <button onClick={() => navigate("/admin/rules")} className="text-xs font-medium underline underline-offset-2 text-muted-foreground hover:text-foreground">
              Manage rules →
            </button>
          </div>
        </Section>

        <Section title="Application status" padded>
          <div className="space-y-1 p-4">
            {Object.entries(appCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <div key={status} className="flex items-center justify-between py-1.5 text-[13px]">
                  <StatusBadge meta={appStatusMeta[status]} />
                  <span className="tabular-nums">{count}</span>
                </div>
              ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
