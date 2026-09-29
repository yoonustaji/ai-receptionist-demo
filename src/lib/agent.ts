import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { business, getService, serviceIds } from "../config/business";
import {
  availabilityRange,
  bookAppointment,
  cancelBooking,
  findBookings,
  maskPhone,
  requestCallback,
  type DemoState,
} from "./calendar";
import {
  WEEKDAY_NAMES,
  formatShortDate,
  formatTime,
  isValidDate,
  nowInTimeZone,
  type ClinicNow,
} from "./dates";
import { STATIC_SYSTEM_PROMPT, clinicClock, upcomingDates } from "./prompt";
import { MAX_CHECKS_PER_TURN, type ActivityEvent, type AvailabilityCheck, type ChatTurn } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";
const EFFORT = (process.env.AGENT_EFFORT || "medium") as "low" | "medium" | "high";

// Not every model accepts every option: Haiku 4.5 rejects the effort setting, and
// server-side refusal fallbacks exist for Claude Opus 5 and Claude Fable models.
const SUPPORTS_EFFORT = !MODEL.startsWith("claude-haiku");
const SUPPORTS_FALLBACKS = /^claude-(opus-5|fable)/.test(MODEL);
const MAX_TIMES_PER_DAY = 12;

let client: Anthropic | undefined;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export type ReceptionistReply = {
  reply: string;
  checks: AvailabilityCheck[];
  state: DemoState;
  activity: ActivityEvent[];
};

function availabilityResult(state: DemoState, check: AvailabilityCheck, now: ClinicNow): string {
  const service = getService(check.serviceId);
  const range = availabilityRange(state, check.serviceId, check.startDate, check.days, now);
  return JSON.stringify({
    service: service?.name,
    duration_minutes: service?.durationMin,
    days: range.map((d) => ({
      date: d.date,
      label: formatShortDate(d.date),
      closed: d.closed,
      open_times: d.times.slice(0, MAX_TIMES_PER_DAY),
      more_times_available: d.times.length > MAX_TIMES_PER_DAY,
    })),
  });
}

// The browser sends back plain text for earlier turns, plus the parameters of any
// availability checks. Rebuild those checks as tool calls with freshly computed
// results, so the model remembers which times it offered without re-checking.
function buildHistory(
  history: ChatTurn[],
  state: DemoState,
  now: ClinicNow,
): Anthropic.Beta.BetaMessageParam[] {
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  history.forEach((turn, i) => {
    const checks = turn.role === "assistant" ? (turn.checks ?? []).slice(0, MAX_CHECKS_PER_TURN) : [];
    if (checks.length > 0) {
      const ids = checks.map((_, j) => `toolu_history_${i}_${j}`);
      messages.push({
        role: "assistant",
        content: checks.map((c, j) => ({
          type: "tool_use" as const,
          id: ids[j],
          name: "check_availability",
          input: { service_id: c.serviceId, start_date: c.startDate, days: c.days },
        })),
      });
      messages.push({
        role: "user",
        content: checks.map((c, j) => ({
          type: "tool_result" as const,
          tool_use_id: ids[j],
          content: availabilityResult(state, c, now),
        })),
      });
    }
    messages.push({ role: turn.role, content: turn.text });
  });
  return messages;
}

