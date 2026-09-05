import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, Section, StatusBadge, EmptyState, Loading, Notice } from "@/components/app/ui";
import { schemeMatchMeta, schemeStatusMeta, fmtDate } from "@/lib/format";
import { ExternalLink } from "lucide-react";

const FIELD_LABELS: Record<string, string> = {
  state: "State",
  district: "District",
  sector: "Sector",
  projectType: "Project type",
  projectStage: "Project stage",
  investment: "Investment",
  employeeCount: "Employees",
  businessType: "Business type",
};

export default function SchemesPage() {
  const data = useQuery(api.schemes.matchedSchemes);

  if (data === undefined) return <Loading />;

  const { schemes, profile } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Government schemes"
        description="Deterministic scheme eligibility matching against your business profile. Final eligibility remains with the relevant authority."
      />

      {!profile && (
        <Notice tone="warning" title="Business profile required">
          Configure your business profile to see which schemes may apply to your business.
        </Notice>
      )}

      {schemes.length === 0 ? (
        <EmptyState title="No schemes configured" description="No schemes are currently in the demo dataset." />
      ) : (
        <div className="space-y-4">
          {schemes.map((s) => (
            <Section key={s._id} title={s.name} actions={
              <div className="flex items-center gap-2">
                <StatusBadge meta={schemeStatusMeta[s.status]} />
                <StatusBadge meta={schemeMatchMeta[s.match]} />
              </div>
            }>
              <div className="space-y-3 p-4">
                <div className="grid gap-x-6 gap-y-1 text-[13px]">
                  <div className="flex justify-between border-b py-1.5">
                    <span className="text-muted-foreground">Authority</span>
                    <span className="font-medium">{s.authority}</span>
                  </div>
                  <div className="flex justify-between border-b py-1.5">
                    <span className="text-muted-foreground">Sector</span>
                    <span className="font-medium">{s.sector}</span>
                  </div>
                  <div className="flex justify-between border-b py-1.5">
                    <span className="text-muted-foreground">Application method</span>
                    <span className="text-right">{s.applicationMethod}</span>
                  </div>
                  {s.openingDate && (
                    <div className="flex justify-between border-b py-1.5">
                      <span className="text-muted-foreground">Opening date</span>
                      <span>{fmtDate(s.openingDate)}</span>
                    </div>
                  )}
                  {s.closingDate && (
                    <div className="flex justify-between border-b py-1.5">
                      <span className="text-muted-foreground">Closing date</span>
                      <span>{fmtDate(s.closingDate)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-b py-1.5">
                    <span className="text-muted-foreground">Official source</span>
                    <span className="max-w-xs truncate text-right text-xs">{s.officialSource}</span>
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Benefits</p>
                  <ul className="space-y-1">
                    {s.benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <span className="mt-1 size-1 shrink-0 rounded-full bg-emerald-500" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Eligibility criteria</p>
                  <ul className="space-y-1">
                    {s.eligibilityCriteria.map((c, i) => (
                      <li key={i} className="text-xs text-muted-foreground">· {c}</li>
                    ))}
                  </ul>
                </div>

                {s.matchedCriteria && s.matchedCriteria.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold tracking-wider text-emerald-700 uppercase">Matched conditions</p>
                    <ul className="space-y-0.5">
                      {s.matchedCriteria.map((c: any, i: number) => (
                        <li key={i} className="text-[11px] text-emerald-700">
                          {FIELD_LABELS[c.field] ?? c.field}: {String(c.value)} ({c.op})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {s.unmatchedCriteria && s.unmatchedCriteria.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold tracking-wider text-amber-700 uppercase">Unmatched conditions</p>
                    <ul className="space-y-0.5">
                      {s.unmatchedCriteria.map((c: any, i: number) => (
                        <li key={i} className="text-[11px] text-amber-700">
                          {FIELD_LABELS[c.field] ?? c.field}: {String(c.value)} ({c.op})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          ))}
        </div>
      )}

      <Notice tone="muted">
        ApprovalArc does not show "probability of allocation" or fabricate budget utilization. Final eligibility remains with the relevant authority.
      </Notice>
    </div>
  );
}
