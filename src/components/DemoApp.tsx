"use client";

import { useEffect, useState } from "react";
import { business } from "@/config/business";
import { emptyState, type DemoState } from "@/lib/calendar";
import { MAX_CONVERSATION_TURNS, type ActivityEvent, type ChatTurn } from "@/lib/types";
import ChatPanel from "./ChatPanel";
import FrontDesk from "./FrontDesk";

const STORAGE_KEY = "ai-receptionist-demo:v1";

type Saved = { messages: ChatTurn[]; state: DemoState; activity: ActivityEvent[] };

function load(): Saved | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(data: Saved) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable (private mode, blocked site data). The demo still works.
  }
}

export default function DemoApp({ builderName, builderUrl }: { builderName: string; builderUrl: string }) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [state, setState] = useState<DemoState>(emptyState);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = load();
    if (saved?.messages && saved.state && saved.activity) {
      setMessages(saved.messages);
      setState(saved.state);
      setActivity(saved.activity);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) save({ messages, state, activity });
  }, [loaded, messages, state, activity]);

  const limitReached = messages.length >= MAX_CONVERSATION_TURNS - 1;

  async function send(text: string) {
    if (loading || limitReached) return;
    const next: ChatTurn[] = [...messages, { role: "user", text }];
    setMessages(next);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, state }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setMessages([...next, { role: "assistant", text: data.reply, checks: data.checks }]);
      setState(data.state);
      setActivity((prev) => [...[...data.activity].reverse(), ...prev].slice(0, 100));
    } catch (err) {
      // Drop the unanswered message so the conversation stays valid, and let the visitor retry.
      setMessages(messages);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setMessages([]);
    setState(emptyState());
    setActivity([]);
    setError(null);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            {business.name.charAt(0)}
          </span>
          <div>
            <div className="brand-name">{business.name}</div>
            <div className="brand-sub">AI receptionist demo · {business.notice}</div>
          </div>
        </div>
        <button className="ghost" onClick={reset} disabled={loading}>
          Reset demo
        </button>
      </header>

      <main className="layout">
        <ChatPanel
          messages={messages}
          loading={loading}
          error={error}
          limitReached={limitReached}
          onSend={send}
        />
        <FrontDesk state={state} activity={activity} />
      </main>

      <footer className="footer">
        <span>Your test bookings stay in this browser. Nothing is sent to a real clinic.</span>
        {builderName && (
          <span>
            Built by{" "}
            {builderUrl ? (
              <a href={builderUrl} target="_blank" rel="noreferrer">
                {builderName}
              </a>
            ) : (
              builderName
            )}
          </span>
        )}
      </footer>
    </div>
  );
}
