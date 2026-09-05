import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, Section, EmptyState, Loading } from "@/components/app/ui";
import { Timeline, TimelineItem } from "@/components/app/panels";
import { fmtDateTime } from "@/lib/format";
import { ScrollText } from "lucide-react";

export default function ActivityPage() {
  const audit = useQuery(api.notifications.listAudit, {});

  if (audit === undefined) return <Loading />;

  const items: TimelineItem[] = audit.map((e) => ({
    id: e._id,
    title: e.action.replace(/_/g, " "),
    detail: e.detail ?? (e.newValue ? JSON.stringify(e.newValue) : undefined),
    at: e.occurredAt,
    actor: e.actorName,
    muted: true,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="Append-only audit trail. Every login, document access, status change and department action is recorded."
      />

      <Section title="Audit log" description={`${items.length} event${items.length !== 1 ? "s" : ""} recorded.`}>
        <div className="p-4">
          {items.length === 0 ? (
            <EmptyState icon={<ScrollText className="size-6" />} title="No audit events" description="Activity will appear here as you interact with the system." />
          ) : (
            <Timeline items={items} />
          )}
        </div>
      </Section>
    </div>
  );
}
