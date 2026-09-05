import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./ui";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export function DataTable<T>({
  columns,
  rows,
  emptyTitle = "No records",
  emptyDescription,
  onRowClick,
  keyOf,
  dense,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  keyOf: (row: T) => string;
  dense?: boolean;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b bg-muted/40">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase",
                  c.headerClassName,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={keyOf(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-b last:border-0 hover:bg-muted/30",
                onRowClick && "cursor-pointer",
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("px-3 text-[13px]", dense && "py-1.5", !dense && "py-2.5", c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pct({ value, label }: { value: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full", value >= 100 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-red-500")}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">{label ?? `${value}%`}</span>
    </span>
  );
}