"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ConversationTurn, ReminderEvent, ReminderStatus } from "@/lib/types";

const STATUS_COLORS: Record<ReminderStatus, string> = {
  pending: "bg-cream-soft text-ink-muted",
  delivered: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  snoozed: "bg-orange-100 text-orange-800",
  missed: "bg-red-100 text-red-800",
};

export function LogsPanel() {
  const [events, setEvents] = useState<ReminderEvent[]>([]);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [ev, tu] = await Promise.all([
        apiFetch<ReminderEvent[]>("/api/logs/adherence"),
        apiFetch<ConversationTurn[]>("/api/logs/conversation"),
      ]);
      setEvents(ev);
      setTurns(tu);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-ink-muted">Adherence log</h3>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-col gap-2">
          {events.length === 0 && <p className="text-sm text-ink-faint">No reminders fired yet.</p>}
          {events.map((ev) => (
            <div
              key={ev.id}
              className="flex items-center justify-between rounded-xl border border-line-soft px-3 py-2 text-sm"
            >
              <div>
                <p className="text-ink">{ev.medication_name}</p>
                <p className="text-xs text-ink-faint">
                  {new Date(ev.scheduled_for).toLocaleString()}
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_COLORS[ev.status]}`}>
                {ev.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-ink-muted">Conversation transcript</h3>
        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {turns.length === 0 && (
            <p className="text-sm text-ink-faint">No conversations yet — try the companion view.</p>
          )}
          {[...turns].reverse().map((t) => (
            <p key={t.id} className="text-sm">
              <span
                className={
                  t.role === "user" ? "font-semibold text-ink-muted" : "font-semibold text-accent"
                }
              >
                {t.role === "user" ? "Elder: " : "Companion: "}
              </span>
              <span className="text-ink">{t.content_text}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
