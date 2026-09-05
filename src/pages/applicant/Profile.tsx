import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { PageHeader, Section, Loading, Notice, KV } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { readErrorMessage } from "@/components/app/docs";
import { fmtINR } from "@/lib/format";
import { Loader2, Save } from "lucide-react";
import { STATES, DISTRICTS, SECTORS, PROJECT_TYPES, PROJECT_STAGES, OPERATIONAL_CONDITIONS, BUSINESS_TYPES } from "@/convex/lib/config";

export default function ProfilePage() {
  const org = useQuery(api.organizations.myOrganization);
  const hasVerifiedRules = useQuery(api.organizations.hasVerifiedRules, { state: "Maharashtra", sector: "Food Processing" });
  const saveProfile = useMutation(api.organizations.saveBusinessProfile);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const profile = org?.profile;
  const organization = org?.organization;

  const [form, setForm] = useState({
    businessName: profile ? organization?.name ?? "" : "GreenHarvest Foods Pvt. Ltd.",
    businessType: profile?.businessType ?? "Private Limited Company",
    sector: profile?.sector ?? "Food Processing",
    state: profile?.state ?? "Maharashtra",
    district: profile?.district ?? "Pune",
    projectType: profile?.projectType ?? "New Manufacturing Unit",
    projectStage: profile?.projectStage ?? "Construction",
    investment: profile?.investment ?? 500,
    employeeCount: profile?.employeeCount ?? 80,
    premisesOwnership: profile?.premisesOwnership ?? "Leased",
    landArea: profile?.landArea ?? "2 acres",
    operationalConditions: profile?.operationalConditions ?? ["Packaged Goods Sales"],
    contactName: org?.organization?.contactName ?? "Rajesh Kumar",
    contactEmail: org?.organization?.contactEmail ?? "rajesh@greenharvest.in",
    contactPhone: org?.organization?.contactPhone ?? "+91 98765 43210",
    address: org?.organization?.address ?? "Plot 21, MIDC Bhosari, Pune 411018",
  });

  if (org === undefined) return <Loading />;

  const districts = DISTRICTS[form.state] ?? [];
  const configuredRules = form.sector === "Food Processing" && form.state === "Maharashtra";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveProfile({
        businessName: form.businessName,
        businessType: form.businessType,
        sector: form.sector,
        state: form.state,
        district: form.district,
        projectType: form.projectType,
        projectStage: form.projectStage,
        investment: form.investment,
        employeeCount: form.employeeCount,
        premisesOwnership: form.premisesOwnership,
        landArea: form.landArea,
        operationalConditions: form.operationalConditions,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        address: form.address,
      });
      toast.success("Business profile saved. Deterministic rule evaluation has been re-run.");
      navigate("/applicant/journey");
    } catch (err) {
      toast.error(readErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Business profile" description="Configure your business details. The deterministic rule engine evaluates which approvals apply based on these fields." />

      <Notice tone={configuredRules ? "success" : "warning"}>
        {configuredRules
          ? `Verified regulatory rules are configured for ${form.sector} in ${form.state}. Saving this profile will re-run the deterministic evaluation.`
          : `No verified regulatory rules are currently configured for ${form.sector} in ${form.state}. Saving will succeed but no approvals will apply until rules are verified for this combination.`}
      </Notice>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Business identity" description="Core business information.">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Business name" value={form.businessName} onChange={(v) => setForm((f) => ({ ...f, businessName: v }))} required />
            <Field label="Business type" value={form.businessType} onChange={(v) => setForm((f) => ({ ...f, businessType: v }))} options={BUSINESS_TYPES} />
            <Field label="Sector" value={form.sector} onChange={(v) => setForm((f) => ({ ...f, sector: v, district: "" }))} options={[...SECTORS]} />
            <Field label="Project type" value={form.projectType} onChange={(v) => setForm((f) => ({ ...f, projectType: v }))} options={[...PROJECT_TYPES]} />
          </div>
        </Section>

        <Section title="Location" description="Jurisdiction and district determine which state-level and district-level rules apply.">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="State" value={form.state} onChange={(v) => setForm((f) => ({ ...f, state: v, district: "" }))} options={[...STATES]} />
            <Field label="District" value={form.district} onChange={(v) => setForm((f) => ({ ...f, district: v }))} options={districts} />
          </div>
        </Section>

        <Section title="Project details" description="Investment, scale and operational conditions.">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Project stage" value={form.projectStage} onChange={(v) => setForm((f) => ({ ...f, projectStage: v }))} options={[...PROJECT_STAGES]} />
            <Field label="Investment (₹ lakh)" value={form.investment} type="number" onChange={(v) => setForm((f) => ({ ...f, investment: Number(v) }))} />
            <Field label="Employee count" value={form.employeeCount} type="number" onChange={(v) => setForm((f) => ({ ...f, employeeCount: Number(v) }))} />
            <Field label="Premises ownership" value={form.premisesOwnership ?? ""} onChange={(v) => setForm((f) => ({ ...f, premisesOwnership: v }))} />
            <Field label="Land area" value={form.landArea ?? ""} onChange={(v) => setForm((f) => ({ ...f, landArea: v }))} />
            <div>
              <Label className="text-xs text-muted-foreground">Operational conditions</Label>
              <div className="mt-1.5 space-y-1.5">
                {[...OPERATIONAL_CONDITIONS].map((c) => (
                  <label key={c} className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={form.operationalConditions.includes(c)}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          operationalConditions: e.target.checked
                            ? [...f.operationalConditions, c]
                            : f.operationalConditions.filter((x) => x !== c),
                        }))
                      }
                      className="size-3.5 rounded-sm border"
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Contact information" description="Used for application correspondence.">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Contact name" value={form.contactName ?? ""} onChange={(v) => setForm((f) => ({ ...f, contactName: v }))} />
            <Field label="Contact email" value={form.contactEmail ?? ""} onChange={(v) => setForm((f) => ({ ...f, contactEmail: v }))} type="email" />
            <Field label="Contact phone" value={form.contactPhone ?? ""} onChange={(v) => setForm((f) => ({ ...f, contactPhone: v }))} />
            <Field label="Address" value={form.address ?? ""} onChange={(v) => setForm((f) => ({ ...f, address: v }))} />
          </div>
        </Section>

        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Saving this profile triggers deterministic re-evaluation of all configured regulatory rules against your business profile.
          </p>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            <Save className="mr-2 size-4" />
            Save profile
          </Button>
        </div>
      </form>

      {org?.profile && (
        <Section title="Current evaluation summary">
          <div className="grid gap-x-6 gap-y-1 p-4 text-[13px]">
            <KV k="Business name" v={organization?.name} />
            <KV k="Sector" v={org.profile.sector} />
            <KV k="State" v={org.profile.state} />
            <KV k="District" v={org.profile.district} />
            <KV k="Project type" v={org.profile.projectType} />
            <KV k="Investment" v={fmtINR(org.profile.investment)} />
            <KV k="Employees" v={org.profile.employeeCount} />
          </div>
        </Section>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  options,
  required,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  options?: readonly string[];
  required?: boolean;
}) {
  if (options) {
    return (
      <div>
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 h-9 w-full rounded-md border bg-background px-2.5 text-[13px] outline-none focus:border-neutral-400"
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 h-9 text-[13px]"
      />
    </div>
  );
}
