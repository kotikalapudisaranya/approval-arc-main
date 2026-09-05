import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, Section, StatusBadge, EmptyState, Loading, KV } from "@/components/app/ui";
import { ruleStatusMeta, fmtDate } from "@/lib/format";

export default function DepartmentRulesPage() {
  const rules = useQuery(api.rulesAdmin.listAllRules, { includeInactive: false });

  if (rules === undefined) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Regulatory rules" description={`${rules.length} active verified rule${rules.length !== 1 ? "s" : ""} in the knowledge base.`} />

      {rules.length === 0 ? (
        <EmptyState title="No active rules" description="No verified rules are currently active." />
      ) : (
        <div className="space-y-4">
          {rules.map((r) => (
            <Section key={r._id} title={`${r.ruleId} — ${r.title}`} actions={
              <StatusBadge meta={ruleStatusMeta[r.verificationStatus]} />
            }>
              <div className="grid gap-x-6 gap-y-0.5 p-4 text-[13px]">
                <KV k="State" v={r.state} />
                <KV k="Sector" v={r.sector} />
                <KV k="Activity" v={r.activity} />
                <KV k="Approval type" v={r.approvalType} />
                <KV k="Authority" v={r.officialAuthority} />
                <KV k="Source" v={r.officialSource} />
                <KV k="SLA" v={`${r.slaWorkingDays} working days`} />
                <KV k="Validity" v={`${r.validityDays} days`} />
                <KV k="Renewal" v={r.renewalRules} />
                <KV k="Version" v={`v${r.version}`} />
                <KV k="Effective" v={fmtDate(r.effectiveDate)} />
                <KV k="Verified" v={fmtDate(r.lastVerified)} />
                <KV k="Verified by" v={r.reviewer} />
              </div>
            </Section>
          ))}
        </div>
      )}
    </div>
  );
}
