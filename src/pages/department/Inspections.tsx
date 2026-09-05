import { PageHeader, Section, EmptyState } from "@/components/app/ui";
import { ClipboardCheck } from "lucide-react";

export default function DepartmentInspectionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Inspections" description="Inspection scheduling and outcomes for applications in your department." />
      <Section>
        <div className="p-4">
          <EmptyState
            icon={<ClipboardCheck className="size-6" />}
            title="Inspections are managed from the application review page"
            description="Navigate to an application in the queue to schedule, complete or reschedule inspections. All inspection activity is recorded in the audit trail."
          />
        </div>
      </Section>
    </div>
  );
}
