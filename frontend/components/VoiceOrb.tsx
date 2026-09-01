"use client";

import { Loader2, Mic, Volume2 } from "lucide-react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

const STATE_STYLES: Record<OrbState, { ring: string; glow: string; label: string }> = {
  idle: {
    ring: "from-[#cabfa8] to-[#a89d8c]",
    glow: "shadow-[0_0_50px_8px_rgba(168,157,140,0.35)]",
    label: "Resting",
  },
  listening: {
    ring: "from-[#e2916a] to-accent",
    glow: "shadow-[0_0_70px_16px_rgba(201,100,66,0.4)]",
    label: "Listening…",
  },
  thinking: {
    ring: "from-[#e3b56a] to-[#c98a2e]",
    glow: "shadow-[0_0_70px_16px_rgba(201,138,46,0.4)]",
    label: "Thinking…",
  },
  speaking: {
    ring: "from-accent to-[#96432a]",
    glow: "shadow-[0_0_70px_16px_rgba(150,67,42,0.4)]",
    label: "Speaking…",
  },
};

export function VoiceOrb({ state }: { state: OrbState }) {
  const style = STATE_STYLES[state];
  const pulse = state === "idle" ? "animate-[pulse_4s_ease-in-out_infinite]" : "animate-pulse";

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`relative flex h-48 w-48 items-center justify-center rounded-full bg-gradient-to-br ${style.ring} ${style.glow} ${pulse} transition-colors duration-500`}
      >
        <div className="flex h-32 w-32 items-center justify-center rounded-full bg-black/10 backdrop-blur-sm">
          {state === "listening" && <Mic className="h-14 w-14 text-white" strokeWidth={1.5} />}
          {state === "thinking" && (
            <Loader2 className="h-14 w-14 animate-spin text-white" strokeWidth={1.5} />
          )}
          {state === "speaking" && (
            <Volume2 className="h-14 w-14 text-white" strokeWidth={1.5} />
          )}
          {state === "idle" && <div className="h-6 w-6 rounded-full bg-white/80" />}
        </div>
      </div>
      <p className="text-lg font-medium text-ink-muted">{style.label}</p>
    </div>
  );
}
