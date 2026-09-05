import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { PageHeader, Section, StatusBadge, EmptyState, Loading, Stat, Notice } from "@/components/app/ui";
import { DependencyGraph, GraphNode } from "@/components/app/panels";
import { evalStatusMeta, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { readErrorMessage } from "@/components/app/docs";
import { FilePlus2, Loader2 } from "lucide-react";

export default function ApprovalJourneyPage() {
  const data = useQuery(api.organizations.evalsForOrganization);
  const apps = useQuery(api.applications.listMyApplications);
  const createApplication = useMutation(api.applications.createApplication);
  const navigate = useNavigate();
  const [creating, setCreating] = useState<string | null>(null);

  const profileState = data?.profile?.state;
  const profileSector = data?.profile?.sector;
  const ruleDocs = useQuery(
    api.organizations.rulesForProfile,
    profileState && profileSector ? { state: profileState, sector: profileSector } : "skip",
  );

  const combined = useMemo(() => {
    if (!data || !ruleDocs) return null;
    const byId = new Map(ruleDocs.map((r) => [r.ruleId, r]));
    const applicable = data.evals.filter((e) => e.status === "APPLICABLE" || e.status === "CONDITIONAL");
    const appByRule = new Map((apps ?? []).map((a) => [a.ruleId, a]));

    const depthOf = (ruleId: string, seen: Set<string> = new Set()): number => {
      if (seen.has(ruleId)) return 0;
      seen.add(ruleId);
      const rule = byId.get(ruleId);
      if (!rule || !rule.prerequisites || rule.prerequisites.length === 0) return 0;
      return 1 + Math.max(...rule.prerequisites.map((p) => depthOf(p, seen)));
    };

    const nodes: GraphNode[] = applicable.map((e) => {
      const rule = byId.get(e.ruleId);
      const app = appByRule.get(e.ruleId) ?? null;
      const prereqRules = (rule?.prerequisites ?? []).map((p) => byId.get(p)).filter(Boolean);
      const blockedBy = prereqRules
        .filter((p) => {
          const pa = appByRule.get(p!.ruleId);
          return !pa || pa.status !== "APPROVED";
        })
        .map((p) => p!.ruleId);
      return {
        ruleId: e.ruleId,
        title: e.title,
        status: e.status,
        appStatus: app?.status ?? null,
        depth: depthOf(e.ruleId),
        blockedBy,
      };
    });
    return { nodes, all: data.evals, configured: data.configured, profile: data.profile };
  }, [data, ruleDocs, apps]);

  if (data === undefined || apps === undefined) return <Loading />;
  if (ruleDocs === undefined) return <Loading />;
  if (!combined) return <Loading />;

  if (!data.profile) {
    return (
      <div className="space-y-6">
        <PageHeader title="Approval journey" description="The dependency graph across all approvals that apply to your business." />
        <EmptyState
          title="Configure your business profile first"
          description="The journey graph is computed from verified rules matched against state, district, sector and project type."
          action={
            <button onClick={() => navigate("/applicant/profile")} className="rounded-sm bg-neutral-900 px-3 py-2 text-xs font-medium text-white">
              Configure business profile
            </button>
          }
        />
      </div>
    );
  }

  if (!combined.configured) {
    return (
      <div className="space-y-6">
        <PageHeader title="Approval journey" description="The dependency graph across all approvals that apply to your business." />
        <Notice tone="warning" title="No verified regulatory rules are currently configured for this combination.">
          Your profile is {data.profile.sector} · {data.profile.district}, {data.profile.state}. Verified demo rules are only
          seeded for Maharashtra → Pune → Food Processing. Change the profile to a configured combination, or wait until rules
          are verified for your jurisdiction in the admin console.
        </Notice>
      </div>
    );
  }

  const nodes = combined.nodes;
  const parallelCount = nodes.filter((n) => (n.blockedBy?.length ?? 0) === 0 && !n.appStatus).length;
  const prereqCount = nodes.filter((n) => (n.blockedBy?.length ?? 0) > 0).length;
  const blockedCount = prereqCount;
  const applicableCount = nodes.length;
  const notApplicable = combined.all.filter((e) => e.status === "NOT_APPLICABLE").length;
  const withApp = nodes.filter((n) => n.appStatus).length;

  const startRule = async (ruleId: string, title: string) => {
    setCreating(ruleId);
    try {
      const r = (await createApplication({ ruleId })) as { appId: string };
      toast.success(`${title} — draft created.`);
      navigate(`/applicant/applications/${r.appId}`);
    } catch (err) {
      toast.error(readErrorMessage(err));
      setCreating(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval journey"
        description={`Deterministic evaluation for ${data.profile.businessType} — ${data.profile.sector}, ${data.profile.district}, ${data.profile.state}.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Configured approvals apply" value={applicableCount} hint="From verified, ACTIVE rules only" />
        <Stat label="Can proceed in parallel" value={parallelCount} tone="success" hint="No unmet prerequisites" />
        <Stat label="Require prerequisites" value={prereqCount} tone="warning" hint="Blocked until a prerequisite is approved" />
        <Stat label="Currently blocked" value={blockedCount} tone={blockedCount > 0 ? "danger" : "success"} hint="Statutory prerequisites cannot be bypassed" />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Section title="Dependency graph" description="Data-driven — rendered from rule prerequisites configured in the knowledge base." padded>
            <DependencyGraph nodes={nodes} />
          </Section>

          <Section title="Applicable approvals" description={`${withApp} of ${applicableCount} have an active or decided application.`}>
            {nodes.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No applicable approvals" />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {nodes.map((n) => {
                  const app = (apps ?? []).find((a) => a.ruleId === n.ruleId);
                  const blocked = n.blockedBy ?? [];
                  return (
                    <li key={n.ruleId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {n.ruleId}
                          {blocked.length > 0 && <> · requires {blocked.join(", ")} first</>}
                          {blocked.length === 0 && n.appStatus === null && <> · ready to start</>}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {n.appStatus ? (
                          <StatusBadge meta={{ label: n.appStatus.replace(/_/g, " "), tone: n.appStatus === "APPROVED" ? "success" : n.appStatus === "REJECTED" ? "danger" : "info" }} />
                        ) : (
                          <StatusBadge meta={evalStatusMeta[n.status]} />
                        )}
                        {app ? (
                          <button onClick={() => navigate(`/applicant/applications/${app._id}`)} className="text-xs font-medium underline underline-offset-2 text-muted-foreground hover:text-foreground">
                            Open application
                          </button>
                        ) : (
                          <button
                            disabled={creating !== null}
                            onClick={() => void startRule(n.ruleId, n.title)}
                            className="inline-flex items-center gap-1 rounded-sm bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-85 disabled:opacity-50"
                          >
                            {creating === n.ruleId ? <Loader2 className="size-3 animate-spin" /> : <FilePlus2 className="size-3" />}
                            Start
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {notApplicable > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {notApplicable} configured approvals in the demo dataset are not applicable to this profile combination. They are
              excluded from the journey.
            </p>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Rule provenance">
            <div className="px-4 py-2">
              <p className="text-[11px] leading-5 text-muted-foreground">
                Every approval traces to a verified rule with an authority, official source and last-verification date. Open an
                approval to see the full “Why does this apply?” panel.
              </p>
              <dl className="mt-3 space-y-1.5 text-[12px]">
                {nodes.slice(0, 8).map((n) => {
                  const rule = ruleDocs.find((r) => r.ruleId === n.ruleId);
                  if (!rule) return null;
                  return (
                    <div key={n.ruleId} className="rounded-sm border px-2.5 py-1.5">
                      <p className="font-medium">{n.ruleId} · v{rule.version}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {rule.officialAuthority} · verified {fmtDate(rule.lastVerified)} by {rule.reviewer}
                      </p>
                    </div>
                  );
                })}
              </dl>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
