"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, LoaderCircle, X } from "lucide-react";

const MAX_FRAME_EDGE = 1920;

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * Lets the editor scrub through a video and take one frame as the still for the
 * newsletter. Works on a local file before upload, or on an uploaded video when the
 * media bucket allows cross-origin reads.
 */
export function VideoFramePicker({
  source,
  onCapture,
  onClose,
}: {
  source: File | string;
  onCapture: (frame: File) => Promise<void> | void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The element is the external system here: give it the file or link directly.
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const url = typeof source === "string" ? source : URL.createObjectURL(source);
    element.src = url;
    return () => {
      if (typeof source !== "string") URL.revokeObjectURL(url);
    };
  }, [source]);

  function seek(next: number) {
    setTime(next);
    if (video.current) video.current.currentTime = next;
  }

  async function capture() {
    const element = video.current;
    if (!element || !element.videoWidth) {
      setError("De video is nog niet geladen.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const scale = Math.min(1, MAX_FRAME_EDGE / Math.max(element.videoWidth, element.videoHeight));
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.round(element.videoWidth * scale);
      canvas.height = Math.round(element.videoHeight * scale);
      canvas.getContext("2d")?.drawImage(element, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("EMPTY_FRAME");
      await onCapture(new File([blob], `videobeeld-${Math.round(time * 10)}.jpg`, { type: "image/jpeg" }));
    } catch (cause) {
      setError(
        cause instanceof DOMException && cause.name === "SecurityError"
          ? "Uit deze video kan geen beeld worden gehaald. Upload de video opnieuw of kies een foto."
          : cause instanceof Error && cause.message !== "EMPTY_FRAME"
            ? cause.message
            : "Het beeld kon niet worden gemaakt.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 rounded-card border border-accent/60 bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-body-sm font-bold text-text">Kies een beeld uit de video</p>
        <button type="button" onClick={onClose} className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-border bg-surface" aria-label="Sluiten">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <video
          ref={video}
          crossOrigin={typeof source === "string" ? "anonymous" : undefined}
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={(event) => {
            const length = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
            setDuration(length);
            seek(Math.min(1, length / 10));
          }}
          onError={() => setError("De video kan hier niet worden afgespeeld. Kies een foto als stilstaand beeld.")}
          className="max-h-72 w-full rounded-button bg-black object-contain"
        />
      <label className="grid gap-1 text-body-sm font-semibold text-text">
        <span className="flex justify-between">Moment<span className="text-muted">{formatTime(time)} / {formatTime(duration)}</span></span>
        <input
          type="range"
          min={0}
          max={Math.max(duration, 0.1)}
          step={0.1}
          value={time}
          disabled={!duration}
          onChange={(event) => seek(Number(event.target.value))}
          className="min-h-11 w-full accent-[color:var(--color-accent-ink,#6b5b00)]"
        />
      </label>
      <button type="button" onClick={() => void capture()} disabled={busy || !duration} className="inline-flex min-h-11 items-center justify-center gap-2 justify-self-start rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast disabled:opacity-50">
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
        Dit beeld gebruiken
      </button>
      {error ? <p role="alert" className="text-xs font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
