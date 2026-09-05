import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, Section, StatusBadge, Loading, EmptyState } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { readErrorMessage } from "@/components/app/docs";
import { Loader2 } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  applicant: "Applicant",
  dept_officer: "Department Officer",
  dept_supervisor: "Department Supervisor",
  admin: "System Administrator",
};

export default function AdminUsersPage() {
  const users = useQuery(api.usersAdmin.listUsers);
  const setUserRole = useMutation(api.usersAdmin.setUserRole);
  const setDepartment = useMutation(api.usersAdmin.setDepartment);
  const [busy, setBusy] = useState<string | null>(null);

  if (users === undefined) return <Loading />;

  const departments = Array.from(new Set(users.filter((u) => u.department).map((u) => u.department))).sort();

  return (
    <div className="space-y-6">
      <PageHeader title="Users & roles" description={`${users.length} user${users.length !== 1 ? "s" : ""} registered. Manage roles and department assignments.`} />

      {users.length === 0 ? (
        <EmptyState title="No users" description="Users will appear after demo accounts are seeded." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Name</th>
                <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Email</th>
                <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Role</th>
                <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Department</th>
                <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-b last:border-0">
                  <td className="px-3 py-2.5 font-medium">{u.name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{u.email ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <select
                      value={u.role ?? "applicant"}
                      disabled={busy === u._id}
                      onChange={async (e) => {
                        setBusy(u._id);
                        try {
                          await setUserRole({ userId: u._id, role: e.target.value as any });
                          toast.success("Role updated.");
                        } catch (err) { toast.error(readErrorMessage(err)); } finally { setBusy(null); }
                      }}
                      className="h-7 rounded-sm border bg-background px-1.5 text-[12px] outline-none"
                    >
                      {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    {["dept_officer", "dept_supervisor"].includes(u.role ?? "") ? (
                      <Input
                        value={u.department ?? ""}
                        onChange={async (v) => {
                          setBusy(u._id);
                          try {
                            await setDepartment({ userId: u._id, department: v });
                            toast.success("Department updated.");
                          } catch (err) { toast.error(readErrorMessage(err)); } finally { setBusy(null); }
                        }}
                        placeholder="Department name"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-[11px] text-muted-foreground">{u.organizationName ?? "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-7 w-full rounded-sm border bg-background px-2 text-[12px] outline-none focus:border-neutral-400"
    />
  );
}
