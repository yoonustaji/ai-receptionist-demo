"use client";

import { getService } from "@/config/business";
import { maskPhone, type DemoState } from "@/lib/calendar";
import { formatShortDate, formatTime } from "@/lib/dates";
import type { ActivityEvent } from "@/lib/types";

type Props = { state: DemoState; activity: ActivityEvent[] };

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function FrontDesk({ state, activity }: Props) {
  const bookings = [...state.bookings].sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
  );
  const confirmed = bookings.filter((b) => b.status === "confirmed").length;

  return (
    <section className="panel desk" aria-label="Front desk dashboard">
      <div className="panel-head">
        <div>
          <h2>Front desk</h2>
          <p className="muted">What the clinic team sees, live</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-value">{confirmed}</div>
          <div className="stat-label">Booked by AI</div>
        </div>
        <div className="stat">
          <div className="stat-value">{state.callbacks.length}</div>
          <div className="stat-label">Callbacks</div>
        </div>
        <div className="stat">
          <div className="stat-value">{activity.length}</div>
          <div className="stat-label">AI actions</div>
        </div>
      </div>

      <div className="block">
        <h3>Appointments</h3>
        {bookings.length === 0 ? (
          <p className="empty">Book an appointment in the chat and it appears here instantly.</p>
        ) : (
          <ul className="list">
            {bookings.map((b) => (
              <li key={b.id} className={b.status === "cancelled" ? "row cancelled" : "row"}>
                <div className="when">
                  <div>{formatShortDate(b.date)}</div>
                  <div className="muted">{formatTime(b.time)}</div>
                </div>
                <div className="what">
                  <div>
                    {b.customerName} <span className="muted">· {maskPhone(b.customerPhone)}</span>
                  </div>
                  <div className="muted">
                    {getService(b.serviceId)?.name}
                    {b.notes ? ` · ${b.notes}` : ""}
                  </div>
                </div>
                <span className={`tag ${b.status}`}>{b.status === "cancelled" ? "Cancelled" : b.id}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="block">
        <h3>Callback requests</h3>
        {state.callbacks.length === 0 ? (
          <p className="empty">When a patient needs a person, the AI leaves a callback request here.</p>
        ) : (
          <ul className="list">
            {state.callbacks.map((c) => (
              <li key={c.id} className="row">
                <div className="what">
                  <div>
                    {c.customerName} <span className="muted">· {maskPhone(c.customerPhone)}</span>
                  </div>
                  <div className="muted">{c.reason}</div>
                </div>
                <span className="tag">{clock(c.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="block">
        <h3>AI activity</h3>
        {activity.length === 0 ? (
          <p className="empty">Every availability check, booking and cancellation the AI makes is logged here.</p>
        ) : (
          <ul className="log">
            {activity.map((a, i) => (
              <li key={i}>
                <span className={a.ok ? "led ok" : "led fail"} aria-label={a.ok ? "Succeeded" : "Failed"} />
                <span className="log-text">{a.summary}</span>
                <span className="muted log-time">{clock(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
