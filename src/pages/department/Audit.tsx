import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, Section, EmptyState, Loading } from "@/components/app/ui";
import { Timeline, TimelineItem } from "@/components/app/panels";
import { ScrollText } from "lucide-react";

export default function DepartmentAuditPage() {
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
      <PageHeader title="Audit log" description="Append-only audit trail. Every department action is recorded and immutable." />
      <Section title="Audit events" description={`${items.length} event${items.length !== 1 ? "s" : ""}.`}>
        <div className="p-4">
          {items.length === 0 ? (
            <EmptyState icon={<ScrollText className="size-6" />} title="No audit events" description="Events will appear as you take actions on applications." />
          ) : (
            <Timeline items={items} />
          )}
        </div>
      </Section>
    </div>
  );
}
