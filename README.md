# AI Receptionist Demo

A web chat receptionist for an appointment business, with a live front-desk dashboard beside it. It shows a prospect exactly what they'd get:

- Answers questions from the business's own information (services, prices, hours, policies)
- Checks real availability, books, looks up and cancels appointments
- Requests a callback from staff when a patient needs a person
- Sends emergencies to the right place and stays on topic
- Front-desk view: every booking, callback and AI action appears as it happens

The clinic ("Harbor Point Dental") is fictional. Each visitor gets a private sandbox calendar stored in their own browser, so visitors never see each other's bookings and the server stores nothing.

## How it works

```
Browser (chat + front desk)
  │  POST /api/chat  { messages, state }
  ▼
Next.js API route ── validates input, rate-limits by IP
  │
  ▼
Claude (tool runner) ── system prompt built from src/config/business.ts
  │  calls tools: check_availability · book_appointment · find_bookings
  │               cancel_booking · request_callback
  ▼
src/lib/calendar.ts ── pure functions over the visitor's sandbox calendar
```

| File | Purpose |
|---|---|
| `src/config/business.ts` | Everything the receptionist knows. The only file to edit per prospect. |
| `src/lib/prompt.ts` | System prompt, built from the config |
| `src/lib/agent.ts` | Claude tool runner and the five tools |
| `src/lib/calendar.ts` | Availability, booking, cancelling, callbacks (unit tested) |
| `src/app/api/chat/route.ts` | API endpoint: validation, rate limit, error handling |
| `src/components/` | Chat panel and front-desk dashboard |

## Run locally

Requires Node 20.9 or newer.

```bash
npm install
```

```bash
cp .env.example .env
```

Put your Claude API key in `.env` (git-ignored), then:

```bash
npm run dev
```

Open http://localhost:3000.

Checks:

```bash
npm test
```

```bash
npm run typecheck
```

## Personalize it for a prospect (under an hour)

1. Copy the project, or make a branch per prospect.
2. Edit `src/config/business.ts`: name, accent color, time zone, phone numbers, address, hours, services and prices, policies and suggested questions. Take everything from their website.
3. Deploy it, and send them the link with Template 5 from `freelance-kit/proposals.md`.

## Deploy

### Vercel (free tier, easiest)

1. Push this folder to a GitHub repository.
2. Import it at vercel.com/new.
3. Add the environment variables from `.env.example`.

### Docker (any server, including older Linux)

```bash
docker build -t ai-receptionist-demo .
```

```bash
docker run -d --name ai-receptionist --restart unless-stopped -p 127.0.0.1:3000:3000 --env-file .env ai-receptionist-demo
```

Then put nginx in front of it, so the rate limiter sees real visitor IPs:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 90s;
}
```

Serve it over HTTPS (for example with a free Let's Encrypt certificate) before sending the link to anyone.

## Cost and safety

- The default model is `claude-opus-5` at `medium` effort. Change `ANTHROPIC_MODEL` or `AGENT_EFFORT` to trade quality against cost and speed.
- Measured on 15 scripted replies: Opus 5 answered all correctly at about $0.008 per reply. Claude Haiku 4.5 (`ANTHROPIC_MODEL=claude-haiku-4-5`) cost about half, but booked the wrong weekday and misquoted a booking reference, so it isn't recommended for booking work. Its saving is smaller than the price list suggests because this prompt is below Haiku's minimum size for prompt caching.
- `book_appointment` requires the weekday the assistant told the patient, and refuses the booking if it doesn't match the date. This stops a miscalculated date being booked while the patient hears a different day.
- The request asks for server-side refusal fallbacks (`fallbacks: "default"`), so a declined request is retried on another model automatically.
- The static part of the system prompt is prompt-cached, which cuts the cost of repeat requests.
- Limits: 30 requests per IP per 10 minutes, 600 characters per message, 40 messages per conversation. The rate limit lives in server memory, so **also set a monthly spend limit on the API key in the Claude Console** before sharing the link publicly.

## What a paid client version adds

- Real calendar: Google Calendar, Cal.com or the client's booking system API, instead of the sandbox
- Channels: WhatsApp (Meta Cloud API or Twilio), Instagram DMs, SMS
- Larger knowledge bases: search over documents instead of a config file
- Staff inbox: conversation history, human takeover, email or Slack alerts
- Reminders: automatic confirmations and no-show reminders
