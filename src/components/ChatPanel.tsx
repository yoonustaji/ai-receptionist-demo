"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { business } from "@/config/business";
import { MAX_USER_MESSAGE_CHARS, type ChatTurn } from "@/lib/types";

type Props = {
  messages: ChatTurn[];
  loading: boolean;
  error: string | null;
  limitReached: boolean;
  onSend: (text: string) => void;
};

const GREETING = `Hi, welcome to ${business.name}! I can answer questions, check availability and book your appointment. How can I help?`;

export default function ChatPanel({ messages, loading, error, limitReached, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, error]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || loading || limitReached) return;
    setDraft("");
    onSend(text);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <section className="panel chat" aria-label="Chat with the receptionist">
      <div className="panel-head">
        <div>
          <h2>Patient chat</h2>
          <p className="muted">What a patient sees on the clinic website</p>
        </div>
        <span className="status">
          <span className="dot" /> Online 24/7
        </span>
      </div>

      <div className="messages" aria-live="polite">
        <div className="bubble assistant">{GREETING}</div>
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="bubble assistant typing" aria-label="The receptionist is typing">
            <span />
            <span />
            <span />
          </div>
        )}
        {error && <div className="error">{error}</div>}
        {limitReached && (
          <div className="error">This demo conversation is full. Press Reset demo to start again.</div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length === 0 && (
        <div className="suggestions">
          {business.suggestions.map((s) => (
            <button key={s} className="chip" onClick={() => onSend(s)} disabled={loading}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form className="composer" onSubmit={submit}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message…"
          rows={1}
          maxLength={MAX_USER_MESSAGE_CHARS}
          disabled={limitReached}
          aria-label="Message"
        />
        <button type="submit" className="send" disabled={loading || limitReached || !draft.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
