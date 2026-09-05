import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ReactNode } from "react";
import { StatusMeta, Tone, toneClasses, dotTone } from "@/lib/format";

export function StatusBadge({ meta, dot = true }: { meta?: StatusMeta; dot?: boolean }) {
  if (!meta) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        toneClasses[meta.tone],
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dotTone[meta.tone])} />}
      {meta.label}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed px-6 py-14 text-center">
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      <h3 className="text-sm font-medium">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  padded,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn("rounded-md border bg-card", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            {title && <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(padded && "p-4")}>{children}</div>
    </section>
  );
}

export function KV({
  k,
  v,
  mono,
}: {
  k: string;
  v?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b py-2 text-[13px] last:border-0">
      <dt className="shrink-0 text-muted-foreground">{k}</dt>
      <dd className={cn("text-right", mono && "font-mono text-xs")}>{v ?? "—"}</dd>
    </div>
  );
}

export function Dot({ tone }: { tone: Tone }) {
  return <span className={cn("inline-block size-1.5 rounded-full", dotTone[tone])} />;
}

export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2.5 rounded-sm border px-3 py-2.5 text-xs leading-5", toneClasses[tone], className)}>
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        <div className={cn(tone !== "muted" && "opacity-90")}>{children}</div>
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  hint?: string;
}) {
  return (
    <div className="rounded-md border px-4 py-3">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-2 text-lg font-semibold tracking-tight tabular-nums">
        <Dot tone={tone} />
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm border bg-neutral-50 px-3 py-1.5 text-[11px] text-neutral-500">
      <span>Demo environment — seeded, clearly-labelled prototype data. Not a live government connection.</span>
    </div>
  );
}

export { Button, Badge };