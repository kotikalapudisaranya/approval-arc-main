// ---------------------------------------------------------------------------
// SLA engine: working days + department working calendar + permitted pause
// states (applicant waiting). Gross time is never used directly — every SLA
// number is derived from the configured working calendar.
// ---------------------------------------------------------------------------
import { Doc } from "../_generated/dataModel";
import { AppStatus, SlaStatus } from "../schema";
import { ReaderCtx, WriterCtx } from "./authz";

export const PAUSE_STATES: AppStatus[] = ["QUERY_RAISED", "WAITING_FOR_APPLICANT"];

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function weekdayName(ms: number): string {
  const names = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return names[new Date(ms).getDay()];
}

export function isWorkingDay(ms: number, cal: Doc<"workingCalendars">): boolean {
  if (!cal.workDays.includes(weekdayName(ms) as (typeof cal.workDays)[number])) return false;
  const holidays = new Set(cal.holidays.map((h) => dayKey(h)));
  if (holidays.has(dayKey(ms))) return false;
  return true;
}

/** Number of working days in [start, end) according to the calendar. */
export function countWorkingDays(
  startMs: number,
  endMs: number,
  cal: Doc<"workingCalendars">,
): number {
  if (endMs <= startMs) return 0;
  let cursor = startOfDay(startMs);
  const end = startOfDay(endMs);
  let count = 0;
  // Safety: at most 3 years of iteration.
  let guard = 0;
  while (cursor < end && guard < 1100) {
    if (isWorkingDay(cursor, cal)) count++;
    cursor += 24 * 60 * 60 * 1000;
    guard++;
  }
  return count;
}

/** Timestamp of the date `days` working days after `startMs`. */
export function addWorkingDays(
  startMs: number,
  days: number,
  cal: Doc<"workingCalendars">,
): number {
  let cursor = startOfDay(startMs);
  let remaining = days;
  let guard = 0;
  while (remaining > 0 && guard < 1100) {
    cursor += 24 * 60 * 60 * 1000;
    if (isWorkingDay(cursor, cal)) remaining--;
    guard++;
  }
  return cursor + 24 * 60 * 60 * 1000 - 1000; // end of that working day
}

const DEFAULT_CAL: Omit<Doc<"workingCalendars">, "_id" | "_creationTime"> = {
  jurisdiction: "INDIA",
  name: "Default working calendar",
  workDays: ["MON", "TUE", "WED", "THU", "FRI"],
  holidays: [],
};

export async function getWorkingCalendar(
  ctx: ReaderCtx | WriterCtx,
  state: string,
): Promise<Doc<"workingCalendars">> {
  const cal = await ctx.db
    .query("workingCalendars")
    .withIndex("by_jurisdiction", (q) => q.eq("jurisdiction", `STATE:${state}`))
    .first();
  if (cal) return cal;
  const def = await ctx.db
    .query("workingCalendars")
    .withIndex("by_jurisdiction", (q) => q.eq("jurisdiction", "INDIA"))
    .first();
  if (def) return def;
  // TypeScript structural fallback (fields match the table schema).
  return { ...DEFAULT_CAL, _id: "" as never, _creationTime: 0 };
}

export type SlaResult = {
  status: SlaStatus | "NOT_STARTED";
  slaWorkingDays: number;
  grossWorkingDays: number;
  officialElapsedWorkingDays: number;
  applicantWaitWorkingDays: number;
  remainingWorkingDays: number;
  grossElapsedMs: number;
  officialElapsedMs: number;
  applicantWaitMs: number;
  calendarName: string;
  note?: string;
};

function intervalWaitWorkingDays(
  intervals: { start: number; end?: number }[],
  now: number,
  cal: Doc<"workingCalendars">,
): number {
  let total = 0;
  for (const iv of intervals) {
    const end = iv.end ?? now;
    if (end > iv.start) total += countWorkingDays(iv.start, end, cal);
  }
  return total;
}

/**
 * Compute SLA for an application. Working-day aware, pause aware.
 * Never pauses because an officer is on leave — that is handled by the
 * department through reassignment, not by stopping the clock.
 */
export async function computeSla(
  ctx: ReaderCtx | WriterCtx,
  app: Doc<"applications">,
  orgState: string,
): Promise<SlaResult> {
  const cal = await getWorkingCalendar(ctx, orgState);
  const now = Date.now();

  if (!app.submittedAt) {
    return {
      status: "NOT_STARTED",
      slaWorkingDays: app.slaWorkingDays,
      grossWorkingDays: 0,
      officialElapsedWorkingDays: 0,
      applicantWaitWorkingDays: 0,
      remainingWorkingDays: app.slaWorkingDays,
      grossElapsedMs: 0,
      officialElapsedMs: 0,
      applicantWaitMs: 0,
      calendarName: cal.name,
      note: "SLA clock starts on submission.",
    };
  }

  const grossWorkingDays = countWorkingDays(app.submittedAt, now, cal);
  const waitWorkingDays = intervalWaitWorkingDays(app.pauseIntervals, now, cal);
  const officialElapsed = Math.max(0, grossWorkingDays - waitWorkingDays);
  const remaining = app.slaWorkingDays - officialElapsed;

  let status: SlaStatus | "NOT_STARTED" = "ON_TRACK";
  if (remaining < 0) status = "BREACHED";
  else if (remaining <= Math.max(1, Math.ceil(app.slaWorkingDays * 0.25))) status = "AT_RISK";

  const grossElapsedMs = now - app.submittedAt;
  const applicantWaitMs = app.applicantWaitMs;

  return {
    status,
    slaWorkingDays: app.slaWorkingDays,
    grossWorkingDays,
    officialElapsedWorkingDays: officialElapsed,
    applicantWaitWorkingDays: waitWorkingDays,
    remainingWorkingDays: Math.max(0, remaining),
    grossElapsedMs,
    officialElapsedMs: grossElapsedMs - applicantWaitMs,
    applicantWaitMs,
    calendarName: cal.name,
  };
}