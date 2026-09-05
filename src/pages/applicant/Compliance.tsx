import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, Section, StatusBadge, EmptyState, Loading, Notice, KV } from "@/components/app/ui";
import { complianceMeta, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { readErrorMessage } from "@/components/app/docs";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";

export default function CompliancePage() {
  const data = useQuery(api.compliance.listCompliance);
  const completeObligation = useMutation(api.compliance.completeObligation);
  const [busy, setBusy] = useState<string | null>(null);

  if (data === undefined) return <Loading />;

  const { obligations, calendar } = data;

  const complete = async (obligationId: string) => {
    setBusy(obligationId);
    try {
      await completeObligation({ obligationId: obligationId as never });
      toast.success("Obligation marked as completed.");
    } catch (err) {
      toast.error(readErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance"
        description="Post-approval obligations generated from the verified rules governing your approvals."
      />

      {obligations.length === 0 ? (
        <EmptyState
          title="No compliance obligations"
          description="Obligations are generated after an approval is granted. Submit and get an approval to see obligations appear here."
        />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
          <Section title="All obligations" description={`${obligations.length} configured obligation${obligations.length !== 1 ? "s" : ""}.`}>
            <ul className="divide-y divide-border">
              {obligations.map((o) => (
                <li key={o._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{o.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {o.type} · {o.authority} · due {fmtDate(o.dueDate)}
                    </p>
                    {o.responsiblePerson && (
                      <p className="text-[11px] text-muted-foreground">Responsible: {o.responsiblePerson}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge meta={complianceMeta[o.status]} />
                    {o.status !== "COMPLETED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={busy !== null}
                        onClick={() => void complete(o._id)}
                      >
                        {busy === o._id ? <Loader2 className="mr-1 size-3 animate-spin" /> : <CheckCircle className="mr-1 size-3" />}
                        Mark completed
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Compliance calendar" description="Upcoming and overdue obligations sorted by due date.">
            {calendar.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground">No upcoming obligations.</p>
            ) : (
              <ul className="divide-y divide-border">
                {calendar.map((c, i) => (
                  <li key={i} className="px-4 py-2.5">
                    <p className="text-[13px] font-medium">{c.title}</p>
                    <p className="text-[11px] text-muted-foreground">{c.type} · due {fmtDate(c.date)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      <Notice tone="muted" title="Compliance obligations are configured, not guaranteed">
        Obligations are derived from verified regulatory rules. Final compliance requirements remain with the competent government authority.
      </Notice>
    </div>
  );
}
