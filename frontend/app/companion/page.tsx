"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, LayoutDashboard, Mail, Mic } from "lucide-react";
import { VoiceOrb, OrbState } from "@/components/VoiceOrb";
import { useCompanionSocket } from "@/lib/useCompanionSocket";
import { useRecorder } from "@/lib/useRecorder";
import { apiBaseUrl, apiFetch, base64ToBlobUrl } from "@/lib/api";
import {
  CompanionEvent,
  ConverseResponse,
  FamilyMessageEvent,
  Message,
  ReminderDueEvent,
  ReminderEvent,
} from "@/lib/types";

interface ChatTurn {
  who: "you" | "companion";
  text: string;
}

export default function CompanionPage() {
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [reminders, setReminders] = useState<ReminderDueEvent[]>([]);
  const [messages, setMessages] = useState<FamilyMessageEvent[]>([]);
  const [micError, setMicError] = useState<string | null>(null);
  const [elderName, setElderName] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onAudioEndRef = useRef<(() => void) | null>(null);
  const { recording, error: recorderError, start, stop } = useRecorder();

  const reminder = reminders[0] ?? null;
  const message = messages[0] ?? null;

  useEffect(() => {
    const stored = window.localStorage.getItem("ec_elder_name");
    if (stored) setElderName(stored);
  }, []);

  const playAudio = useCallback((url: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    setOrbState("speaking");
    onAudioEndRef.current = () => setOrbState("idle");
    audio.src = url;
    audio.play().catch(() => {
      // Autoplay can be blocked until the page has had a user gesture. `onEnded` never fires
      // in that case, so reset here or the orb would sit on "Speaking…" forever.
      onAudioEndRef.current = null;
      setOrbState("idle");
    });
  }, []);

  const enqueueReminder = useCallback((event: ReminderDueEvent) => {
    setReminders((prev) =>
      prev.some((r) => r.event_id === event.event_id) ? prev : [...prev, event]
    );
  }, []);

  const enqueueMessage = useCallback((event: FamilyMessageEvent) => {
    setMessages((prev) =>
      prev.some((m) => m.message_id === event.message_id) ? prev : [...prev, event]
    );
  }, []);

  const handleEvent = useCallback(
    (event: CompanionEvent) => {
      if (event.type === "reminder_due") enqueueReminder(event);
      else if (event.type === "family_message") enqueueMessage(event);
    },
    [enqueueReminder, enqueueMessage]
  );

  const socketStatus = useCompanionSocket(handleEvent);

  // Anything that fired while this page wasn't open (or wasn't connected) would otherwise be
  // lost with its WebSocket push, so pick up whatever is still unanswered on load.
  useEffect(() => {
    apiFetch<ReminderEvent[]>("/api/reminders/events/pending", { auth: false })
      .then((pending) =>
        pending.forEach((ev) =>
          enqueueReminder({
            type: "reminder_due",
            event_id: ev.id,
            medication_id: ev.medication_id,
            medication_name: ev.medication_name,
            dosage: "",
          })
        )
      )
      .catch(() => {});

    apiFetch<Message[]>("/api/messages/unplayed", { auth: false })
      .then((unplayed) =>
        unplayed.forEach((m) =>
          enqueueMessage({
            type: "family_message",
            message_id: m.id,
            sender_name: m.sender_name,
            kind: m.kind,
            content_text: m.content_text,
            audio_url: m.audio_url,
          })
        )
      )
      .catch(() => {});
  }, [enqueueReminder, enqueueMessage]);

  // Speak whichever reminder is at the head of the queue.
  useEffect(() => {
    if (!reminder) return;
    let cancelled = false;
    apiFetch<{ text: string; audio_base64: string }>(
      `/api/reminders/events/${reminder.event_id}/audio`,
      { auth: false }
    )
      .then((res) => {
        if (!cancelled) playAudio(base64ToBlobUrl(res.audio_base64));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reminder, playAudio]);

  useEffect(() => {
    if (!message) return;
    let cancelled = false;
    if (message.kind === "audio" && message.audio_url) {
      playAudio(`${apiBaseUrl()}${message.audio_url}`);
      return;
    }
    apiFetch<{ text: string; audio_base64: string }>(
      `/api/messages/${message.message_id}/audio`,
      { auth: false }
    )
      .then((res) => {
        if (!cancelled) playAudio(base64ToBlobUrl(res.audio_base64));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [message, playAudio]);

  async function handlePressStart() {
    setMicError(null);
    await start();
  }

  async function handlePressEnd() {
    const blob = await stop();
    if (!blob) return;
    setOrbState("thinking");
    try {
      const form = new FormData();
      form.append("audio", blob, "clip.webm");
      const res = await apiFetch<ConverseResponse>("/api/converse", {
        method: "POST",
        body: form,
        auth: false,
      });
      setChat((prev) => [
        ...prev,
        ...(res.transcript ? [{ who: "you" as const, text: res.transcript }] : []),
        { who: "companion" as const, text: res.reply_text },
      ]);
      playAudio(base64ToBlobUrl(res.reply_audio_base64));
    } catch (err) {
      setMicError(err instanceof Error ? err.message : "Something went wrong.");
      setOrbState("idle");
    }
  }

  async function answerReminder(action: "confirm" | "snooze") {
    if (!reminder) return;
    const eventId = reminder.event_id;
    setReminders((prev) => prev.filter((r) => r.event_id !== eventId));
    await apiFetch(`/api/reminders/events/${eventId}/${action}`, {
      method: "POST",
      auth: false,
    }).catch(() => {});
  }

  async function markMessageHeard() {
    if (!message) return;
    const messageId = message.message_id;
    setMessages((prev) => prev.filter((m) => m.message_id !== messageId));
    await apiFetch(`/api/messages/${messageId}/played`, {
      method: "POST",
      auth: false,
    }).catch(() => {});
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-10">
      <audio
        ref={audioRef}
        onEnded={() => {
          onAudioEndRef.current?.();
          onAudioEndRef.current = null;
        }}
        className="hidden"
      />

      <div className="flex w-full max-w-2xl items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-ink-faint">Companion device</p>
          <h1 className="font-serif text-lg font-medium text-ink">
            {elderName ? `Hi, I’m here for ${elderName}` : "Hi, I’m your companion"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`h-2 w-2 rounded-full ${socketStatus === "open" ? "bg-emerald-600" : "bg-ink-faint"}`}
            title={`Realtime link: ${socketStatus}`}
          />
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-xs text-ink-muted hover:text-accent"
          >
            <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
          </Link>
        </div>
      </div>

      <VoiceOrb state={orbState} />

      <button
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        disabled={orbState === "thinking" || orbState === "speaking"}
        className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-sm transition disabled:opacity-40 ${
          recording
            ? "bg-red-600 text-white"
            : "bg-surface text-ink border border-line hover:border-accent hover:text-accent"
        }`}
      >
        <Mic className="h-4 w-4" />
        {recording ? "Release to send" : "Hold to talk"}
      </button>
      <p className="max-w-sm text-center text-xs text-ink-faint">
        Simulates the wake-word mic on the real device — hold the button, speak, then release.
      </p>
      {(micError || recorderError) && (
        <p className="text-sm text-red-700">{micError ?? recorderError}</p>
      )}

      {reminder && (
        <div className="w-full max-w-md rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center justify-between text-amber-800">
            <div className="flex items-center gap-2">
              <Clock3 className="h-5 w-5" />
              <p className="font-semibold">Medication reminder</p>
            </div>
            {reminders.length > 1 && (
              <span className="text-xs">+{reminders.length - 1} more waiting</span>
            )}
          </div>
          <p className="mt-2 text-sm text-ink">
            Time for <span className="font-medium">{reminder.medication_name}</span>
            {reminder.dosage ? ` — ${reminder.dosage}` : ""}.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => answerReminder("confirm")}
              className="flex-1 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              I took it
            </button>
            <button
              onClick={() => answerReminder("snooze")}
              className="flex-1 rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
            >
              Snooze 10 min
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className="w-full max-w-md rounded-3xl border border-line bg-accent-soft p-5">
          <div className="flex items-center justify-between text-accent-hover">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              <p className="font-semibold">Message from {message.sender_name}</p>
            </div>
            {messages.length > 1 && (
              <span className="text-xs">+{messages.length - 1} more</span>
            )}
          </div>
          {message.content_text && (
            <p className="mt-2 text-sm text-ink">&ldquo;{message.content_text}&rdquo;</p>
          )}
          <button
            onClick={markMessageHeard}
            className="mt-4 flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            <CheckCircle2 className="h-4 w-4" /> Got it
          </button>
        </div>
      )}

      {chat.length > 0 && (
        <div className="w-full max-w-md space-y-3 rounded-3xl border border-line bg-surface p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Recent conversation
          </p>
          {chat.slice(-6).map((turn, i) => (
            <p key={i} className="text-sm">
              <span
                className={turn.who === "you" ? "font-semibold text-ink-muted" : "font-semibold text-accent"}
              >
                {turn.who === "you" ? "You: " : "Companion: "}
              </span>
              <span className="text-ink">{turn.text}</span>
            </p>
          ))}
        </div>
      )}
    </main>
  );
}
