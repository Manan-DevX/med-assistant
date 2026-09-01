"use client";

import { useEffect, useRef, useState } from "react";
import { CompanionEvent } from "./types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/companion";

export type SocketStatus = "connecting" | "open" | "closed";

export function useCompanionSocket(onEvent: (event: CompanionEvent) => void) {
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      setStatus("connecting");
      socket = new WebSocket(WS_URL);

      socket.onopen = () => setStatus("open");
      socket.onclose = () => {
        setStatus("closed");
        if (!cancelled) retryTimer = setTimeout(connect, 2000);
      };
      socket.onerror = () => socket?.close();
      socket.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data) as CompanionEvent;
          onEventRef.current(data);
        } catch {
          // ignore malformed events
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  return status;
}