export async function runReceptionist(
  history: ChatTurn[],
  initialState: DemoState,
): Promise<ReceptionistReply> {
  let state = initialState;
  const activity: ActivityEvent[] = [];
  const checks: AvailabilityCheck[] = [];
  const now = nowInTimeZone(business.timeZone);

  const log = (tool: string, ok: boolean, summary: string) =>
    activity.push({ tool, ok, summary, at: new Date().toISOString() });

  const checkAvailability = betaZodTool({
    name: "check_availability",
    description:
      "List open appointment start times for one service, day by day, starting from a date. " +
      "Times are the clinic's local time in 24-hour HH:MM format. Use this before offering any time.",
    inputSchema: z.object({
      service_id: z.enum(serviceIds).describe("Service id from the clinic information"),
      start_date: z.string().describe("First day to check, YYYY-MM-DD"),
      days: z.number().int().min(1).max(7).optional().describe("How many days to check (default 3)"),
    }),
    run: async ({ service_id, start_date, days }) => {
      if (!isValidDate(start_date)) {
        log("check_availability", false, `Invalid date "${start_date}"`);
        return JSON.stringify({ error: "start_date must be YYYY-MM-DD." });
      }
      const check: AvailabilityCheck = { serviceId: service_id, startDate: start_date, days: days ?? 3 };
      if (checks.length < MAX_CHECKS_PER_TURN) checks.push(check);
      const range = availabilityRange(state, check.serviceId, check.startDate, check.days, now);
      const open = range.reduce((n, d) => n + d.times.length, 0);
      log(
        "check_availability",
        true,
        `Checked ${getService(service_id)?.name} for ${formatShortDate(range[0].date)} to ${formatShortDate(range[range.length - 1].date)}: ${open} open times`,
      );
      return availabilityResult(state, check, now);
    },
  });

  const bookTool = betaZodTool({
    name: "book_appointment",
    description:
      "Book an appointment. Only call this after the patient has confirmed the service, date, time, " +
      "full name and mobile number. The time must be one that check_availability returned.",
    inputSchema: z.object({
      service_id: z.enum(serviceIds),
      date: z.string().describe("YYYY-MM-DD"),
      weekday: z
        .enum(WEEKDAY_NAMES)
        .describe("The day of the week you told the patient for this appointment. It is checked against the date."),
      time: z.string().describe("HH:MM, 24-hour clinic time"),
      customer_name: z.string().describe("Patient's full name"),
      customer_phone: z.string().describe("Patient's mobile number"),
      notes: z.string().optional().describe("Anything the team should know, e.g. anxious patient"),
    }),
    run: async (input) => {
      const result = bookAppointment(
        state,
        {
          serviceId: input.service_id,
          date: input.date,
          weekday: input.weekday,
          time: input.time,
          customerName: input.customer_name,
          customerPhone: input.customer_phone,
          notes: input.notes,
        },
        now,
      );
      if (!result.ok) {
        log("book_appointment", false, `Booking failed: ${result.error}`);
        return JSON.stringify({ error: result.error });
      }
      state = result.state;
      const b = result.value;
      const service = getService(b.serviceId);
      log(
        "book_appointment",
        true,
        `Booked ${b.id}: ${service?.name}, ${formatShortDate(b.date)} at ${formatTime(b.time)} for ${b.customerName}`,
      );
      return JSON.stringify({
        booked: true,
        reference: b.id,
        service: service?.name,
        date: b.date,
        weekday: input.weekday,
        time: formatTime(b.time),
      });
    },
  });

  const findTool = betaZodTool({
    name: "find_bookings",
    description: "Look up a patient's upcoming appointments by the mobile number they booked with.",
    inputSchema: z.object({ customer_phone: z.string() }),
    run: async ({ customer_phone }) => {
      const found = findBookings(state, customer_phone, now);
      log("find_bookings", true, `Looked up bookings for ${maskPhone(customer_phone)}: ${found.length} found`);
      return JSON.stringify({
        bookings: found.map((b) => ({
          reference: b.id,
          service: getService(b.serviceId)?.name,
          date: b.date,
          time: formatTime(b.time),
          name: b.customerName,
        })),
      });
    },
  });

  const cancelTool = betaZodTool({
    name: "cancel_booking",
    description:
      "Cancel an appointment. Only call this after the patient confirms which appointment to cancel.",
    inputSchema: z.object({
      reference: z.string().describe("Booking reference, e.g. BK-1234"),
      customer_phone: z.string(),
    }),
    run: async ({ reference, customer_phone }) => {
      const result = cancelBooking(state, reference, customer_phone);
      if (!result.ok) {
        log("cancel_booking", false, `Cancel failed: ${result.error}`);
        return JSON.stringify({ error: result.error });
      }
      state = result.state;
      log("cancel_booking", true, `Cancelled ${result.value.id} for ${result.value.customerName}`);
      return JSON.stringify({ cancelled: true, reference: result.value.id });
    },
  });

  const callbackTool = betaZodTool({
    name: "request_callback",
    description:
      "Ask the clinic team to call the patient back. Use when the patient asks for a person, " +
      "or asks something the clinic information does not answer.",
    inputSchema: z.object({
      customer_name: z.string(),
      customer_phone: z.string(),
      reason: z.string().describe("One sentence the team can act on"),
    }),
    run: async (input) => {
      const result = requestCallback(state, {
        customerName: input.customer_name,
        customerPhone: input.customer_phone,
        reason: input.reason,
      });
      if (!result.ok) {
        log("request_callback", false, `Callback failed: ${result.error}`);
        return JSON.stringify({ error: result.error });
      }
      state = result.state;
      log("request_callback", true, `Callback requested for ${result.value.customerName}: ${result.value.reason}`);
      return JSON.stringify({ requested: true, reference: result.value.id });
    },
  });

  const runner = getClient().beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 8000,
    max_iterations: 8,
    ...(SUPPORTS_FALLBACKS && {
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default" as const,
    }),
    ...(SUPPORTS_EFFORT && { output_config: { effort: EFFORT } }),
    system: [
      { type: "text", text: STATIC_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: upcomingDates(now.date), cache_control: { type: "ephemeral" } },
      { type: "text", text: clinicClock(now) },
    ],
    tools: [checkAvailability, bookTool, findTool, cancelTool, callbackTool],
    messages: buildHistory(history, initialState, now),
  });

  // Sum token usage across every model call in this turn, for cost monitoring.
  const usage = { calls: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
  for await (const message of runner) {
    usage.calls += 1;
    usage.input += message.usage.input_tokens;
    usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
    usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;
    usage.output += message.usage.output_tokens;
  }
  const final = await runner.done();
  console.log(
    `[chat] ${usage.calls} model call(s): input ${usage.input}, cache read ${usage.cacheRead}, ` +
      `cache write ${usage.cacheWrite}, output ${usage.output}`,
  );

  let reply = final.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (final.stop_reason === "refusal") {
    reply = `Sorry, I can't help with that here. For anything else, please call us on ${business.phone}.`;
  } else if (!reply) {
    reply = `Sorry, something went wrong on my side. Please try again, or call us on ${business.phone}.`;
  }

  return { reply, checks, state, activity };
}
