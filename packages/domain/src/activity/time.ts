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

/**
 * Start day key of an inclusive rolling window of `days` calendar days ending
 * on `date` (spec §4.6). Because the activity query is inclusive on both ends,
 * a 30-day window spans the end day plus the 29 before it. Anchoring on the
 * calendar day (noon UTC) keeps the arithmetic correct regardless of the
 * configured timezone instead of blindly subtracting fixed 24h blocks.
 */
export function rollingWindowStart(date: Date, days: number, timeZone: string): string {
  const [year, month, day] = dateKey(date, timeZone).split("-").map(Number);
  const anchor = Date.UTC(year, month - 1, day, 12);
  const start = new Date(anchor - (days - 1) * 24 * 60 * 60 * 1000);
  return dateKey(start, "UTC");
}
