import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { PageHeader, Section, StatusBadge, EmptyState, Loading } from "@/components/app/ui";
import { queryStatusMeta, fmtDate, fmtDateTime } from "@/lib/format";

export default function DepartmentQueriesPage() {
  const apps = useQuery(api.applications.listDepartmentApplications, {});
  const navigate = useNavigate();

  if (apps === undefined) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Queries" description="Open queries across all applications in your department." />
      <Section>
        <EmptyState
          title="Query management"
          description="Queries are raised and managed within the application review page. Navigate to an application in the queue to raise or manage queries."
        />
      </Section>
    </div>
  );
}
