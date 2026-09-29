import assert from "node:assert/strict";
import { test } from "node:test";
import {
  availableTimes,
  bookAppointment,
  cancelBooking,
  emptyState,
  findBookings,
  requestCallback,
} from "./calendar";
import { addDays, nowInTimeZone, weekdayName, weekdayOf } from "./dates";

// A fixed "now": Tuesday 2026-09-29, 08:00 clinic time.
const now = { date: "2026-09-29", minutes: 8 * 60 };

function nextOpenDayWithSlots(serviceId: string) {
  for (let i = 1; i < 30; i++) {
    const date = addDays(now.date, i);
    const times = availableTimes(emptyState(), serviceId, date, now);
    if (times.length > 0) return { date, times, weekday: weekdayName(date) };
  }
  throw new Error("no availability found");
}

test("clinic is closed on Sundays", () => {
  const sunday = "2026-10-04";
  assert.equal(weekdayOf(sunday), "sun");
  assert.deepEqual(availableTimes(emptyState(), "checkup", sunday, now), []);
});

test("no times in the past, beyond the booking window, or inside the notice period", () => {
  assert.deepEqual(availableTimes(emptyState(), "checkup", "2026-09-28", now), []);
  assert.deepEqual(availableTimes(emptyState(), "checkup", addDays(now.date, 60), now), []);
  const today = availableTimes(emptyState(), "kids-checkup", now.date, now);
  assert.ok(today.every((t) => t >= "10:00"), "same-day slots respect 2 hours' notice");
});

test("appointments end before closing time", () => {
  const { date, times } = nextOpenDayWithSlots("new-patient");
  assert.ok(times.length > 0);
  for (const t of times) {
    const [h, m] = t.split(":").map(Number);
    assert.ok(h * 60 + m + 90 <= 19 * 60, `${date} ${t} runs past closing`);
  }
});

test("booking takes the slot and blocks overlapping times", () => {
  const { date, times, weekday } = nextOpenDayWithSlots("checkup");
  const result = bookAppointment(
    emptyState(),
    { serviceId: "checkup", date, weekday, time: times[0], customerName: "Jane Doe", customerPhone: "+1 555 010 1234" },
    now,
  );
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.match(result.value.id, /^BK-\d{4}$/);
  assert.ok(!availableTimes(result.state, "checkup", date, now).includes(times[0]));

  const again = bookAppointment(
    result.state,
    { serviceId: "checkup", date, weekday, time: times[0], customerName: "John Roe", customerPhone: "555-010-9999" },
    now,
  );
  assert.equal(again.ok, false);
});

test("booking rejects bad input", () => {
  const { date, times, weekday } = nextOpenDayWithSlots("checkup");
  const base = { serviceId: "checkup", date, weekday, time: times[0], customerName: "Jane Doe", customerPhone: "5550101234" };
  assert.equal(bookAppointment(emptyState(), { ...base, serviceId: "nope" }, now).ok, false);
  assert.equal(bookAppointment(emptyState(), { ...base, date: "2026-02-30" }, now).ok, false);
  assert.equal(bookAppointment(emptyState(), { ...base, time: "9am" }, now).ok, false);
  assert.equal(bookAppointment(emptyState(), { ...base, customerName: " " }, now).ok, false);
  assert.equal(bookAppointment(emptyState(), { ...base, customerPhone: "12" }, now).ok, false);
});

test("booking is refused when the weekday doesn't match the date", () => {
  // 2026-10-07 is a Wednesday. Telling the patient "Tuesday" must not book it.
  const wednesday = "2026-10-07";
  const times = availableTimes(emptyState(), "checkup", wednesday, now);
  assert.ok(times.length > 0);
  const base = { serviceId: "checkup", date: wednesday, time: times[0], customerName: "Jane Doe", customerPhone: "5550101234" };

  const wrong = bookAppointment(emptyState(), { ...base, weekday: "Tuesday" }, now);
  assert.equal(wrong.ok, false);
  if (!wrong.ok) assert.match(wrong.error, /is a Wednesday, not a Tuesday/);

  assert.ok(bookAppointment(emptyState(), { ...base, weekday: "Wednesday" }, now).ok);
  assert.ok(bookAppointment(emptyState(), { ...base, weekday: " wednesday " }, now).ok, "case and spaces ignored");
});

test("find and cancel match on phone number, ignoring formatting", () => {
  const { date, times, weekday } = nextOpenDayWithSlots("checkup");
  const booked = bookAppointment(
    emptyState(),
    { serviceId: "checkup", date, weekday, time: times[0], customerName: "Jane Doe", customerPhone: "(555) 010-1234" },
    now,
  );
  assert.ok(booked.ok);
  if (!booked.ok) return;

  assert.equal(findBookings(booked.state, "555.010.1234", now).length, 1);
  assert.equal(findBookings(booked.state, "555 010 9999", now).length, 0);

  assert.equal(cancelBooking(booked.state, booked.value.id, "555 010 9999").ok, false);
  const cancelled = cancelBooking(booked.state, booked.value.id.toLowerCase(), "+1 555 010 1234");
  assert.ok(cancelled.ok);
  if (!cancelled.ok) return;
  assert.equal(findBookings(cancelled.state, "5550101234", now).length, 0);
  assert.ok(availableTimes(cancelled.state, "checkup", date, now).includes(times[0]));
});

test("callback requests need a name and phone", () => {
  assert.equal(requestCallback(emptyState(), { customerName: "", customerPhone: "5550101234", reason: "x" }).ok, false);
  const ok = requestCallback(emptyState(), { customerName: "Jane", customerPhone: "5550101234", reason: "Insurance question" });
  assert.ok(ok.ok);
});

test("clinic clock reads the time zone correctly", () => {
  // 2026-09-29 03:30 UTC is 23:30 the previous day in New York (UTC-4 in September).
  const t = nowInTimeZone("America/New_York", new Date("2026-09-29T03:30:00Z"));
  assert.equal(t.date, "2026-09-28");
  assert.equal(t.minutes, 23 * 60 + 30);
});
