import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import AppShell, { applicantNav, departmentNav, adminNav } from "./AppShell";

export function ApplicantShell() {
  const org = useQuery(api.organizations.myOrganization);
  const profile = org?.profile;
  const label = profile
    ? `${org?.organization?.name} · ${profile.sector} · ${profile.district}, ${profile.state}`
    : "Business profile pending";
  return <AppShell nav={applicantNav} contextLabel={label} />;
}

export function DepartmentShell() {
  const { user } = useAuth();
  return (
    <AppShell
      nav={departmentNav}
      contextLabel={user?.department ?? "Department console"}
      simulation
    />
  );
}

export function AdminShell() {
  return <AppShell nav={adminNav} contextLabel="System administration" />;
}
