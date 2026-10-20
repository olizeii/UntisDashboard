// Time helpers that are safe to use on both server and client.
// All "school time" values are expressed in the school's time zone, independent
// of where the server (often UTC) or the browser runs.

export const DEFAULT_TIMEZONE = "Europe/Vienna";

export interface ZonedNow {
  /** YYYY-MM-DD */
  date: string;
  /** minutes since midnight */
  minutes: number;
  /** seconds within the current minute (for countdowns) */
  seconds: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

export function zonedNow(epochMs: number, timeZone: string): ZonedNow {
  const parts = partsFormatter(timeZone).formatToParts(new Date(epochMs));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    seconds: Number(get("second")),
  };
}

/** "HH:MM" -> minutes since midnight. Returns NaN for invalid input. */
export function parseTime(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return NaN;
  return h * 60 + min;
}

/** minutes since midnight -> "HH:MM" */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Untis integer time (e.g. 745, 1330) -> minutes since midnight */
export function untisTimeToMinutes(value: number): number {
  return Math.floor(value / 100) * 60 + (value % 100);
}

/** Untis integer date (20261020) -> "2026-10-20" */
export function untisDateToIso(value: number): string {
  const s = String(value);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** "2026-10-20" -> 20261020 */
export function isoToUntisDate(iso: string): number {
  return Number(iso.replaceAll("-", ""));
}

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** Add days to an ISO date (calendar arithmetic, time-zone independent). */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO weekday: 1 = Monday … 7 = Sunday */
export function isoWeekday(iso: string): number {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  return addDays(iso, 1 - isoWeekday(iso));
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) /
      86_400_000,
  );
}

const weekdayFormatter = new Intl.DateTimeFormat("de-AT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const shortDateFormatter = new Intl.DateTimeFormat("de-AT", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

/** "Dienstag, 20. Oktober" */
export function formatLongDate(iso: string): string {
  return weekdayFormatter.format(new Date(`${iso}T00:00:00Z`));
}

/** "Di., 20.10." */
export function formatShortDate(iso: string): string {
  return shortDateFormatter.format(new Date(`${iso}T00:00:00Z`));
}

/** Human readable duration in German: "1 Std. 5 Min." / "12 Min." */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} Min.`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min.`;
}
