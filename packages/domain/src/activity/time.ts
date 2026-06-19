/**
 * Date-bucketing helpers (spec §4.6). All keys are `YYYY-MM-DD` strings in a
 * given timezone, matching the `activity_daily.date` column.
 */

/** The calendar-day key for `date` in `timeZone` (e.g. "2026-06-19"). */
export function dateKey(date: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Inclusive [start, end] day keys for the calendar month containing `date`. */
export function monthRange(date: Date, timeZone: string): { start: string; end: string } {
  const today = dateKey(date, timeZone);
  const [year, month] = today.split("-");
  return { start: `${year}-${month}-01`, end: today };
}

/** The day key `days` before `date` — start of a rolling window (spec §4.6). */
export function rollingWindowStart(date: Date, days: number, timeZone: string): string {
  const past = new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
  return dateKey(past, timeZone);
}
