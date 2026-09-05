import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { roleHome } from "@/components/app/AppShell";
import { api } from "@/convex/_generated/api";
import { Link, useNavigate, useSearchParams } from "react-router";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { ArrowRight, Building2, Loader2, PanelLeft, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "applicant" | "department";

const DEMO: Record<Mode, { label: string; email: string; hint: string }[]> = {
  applicant: [
    {
      label: "Demo applicant account",
      email: "demo.applicant@approvalarc.in",
      hint: "GreenHarvest Foods Pvt. Ltd. — business profile, applications, documents and journey pre-loaded.",
    },
  ],
  department: [
    {
      label: "Demo officer account",
      email: "demo.officer@mpcb.in",
      hint: "Maharashtra Pollution Control Board — officer queue, queries and inspections.",
    },
    {
      label: "Demo supervisor account",
      email: "demo.supervisor@mpcb.in",
      hint: "MPCB supervisor — can move applications to decision and approve/reject.",
    },
    {
      label: "Demo administrator account",
      email: "demo.admin@approvalarc.in",
      hint: "System administrator — regulatory rule lifecycle, users & roles, audit log.",
    },
  ],
};

function readError(e: unknown): string {
  const err = e as { message?: string; data?: { message?: string } };
  return err?.data?.message ?? err?.message ?? "Sign-in failed. Please try again.";
}

function AuthView({ mode, initialView = "signin" }: { mode: Mode; initialView?: "signin" | "signup" }) {
  const { isLoading, isAuthenticated, user, signIn } = useAuth();
  const completeApplicantSignup = useMutation(api.users.completeApplicantSignup);
  const bootstrapDemo = useAction(api.seed.bootstrapDemo);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(initialView === "signup");
  const [pendingSignupName, setPendingSignupName] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (pendingSignupName && user) {
      let cancelled = false;
      void (async () => {
        try {
          await completeApplicantSignup({ name: pendingSignupName });
          if (!cancelled) {
            setPendingSignupName(null);
            navigate(returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/applicant/profile");
          }
        } catch (err) {
          if (!cancelled) {
            setError(readError(err));
            setBusy(null);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    if (user?.role) {
      if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
        navigate(returnTo);
      } else {
        navigate(roleHome(user.role));
      }
    }
  }, [isLoading, isAuthenticated, user, navigate, returnTo, pendingSignupName, completeApplicantSignup]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password || (isSignUp && !name)) {
      setError(isSignUp ? "Enter your name, email and password." : "Enter your email and password.");
      return;
    }
    setBusy("signin");
    if (isSignUp) setPendingSignupName(name);
    try {
      await signIn("password", { email, password, flow: isSignUp ? "signUp" : "signIn" });
    } catch (err) {
      const message = readError(err);
      if (isSignUp && message.toLowerCase().includes("already exists")) {
        setIsSignUp(false);
        setError("An account with this email already exists. Sign in with your existing password.");
      } else {
        setError(message);
      }
      setPendingSignupName(null);
      setBusy(null);
    }
  };

  const handlePasswordReset = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setBusy("reset");
    try {
      if (!resetRequested) {
        await signIn("password", { email: resetEmail.trim(), flow: "reset" });
        setResetRequested(true);
        setError("A reset code was printed in the local Convex terminal.");
      } else {
        await signIn("password", {
          email: resetEmail.trim(),
          code: resetCode.trim(),
          newPassword,
          flow: "reset-verification",
        });
        setResetMode(false);
        setResetRequested(false);
        setError("Password updated. Sign in with your new password.");
      }
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(null);
    }
  };

  const demo = async (email: string) => {
    setError(null);
    setBusy(email);
    try {
      await bootstrapDemo({});
      await signIn("password", { email, password: "DemoPass@2026", flow: "signIn" });
    } catch (err) {
      setError(readError(err));
      setBusy(null);
    }
  };

  const applicant = mode === "applicant";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left brand panel */}
      <div className="hidden w-[46%] flex-col justify-between border-r bg-neutral-950 p-10 text-white lg:flex">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-[5px] bg-white text-neutral-900">
            <PanelLeft className="size-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">ApprovalArc</span>
        </Link>
        <div>
          <h1 className="max-w-md text-2xl leading-snug font-semibold tracking-tight">
            {applicant
              ? "Turn fragmented industrial approvals into one intelligent journey."
              : "One console for the approvals that reach your department."}
          </h1>
          <p className="mt-4 max-w-md text-[13px] leading-6 text-neutral-400">
            {applicant
              ? "Discover requirements, prepare documents, coordinate workflows, track SLAs and stay compliant — with government authorities as the final decision-makers."
              : "Manage the application queue, raise queries, schedule inspections, monitor SLA in working days and keep an audited trail of every action."}
          </p>
          <div className="mt-8 flex items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-neutral-300">
            <Sparkles className="size-3.5" />
            Deterministic rules · No AI decisions · Authority remains final
          </div>
        </div>
        <p className="text-[11px] text-neutral-500">
          Prototype for Smart India Hackathon 2026 · SH26130
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-[5px] bg-neutral-900 text-white">
                <PanelLeft className="size-4" />
              </span>
              <span className="text-[15px] font-semibold tracking-tight">ApprovalArc</span>
            </Link>
          </div>

          <div className="mb-6 flex size-9 items-center justify-center rounded-md border bg-muted/60">
            {applicant ? <Building2 className="size-4" /> : <ShieldCheck className="size-4" />}
          </div>
          <h2 className="text-xl font-semibold tracking-tight">
            {resetMode ? "Reset password" : applicant ? "Applicant sign in" : "Department sign in"}
          </h2>
          <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
            {applicant
              ? "Sign in to manage your business's approval journey."
              : "Official sign-in for department officers, supervisors and administrators."}
          </p>

          <form onSubmit={resetMode ? handlePasswordReset : handleSubmit} className="mt-7 space-y-4">
            {resetMode ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email" className="text-xs text-muted-foreground">Email</Label>
                  <Input id="reset-email" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="h-9 text-[13px]" required />
                </div>
                {resetRequested && (
                  <>
                    <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                      Enter the OTP shown in the local Convex terminal.
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reset-code" className="text-xs text-muted-foreground">Reset code</Label>
                      <Input id="reset-code" value={resetCode} onChange={(e) => setResetCode(e.target.value)} className="h-9 text-[13px]" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-password" className="text-xs text-muted-foreground">New password</Label>
                      <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-9 text-[13px]" minLength={8} required />
                    </div>
                  </>
                )}
                {error && <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{error}</p>}
                <Button type="submit" disabled={!!busy} className="h-9 w-full">
                  {busy === "reset" && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {resetRequested ? "Set new password" : "Send reset code"}
                </Button>
                <button type="button" onClick={() => { setResetMode(false); setResetRequested(false); setError(null); }} className="w-full text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
                  Back to sign in
                </button>
              </>
            ) : (
            <>
            {applicant && isSignUp && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs text-muted-foreground">Full name</Label>
                <Input id="name" name="name" autoComplete="name" className="h-9 text-[13px]" required />
              </div>
            )}
            {!applicant && (
              <div className="space-y-1.5">
                <Label htmlFor="department" className="text-xs text-muted-foreground">
                  Department
                </Label>
                <Input
                  id="department"
                  name="department"
                  defaultValue="Maharashtra Pollution Control Board"
                  disabled
                  className="h-9 bg-muted/50 text-[13px]"
                />
                <p className="text-[10px] text-muted-foreground">
                  Demo configuration — only MPCB demo rules are seeded.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">
                {applicant ? "Email" : "Official email / employee ID"}
              </Label>
              <Input
                id="email"
                name="email"
                type="text"
                placeholder={applicant ? "name@company.in" : "name@department.gov.in"}
                autoComplete="username"
                className="h-9 text-[13px]"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                className="h-9 text-[13px]"
                required
              />
            </div>
            {error && (
              <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" disabled={!!busy} className="h-9 w-full">
              {busy === "signin" ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 size-4" />
              )}
              {isSignUp ? "Create account" : "Sign in"}
            </Button>
            {!isSignUp && (
              <button type="button" onClick={() => { setResetMode(true); setResetRequested(false); setResetEmail(""); setError(null); }} className="w-full text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
                Forgot password?
              </button>
            )}
            </>
            )}
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Demo account
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {applicant && (
            <button
              type="button"
              onClick={() => { setIsSignUp((value) => !value); setError(null); }}
              className="mt-5 w-full text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {isSignUp ? "Already have an account? Sign in" : "New applicant? Create an account"}
            </button>
          )}

          <div className="space-y-2">
            {DEMO[mode].map((d) => (
              <button
                key={d.email}
                type="button"
                disabled={!!busy}
                onClick={() => void demo(d.email)}
                className={cn(
                  "flex w-full items-start justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                  busy === d.email ? "opacity-60" : "hover:bg-muted/60",
                )}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium">
                    {busy === d.email && <Loader2 className="size-3.5 animate-spin" />}
                    {d.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                    {d.email} · password: DemoPass@2026
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-muted-foreground/80">
                    {d.hint}
                  </span>
                </span>
                <ArrowRight className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>

          <p className="mt-6 text-center text-[11px] leading-4 text-muted-foreground">
            Demo accounts are clearly-labelled prototype credentials — they are not real government
            accounts.{" "}
            <Link to={applicant ? "/auth/department" : "/auth/applicant"} className="underline hover:text-foreground">
              {applicant ? "Department sign in instead" : "Applicant sign in instead"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage({ mode = "applicant", initialView = "signin" }: { mode?: Mode; initialView?: "signin" | "signup" }) {
  return (
    <Suspense>
      <AuthView mode={mode} initialView={initialView} />
    </Suspense>
  );
}
