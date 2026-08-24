"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import type { AnnouncementTickerCopy } from "@/lib/customer-service-content";

const ROTATION_INTERVAL_MS = 5_000;

export function AnnouncementTicker({ copy }: { copy: AnnouncementTickerCopy }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const activeItem = copy.items[activeIndex] ?? copy.items[0];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || copy.items.length < 2) return;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % copy.items.length);
    }, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [copy.items.length, paused, reducedMotion]);

  if (!activeItem) return null;

  return (
    <aside
      aria-label={copy.ariaLabel}
      className="relative z-[55] min-h-11 overflow-hidden bg-black text-white"
    >
      <div className="mx-auto grid min-h-11 w-full max-w-[96rem] grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center px-1 sm:px-4">
        <span aria-hidden="true" />
        <div className="min-w-0 overflow-hidden text-center" aria-live="off">
          <Link
            key={activeItem.id}
            href={activeItem.href}
            className="announcement-ticker__item inline-flex min-h-11 max-w-full items-center justify-center truncate px-2 font-heading text-[0.72rem] font-semibold uppercase tracking-[0.09em] text-white underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-white sm:text-[0.8rem]"
          >
            <span className="mr-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            <span className="truncate">{activeItem.text}</span>
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setPaused((current) => !current)}
          aria-label={paused ? copy.resumeLabel : copy.pauseLabel}
          aria-pressed={paused}
          className="inline-flex h-11 w-11 touch-manipulation items-center justify-center justify-self-end text-white/80 transition-colors hover:text-white focus-visible:rounded-sm focus-visible:outline-white"
        >
          {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      </div>
    </aside>
  );
}
