import { z } from "zod";
import { business, getService } from "../config/business";
import {
  addDays,
  diffDays,
  fromMinutes,
  isValidDate,
  isValidTime,
  toMinutes,
  weekdayOf,
  type ClinicNow,
} from "./dates";

// Each visitor gets a private sandbox calendar. Their bookings live in their
// browser and travel with each request, so the server stays stateless and
// visitors never see each other's data.

export const BookingSchema = z.object({
  id: z.string().max(20),
  serviceId: z.string().max(40),
  date: z.string().max(10),
  time: z.string().max(5),
  customerName: z.string().max(80),
  customerPhone: z.string().max(30),
  notes: z.string().max(300).optional(),
  status: z.enum(["confirmed", "cancelled"]),
  createdAt: z.string().max(40),
});

export const CallbackSchema = z.object({
  id: z.string().max(20),
  customerName: z.string().max(80),
  customerPhone: z.string().max(30),
  reason: z.string().max(300),
  createdAt: z.string().max(40),
});

export const MAX_RECORDS = 50;

export const DemoStateSchema = z.object({
  bookings: z.array(BookingSchema).max(MAX_RECORDS),
  callbacks: z.array(CallbackSchema).max(MAX_RECORDS),
});

export type Booking = z.infer<typeof BookingSchema>;
export type Callback = z.infer<typeof CallbackSchema>;
export type DemoState = z.infer<typeof DemoStateSchema>;

export type Result<T> =
  | { ok: true; value: T; state: DemoState }
  | { ok: false; error: string };

export function emptyState(): DemoState {
  return { bookings: [], callbacks: [] };
}

// FNV-1a: a stable hash, so the same slot is always busy or always free.
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function isSeedBusy(date: string, time: string): boolean {
  return hash(`${date}|${time}`) % 100 < business.seedBusyPercent;
}

function overlaps(aStart: number, aDuration: number, bStart: number, bDuration: number) {
  return aStart < bStart + bDuration && bStart < aStart + aDuration;
}

function isSlotFree(state: DemoState, date: string, start: number, duration: number): boolean {
  for (let m = start; m < start + duration; m += business.slotMinutes) {
    if (isSeedBusy(date, fromMinutes(m))) return false;
  }
  return !state.bookings.some(
    (b) =>
      b.status === "confirmed" &&
      b.date === date &&
      overlaps(
        toMinutes(b.time),
        getService(b.serviceId)?.durationMin ?? business.slotMinutes,
        start,
        duration,
      ),
  );
}

export function availableTimes(
  state: DemoState,
  serviceId: string,
  date: string,
  now: ClinicNow,
): string[] {
  const service = getService(serviceId);
  if (!service || !isValidDate(date)) return [];
  const offset = diffDays(now.date, date);
  if (offset < 0 || offset > business.bookingWindowDays) return [];
  const hours = business.hours[weekdayOf(date)];
  if (!hours) return [];

  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  const earliest = offset === 0 ? now.minutes + business.minNoticeMinutes : 0;
  const times: string[] = [];
  for (let m = open; m + service.durationMin <= close; m += business.slotMinutes) {
    if (m >= earliest && isSlotFree(state, date, m, service.durationMin)) {
      times.push(fromMinutes(m));
    }
  }
  return times;
}

export type DayAvailability = { date: string; closed: boolean; times: string[] };

export function availabilityRange(
  state: DemoState,
  serviceId: string,
  startDate: string,
  days: number,
  now: ClinicNow,
): DayAvailability[] {
  const start = diffDays(now.date, startDate) < 0 ? now.date : startDate;
  const result: DayAvailability[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const closed = business.hours[weekdayOf(date)] === null;
    result.push({ date, closed, times: closed ? [] : availableTimes(state, serviceId, date, now) });
  }
  return result;
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return (raw.trim().startsWith("+") ? "+" : "") + digits;
}

function samePhone(a: string, b: string): boolean {
  const da = a.replace(/\D/g, "");
  const db = b.replace(/\D/g, "");
  return da.length >= 7 && db.length >= 7 && da.slice(-10) === db.slice(-10);
}

function newId(prefix: string, taken: string[]): string {
  for (;;) {
    const id = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!taken.includes(id)) return id;
  }
}

export type BookingInput = {
  serviceId: string;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  notes?: string;
};

export function bookAppointment(
  state: DemoState,
  input: BookingInput,
  now: ClinicNow,
): Result<Booking> {
  const service = getService(input.serviceId);
  if (!service) return { ok: false, error: "Unknown service." };
  if (!isValidDate(input.date)) return { ok: false, error: "Date must be YYYY-MM-DD." };
  if (!isValidTime(input.time)) return { ok: false, error: "Time must be HH:MM in 24-hour format." };
  const name = input.customerName.trim();
  if (name.length < 2) return { ok: false, error: "The patient's full name is required." };
  const phone = normalizePhone(input.customerPhone);
  if (!phone) return { ok: false, error: "A valid phone number is required." };
  if (state.bookings.length >= MAX_RECORDS) {
    return { ok: false, error: "The demo calendar is full. Ask the visitor to press Reset demo." };
  }
  if (!availableTimes(state, service.id, input.date, now).includes(input.time)) {
    return {
      ok: false,
      error: "That time is not available. Check availability again and offer other times.",
    };
  }

  const booking: Booking = {
    id: newId("BK", state.bookings.map((b) => b.id)),
    serviceId: service.id,
    date: input.date,
    time: input.time,
    customerName: name.slice(0, 80),
    customerPhone: phone,
    notes: input.notes?.trim().slice(0, 300) || undefined,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };
  return { ok: true, value: booking, state: { ...state, bookings: [...state.bookings, booking] } };
}

export function findBookings(state: DemoState, phone: string, now: ClinicNow): Booking[] {
  return state.bookings
    .filter(
      (b) =>
        b.status === "confirmed" &&
        samePhone(b.customerPhone, phone) &&
        diffDays(now.date, b.date) >= 0,
    )
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

export function cancelBooking(state: DemoState, bookingId: string, phone: string): Result<Booking> {
  const id = bookingId.trim().toUpperCase();
  const booking = state.bookings.find((b) => b.id === id);
  if (!booking || !samePhone(booking.customerPhone, phone)) {
    return { ok: false, error: "No booking found with that reference and phone number." };
  }
  if (booking.status === "cancelled") {
    return { ok: false, error: "That booking is already cancelled." };
  }
  const cancelled: Booking = { ...booking, status: "cancelled" };
  return {
    ok: true,
    value: cancelled,
    state: { ...state, bookings: state.bookings.map((b) => (b.id === id ? cancelled : b)) },
  };
}

export function requestCallback(
  state: DemoState,
  input: { customerName: string; customerPhone: string; reason: string },
): Result<Callback> {
  const name = input.customerName.trim();
  if (name.length < 2) return { ok: false, error: "The patient's name is required." };
  const phone = normalizePhone(input.customerPhone);
  if (!phone) return { ok: false, error: "A valid phone number is required." };
  if (state.callbacks.length >= MAX_RECORDS) {
    return { ok: false, error: "The demo is full. Ask the visitor to press Reset demo." };
  }
  const callback: Callback = {
    id: newId("CB", state.callbacks.map((c) => c.id)),
    customerName: name.slice(0, 80),
    customerPhone: phone,
    reason: input.reason.trim().slice(0, 300),
    createdAt: new Date().toISOString(),
  };
  return { ok: true, value: callback, state: { ...state, callbacks: [...state.callbacks, callback] } };
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `•••${digits.slice(-4)}`;
}
