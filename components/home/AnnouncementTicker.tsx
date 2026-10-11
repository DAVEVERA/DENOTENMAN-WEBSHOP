"use client";

import { useState } from "react";
import Image from "next/image";
import { Pause, Play } from "lucide-react";
import type { AnnouncementTickerCopy } from "@/lib/customer-service-content";
import { cn } from "@/lib/cn";
import styles from "./AnnouncementTicker.module.css";

function TickerItems({
  items,
  duplicate = false,
}: {
  items: AnnouncementTickerCopy["items"];
  duplicate?: boolean;
}) {
  return items.map((item, index) => (
    <li
      key={`${duplicate ? "duplicate-" : ""}${item.id}`}
      className={cn(
        styles.item,
        index < 3 && "lg:border-r lg:border-white/15",
      )}
    >
      <Image
        src="/brand/favicon.png"
        alt=""
        width={16}
        height={16}
        className="h-4 w-4 shrink-0 object-contain"
        aria-hidden="true"
      />
      <span className="font-heading text-sm font-bold uppercase leading-[1.3] tracking-[0.035em] lg:text-[0.95rem]">
        {item.text}
      </span>
    </li>
  ));
}

export function AnnouncementTicker({ copy }: { copy: AnnouncementTickerCopy }) {
  const [paused, setPaused] = useState(false);

  if (!copy.items.length) return null;

  return (
    <aside
      aria-label={copy.ariaLabel}
      className="relative z-[55] bg-black text-white"
    >
      <div className={styles.viewport}>
        <div className={cn(styles.track, paused && styles.paused)}>
          <ul className={styles.list}>
            <TickerItems items={copy.items} />
          </ul>
          <ul className={styles.duplicate} aria-hidden="true">
            <TickerItems items={copy.items} duplicate />
          </ul>
        </div>
      </div>
      <button
        type="button"
        aria-label={paused ? copy.playLabel : copy.pauseLabel}
        onClick={() => setPaused((current) => !current)}
        className={styles.motionControl}
      >
        {paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
      </button>
    </aside>
  );
}
