import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { serviceIds } from "@/config/business";
import { runReceptionist } from "@/lib/agent";
import { DemoStateSchema } from "@/lib/calendar";
import { MAX_CHECKS_PER_TURN, MAX_CONVERSATION_TURNS, MAX_USER_MESSAGE_CHARS } from "@/lib/types";

const CheckSchema = z.object({
  serviceId: z.enum(serviceIds),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().int().min(1).max(7),
});

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().min(1).max(4000),
        checks: z.array(CheckSchema).max(MAX_CHECKS_PER_TURN).optional(),
      }),
    )
    .min(1)
    .max(MAX_CONVERSATION_TURNS),
  state: DemoStateSchema,
});

// Best-effort abuse protection for a public demo. Memory is per server
// instance, so also set a spend limit on the API key in the Claude Console.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error("ANTHROPIC_API_KEY is not set. Add it to .env.local or the host's environment variables.");
    return error("This demo isn't connected to its AI model yet (missing API key).", 503);
  }

  const ip =request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return error("Too many messages. Please wait a few minutes and try again.", 429);
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return error("Invalid request.", 400);
  }

  const { messages, state } = body;
  const last = messages[messages.length - 1];
  if (messages[0].role !== "user" || last.role !== "user") {
    return error("The conversation must start and end with a user message.", 400);
  }
  if (last.text.length > MAX_USER_MESSAGE_CHARS) {
    return error(`Please keep messages under ${MAX_USER_MESSAGE_CHARS} characters.`, 400);
  }

  try {
    return NextResponse.json(await runReceptionist(messages, state));
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic authentication failed:", err.message);
      return error("The demo's API key is missing or invalid.", 500);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return error("The demo is busy right now. Please try again in a minute.", 429);
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${err.status}:`, err.message);
      return error("The assistant is unavailable right now. Please try again.", 502);
    }
    console.error("Unexpected error:", err);
    return error("Something went wrong. Please try again.", 500);
  }
}
