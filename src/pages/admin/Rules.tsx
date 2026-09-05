import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, Section, StatusBadge, EmptyState, Loading, KV, Notice } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { readErrorMessage } from "@/components/app/docs";
import { ruleStatusMeta, fmtDate } from "@/lib/format";
import { STATES, SECTORS } from "@/convex/lib/config";
import { Loader2, Plus, ShieldCheck } from "lucide-react";

export default function AdminRulesPage() {
  const rules = useQuery(api.rulesAdmin.listAllRules, { includeInactive: true });
  const createRule = useMutation(api.rulesAdmin.createRule);
  const verifyRule = useMutation(api.rulesAdmin.verifyRule);
  const submitForVerification = useMutation(api.rulesAdmin.submitRuleForVerification);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Create form
  const [form, setForm] = useState({
    title: "",
    state: "Maharashtra",
    sector: "Food Processing",
    activity: "",
    approvalType: "NOC",
    officialAuthority: "",
    officialSource: "",
    slaWorkingDays: 30,
    validityDays: 365,
    renewalRules: "Annual renewal required",
    parallelizable: false,
    requiredDocuments: "",
    requiredInformation: "",
    prerequisites: "",
    dependencies: "",
    projectConditions: "",
    conditionsJson: '[{"field":"sector","op":"eq","value":"Food Processing"}]',
  });

  if (rules === undefined) return <Loading />;

  const handleCreate = async () => {
    setBusy("create");
    try {
      let conditions;
      try { conditions = JSON.parse(form.conditionsJson); } catch { conditions = [{ field: "sector", op: "eq", value: form.sector }]; }
      await createRule({
        ruleInput: {
          title: form.title,
          state: form.state,
          sector: form.sector,
          activity: form.activity,
          approvalType: form.approvalType,
          officialAuthority: form.officialAuthority,
          officialSource: form.officialSource,
          slaWorkingDays: form.slaWorkingDays,
          validityDays: form.validityDays,
          renewalRules: form.renewalRules,
          parallelizable: form.parallelizable,
          requiredDocuments: form.requiredDocuments.split(",").map((s) => s.trim()).filter(Boolean),
          requiredInformation: form.requiredInformation.split(",").map((s) => s.trim()).filter(Boolean),
          prerequisites: form.prerequisites.split(",").map((s) => s.trim()).filter(Boolean),
          dependencies: form.dependencies.split(",").map((s) => s.trim()).filter(Boolean),
          projectConditions: form.projectConditions.split(",").map((s) => s.trim()).filter(Boolean),
          conditions,
        },
      });
      toast.success("Rule created as DRAFT.");
      setShowCreate(false);
    } catch (err) {
      toast.error(readErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Regulatory rules" description="Manage the lifecycle of regulatory rules: DRAFT → PENDING_VERIFICATION → ACTIVE → SUPERSEDED/EXPIRED.">
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="mr-1 size-3.5" /> Create rule
        </Button>
      </PageHeader>

      {showCreate && (
        <Section title="Create new rule" description="Rules are created as DRAFT by default. Submit for verification after review.">
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label="Title" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} required />
            <Field label="State" value={form.state} onChange={(v) => setForm((f) => ({ ...f, state: v }))} options={[...STATES]} />
            <Field label="Sector" value={form.sector} onChange={(v) => setForm((f) => ({ ...f, sector: v }))} options={[...SECTORS]} />
            <Field label="Activity" value={form.activity} onChange={(v) => setForm((f) => ({ ...f, activity: v }))} />
            <Field label="Approval type" value={form.approvalType} onChange={(v) => setForm((f) => ({ ...f, approvalType: v }))} options={["NOC", "LICENCE", "CONSENT", "CERTIFICATE", "REGISTRATION", "PERMISSION", "AUTHORISATION"]} />
            <Field label="Authority" value={form.officialAuthority} onChange={(v) => setForm((f) => ({ ...f, officialAuthority: v }))} />
            <Field label="Official source" value={form.officialSource} onChange={(v) => setForm((f) => ({ ...f, officialSource: v }))} />
            <Field label="SLA (working days)" value={form.slaWorkingDays} type="number" onChange={(v) => setForm((f) => ({ ...f, slaWorkingDays: Number(v) }))} />
            <Field label="Validity (days)" value={form.validityDays} type="number" onChange={(v) => setForm((f) => ({ ...f, validityDays: Number(v) }))} />
            <Field label="Renewal rules" value={form.renewalRules} onChange={(v) => setForm((f) => ({ ...f, renewalRules: v }))} />
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Required documents (comma-separated)</Label>
              <Textarea value={form.requiredDocuments} onChange={(e) => setForm((f) => ({ ...f, requiredDocuments: e.target.value }))} rows={2} className="mt-1 text-[13px]" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Conditions (JSON array)</Label>
              <Textarea value={form.conditionsJson} onChange={(e) => setForm((f) => ({ ...f, conditionsJson: e.target.value }))} rows={3} className="mt-1 font-mono text-[12px]" />
            </div>
          </div>
          <div className="border-t px-4 py-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" disabled={busy === "create" || !form.title} onClick={() => void handleCreate()}>
              {busy === "create" && <Loader2 className="mr-1 size-3.5 animate-spin" />}
              Create rule
            </Button>
          </div>
        </Section>
      )}

      {rules.length === 0 ? (
        <EmptyState title="No rules" description="Create your first regulatory rule." />
      ) : (
        <div className="space-y-3">
          {rules.map((r) => (
            <Section key={r._id} title={`${r.ruleId} — ${r.title}`} actions={
              <div className="flex items-center gap-2">
                <StatusBadge meta={ruleStatusMeta[r.verificationStatus]} />
                <span className="text-[11px] text-muted-foreground">v{r.version}</span>
                {r.verificationStatus !== "ACTIVE" && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={busy !== null}
                    onClick={async () => {
                      setBusy(r._id);
                      try {
                        if (r.verificationStatus === "DRAFT") await submitForVerification({ id: r._id });
                        else if (r.verificationStatus === "PENDING_VERIFICATION") await verifyRule({ id: r._id, reviewer: "Admin" });
                        toast.success("Rule updated.");
                      } catch (err) { toast.error(readErrorMessage(err)); } finally { setBusy(null); }
                    }}>
                    {r.verificationStatus === "DRAFT" ? "Submit for verification" : "Verify"}
                  </Button>
                )}
              </div>
            }>
              <div className="grid gap-x-6 gap-y-0.5 p-4 text-[13px]">
                <KV k="State / Sector" v={`${r.state} / ${r.sector}`} />
                <KV k="Authority" v={r.officialAuthority} />
                <KV k="Source" v={r.officialSource} />
                <KV k="SLA" v={`${r.slaWorkingDays} working days`} />
                <KV k="Validity" v={`${r.validityDays} days`} />
                <KV k="Effective" v={fmtDate(r.effectiveDate)} />
                <KV k="Verified" v={fmtDate(r.lastVerified)} />
                <KV k="Reviewed by" v={r.reviewer} />
              </div>
            </Section>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", options, required }: {
  label: string; value: string | number; onChange: (v: string) => void; type?: string; options?: readonly string[]; required?: boolean;
}) {
  if (options) {
    return (
      <div>
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <select value={String(value)} onChange={(e) => onChange(e.target.value)}
          className="mt-1 h-9 w-full rounded-md border bg-background px-2.5 text-[13px] outline-none focus:border-neutral-400">
          <option value="">Select…</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} className="mt-1 h-9 text-[13px]" />
    </div>
  );
}
