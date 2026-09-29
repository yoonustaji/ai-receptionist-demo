import type { Weekday } from "../config/business";

// Dates are plain "YYYY-MM-DD" strings and times are "HH:MM" strings in the
// clinic's own time zone, so no time-zone arithmetic is needed after "now".

export type ClinicNow = { date: string; minutes: number };

export function nowInTimeZone(timeZone: string, at: Date = new Date()): ClinicNow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function utc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const d = utc(date);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

export function isValidTime(time: string): boolean {
  return TIME_RE.test(time);
}

export function addDays(date: string, days: number): string {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string): number {
  return Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000);
}

export function weekdayOf(date: string): Weekday {
  return WEEKDAYS[utc(date).getUTCDay()];
}

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type WeekdayName = (typeof WEEKDAY_NAMES)[number];

export function weekdayName(date: string): WeekdayName {
  return WEEKDAY_NAMES[utc(date).getUTCDay()];
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(utc(date));
}

export function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(utc(date));
}

export function formatTime(time: string): string {
  const minutes = toMinutes(time);
  const h = Math.floor(minutes / 60);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(minutes % 60).padStart(2, "0")} ${suffix}`;
}
