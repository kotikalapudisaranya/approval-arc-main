import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { PageHeader, Section, EmptyState, Loading } from "@/components/app/ui";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  SLA: "bg-amber-500",
  QUERY: "bg-sky-500",
  DOCUMENT: "bg-neutral-500",
  INSPECTION: "bg-purple-500",
  DECISION: "bg-emerald-500",
  SYSTEM: "bg-neutral-400",
};

export default function NotificationsPage() {
  const notifications = useQuery(api.notifications.myNotifications);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const navigate = useNavigate();

  if (notifications === undefined) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="System notifications about application status, SLA, queries and document events."
      >
        <Button variant="outline" size="sm" onClick={() => markAllRead()}>
          <CheckCheck className="mr-1 size-3.5" /> Mark all read
        </Button>
      </PageHeader>

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" />} title="No notifications" description="Notifications appear when there are application events, SLA changes or department actions." />
      ) : (
        <Section>
          <ul className="divide-y divide-border">
            {notifications.map((n) => (
              <li key={n._id}>
                <button
                  onClick={() => {
                    markAllRead();
                    if (n.link) navigate(n.link);
                  }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/30"
                >
                  <span className={`mt-1 size-2 shrink-0 rounded-full ${TYPE_COLORS[n.type] ?? "bg-neutral-300"} ${!n.read ? "animate-pulse" : ""}`} />
                  <span className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium">{n.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">{timeAgo(n._creationTime)} · {n.type}</p>
                  </span>
                  {!n.read && <span className="size-2 shrink-0 rounded-full bg-amber-500" />}
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
