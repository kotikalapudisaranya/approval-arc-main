import { Link } from "react-router";
import { ArrowRight, ArrowUpRight, Check, PanelLeft } from "lucide-react";

const steps = [
  "Discover",
  "Prepare",
  "Validate",
  "Coordinate",
  "Submit",
  "Track",
  "Comply",
];

const principles = [
  {
    n: "01",
    title: "WHY",
    body: "Understand exactly why an approval applies to your business — which configured rule triggers it, from which authority, and which source it comes from.",
  },
  {
    n: "02",
    title: "WHAT NEXT",
    body: "See prerequisites, dependencies and actions that can run in parallel, so the journey is sequenced correctly and nothing waits needlessly.",
  },
  {
    n: "03",
    title: "WHERE STUCK",
    body: "See precisely where an application is waiting, who needs to act, and how the configured SLA clock is tracking — in working days, not wall time.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Top bar */}
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-[5px] bg-neutral-900 text-white">
              <PanelLeft className="size-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">ApprovalArc</span>
          </div>
          <nav className="hidden items-center gap-6 text-[13px] text-muted-foreground sm:flex">
            <a href="#process" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#why" className="transition-colors hover:text-foreground">Why ApprovalArc</a>
            <a href="#positioning" className="transition-colors hover:text-foreground">Positioning</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/auth/department"
              className="rounded-sm border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-muted"
            >
              Department console
            </Link>
            <Link
              to="/auth/applicant"
              className="rounded-sm bg-neutral-900 px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85"
            >
              Sign in
            </Link>
            <Link
              to="/auth/applicant/signup"
              className="hidden rounded-sm border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-muted sm:inline-flex"
            >
              Create account
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:py-32">
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Smart India Hackathon 2026 · SH26130
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl">
            Turn fragmented industrial approvals into one intelligent journey.
          </h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-7 text-muted-foreground">
            Discover requirements, prepare documents, coordinate workflows, track SLAs and stay
            compliant — while government authorities remain the final decision-makers.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              to="/auth/applicant"
              className="group inline-flex items-center gap-2 rounded-sm bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85"
            >
              Start an application
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/auth/applicant/signup"
              className="inline-flex items-center gap-2 rounded-sm border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              Create applicant account
              <ArrowUpRight className="size-4" />
            </Link>
            <Link
              to="/auth/department"
              className="inline-flex items-center gap-2 rounded-sm border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              Explore department console
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <p className="mt-10 max-w-xl border-l-2 border-neutral-300 pl-3 text-xs leading-5 text-muted-foreground">
            ApprovalArc does not replace government portals or automate the government decision. It
            automates the complexity around the decision — the journey across approvals.
          </p>
        </div>
      </section>

      {/* Process */}
      <section id="process" className="border-b">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            One coordinated journey
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-y-3">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full border border-neutral-300 text-[11px] font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="text-[13px] font-medium">{s}</span>
                </div>
                {i < steps.length - 1 && (
                  <span className="mx-3 h-px w-6 bg-neutral-300 sm:w-8" />
                )}
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-2xl text-sm leading-6 text-muted-foreground">
            Government portals process individual approvals. ApprovalArc manages the journey across
            them — discover what applies, prepare the right documents, validate them deterministically,
            coordinate the workflow, submit through the gateway, track the SLA and stay compliant
            after approval.
          </p>
        </div>
      </section>

      {/* Why */}
      <section id="why" className="border-b">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Why ApprovalArc?
          </p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3">
            {principles.map((p) => (
              <div key={p.n} className="bg-background p-6">
                <p className="text-xs font-semibold text-neutral-400">{p.n}</p>
                <h3 className="mt-3 text-sm font-semibold tracking-wide">{p.title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3">
            {[
              ["WHAT DO I NEED?", "Every applicable approval is derived from verified, explainable regulatory rules — never guessed."],
              ["ARE MY DOCUMENTS READY?", "Documents are hashed, extracted, validated and cross-checked deterministically. No AI in the pipeline."],
              ["WHAT DO I COMPLY WITH AFTER APPROVAL?", "Post-approval obligations are generated from the same configured rules into a compliance calendar."],
            ].map(([h, b]) => (
              <div key={h} className="flex items-start gap-3 bg-background px-6 py-5">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-[13px] font-semibold">{h}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{b}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Positioning */}
      <section id="positioning" className="border-b">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-10 sm:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                ApprovalArc does not replace government portals. It orchestrates the journey around
                them.
              </h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Applicability is configured, not generated. Validation is deterministic. Workflow
                transitions are governed by a state machine. Every rule shows its authority, source,
                version and last verification date — and final approval always remains with the
                competent government authority.
              </p>
            </div>
            <dl className="grid gap-px self-start overflow-hidden rounded-md border bg-border text-[13px]">
              {[
                ["Submission readiness", "Configured checks show whether documents, information and prerequisites are complete before you submit."],
                ["SLA tracking", "Elapsed time is measured in working days against a department calendar, pausing only for permitted applicant-waiting states."],
                ["Issuer verification", "A clearly-labelled prototype verification gateway simulates certificate lookups for demonstration."],
              ].map(([k, v]) => (
                <div key={k} className="bg-background px-4 py-3">
                  <dt className="font-medium">{k}</dt>
                  <dd className="mt-0.5 leading-5 text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="mx-auto max-w-6xl px-5 py-20 text-center">
          <h2 className="mx-auto max-w-xl text-2xl font-semibold tracking-tight">
            Industrial approvals, coordinated in one journey.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            Built for the Smart India Hackathon. Applicant and department demo accounts are provided
            on the sign-in pages — clearly labelled as prototypes, not real credentials.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth/applicant"
              className="inline-flex items-center gap-2 rounded-sm bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85"
            >
              Applicant sign in
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/auth/department"
              className="inline-flex items-center gap-2 rounded-sm border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              Department sign in
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>ApprovalArc — prototype for Smart India Hackathon 2026 problem statement SH26130.</p>
          <p className="max-w-md text-right">
            Final approval remains with the competent government authority.
          </p>
        </div>
      </footer>
    </div>
  );
}
