"use client";

import { Mic, Square } from "lucide-react";
import { useRecorder } from "@/lib/useRecorder";

export function RecorderButton({
  onRecorded,
  label = "Record voice message",
}: {
  onRecorded: (blob: Blob) => void;
  label?: string;
}) {
  const { recording, error, start, stop } = useRecorder();

  async function toggle() {
    if (recording) {
      const blob = await stop();
      if (blob) onRecorded(blob);
    } else {
      await start();
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
          recording
            ? "bg-red-600 text-white hover:bg-red-700"
            : "border border-line text-ink-muted hover:bg-cream-soft"
        }`}
      >
        {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {recording ? "Stop & attach" : label}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
