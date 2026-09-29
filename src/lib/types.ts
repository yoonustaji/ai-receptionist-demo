// Types shared by the browser and the API route. No server-only imports here.

// An availability check the assistant made during a turn. Only these validated
// parameters travel back from the browser; the server recomputes the results.
export type AvailabilityCheck = { serviceId: string; startDate: string; days: number };

export type ChatTurn = { role: "user" | "assistant"; text: string; checks?: AvailabilityCheck[] };

export const MAX_CHECKS_PER_TURN = 5;

export type ActivityEvent = {
  tool: string;
  summary: string;
  ok: boolean;
  at: string;
};

export const MAX_USER_MESSAGE_CHARS = 600;
export const MAX_CONVERSATION_TURNS = 40;
