"use client";

import { useEffect, useState } from "react";
import { Send, X } from "lucide-react";
import { apiFetch, mediaUrl } from "@/lib/api";
import { Message } from "@/lib/types";
import { RecorderButton } from "@/components/RecorderButton";

export function MessagesPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [senderName, setSenderName] = useState("Daughter Mira");
  const [text, setText] = useState("");
  const [attachedBlob, setAttachedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      const data = await apiFetch<Message[]>("/api/messages");
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && !attachedBlob) return;
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("sender_name", senderName);
      form.append("content_text", text);
      if (attachedBlob) form.append("audio", attachedBlob, "message.webm");
      await apiFetch("/api/messages", { method: "POST", body: form });
      setText("");
      setAttachedBlob(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={send}
        className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5 shadow-sm"
      >
        <input
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          placeholder="Your name"
          className="rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message to speak to them, or record a voice note instead…"
          rows={3}
          className="rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <div className="flex items-center gap-3">
          <RecorderButton onRecorded={setAttachedBlob} label="Record voice note instead" />
          {attachedBlob && (
            <button
              type="button"
              onClick={() => setAttachedBlob(null)}
              className="flex items-center gap-1 text-xs text-ink-muted hover:text-red-700"
            >
              <X className="h-3.5 w-3.5" /> voice note attached — clear
            </button>
          )}
          <button
            type="submit"
            disabled={sending || (!text.trim() && !attachedBlob)}
            className="ml-auto flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-col gap-2">
        {messages.length === 0 && <p className="text-sm text-ink-faint">No messages yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-ink-faint">
              <span className="font-medium text-ink-muted">{m.sender_name}</span>
              <span>{new Date(m.created_at).toLocaleString()}</span>
            </div>
            {m.kind === "text" ? (
              <p className="mt-1 text-sm text-ink">{m.content_text}</p>
            ) : (
              <audio controls src={mediaUrl(m.audio_url ?? "")} className="mt-2 h-8 w-full" />
            )}
            <p className="mt-1 text-[11px] text-ink-faint">
              {m.played_at ? `Heard ${new Date(m.played_at).toLocaleTimeString()}` : "Not yet heard"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
