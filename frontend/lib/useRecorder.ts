"use client";

import { useCallback, useRef, useState } from "react";

const MIN_RECORDING_MS = 500;

export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const startingRef = useRef(false);

  const start = useCallback(async () => {
    // Touch devices fire a synthetic mousedown after touchend, and a fast double-click can
    // re-enter too. Without this guard the second call orphans the first MediaStream and the
    // mic stays open for good.
    if (startingRef.current || mediaRecorderRef.current) return;
    startingRef.current = true;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      startedAtRef.current = Date.now();
      setRecording(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Microphone access failed: ${err.message}`
          : "Microphone access failed."
      );
    } finally {
      startingRef.current = false;
    }
  }, []);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    setRecording(false);
  }, []);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      // Calling .stop() on an already-inactive recorder throws InvalidStateError, which would
      // reject this promise at call sites that don't catch.
      if (!recorder || recorder.state === "inactive") {
        cleanup();
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const elapsed = Date.now() - startedAtRef.current;
        cleanup();
        if (elapsed < MIN_RECORDING_MS) {
          setError("Hold a little longer and speak before releasing.");
          resolve(null);
          return;
        }
        resolve(blob);
      };
      try {
        recorder.stop();
      } catch {
        cleanup();
        resolve(null);
      }
    });
  }, [cleanup]);

  return { recording, error, start, stop };
}
