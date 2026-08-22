"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  MARKET_ROUTE_GROUPS,
  MARKET_STOPS,
  getAmsterdamWeekdayIndex,
  getMarketStopForWeekday,
  type MarketStopId,
} from "@/lib/market-schedule";
import { Container } from "@/components/ui/Container";
import styles from "./MarketRouteMap.module.css";

type MarkerStyle = CSSProperties & {
  "--marker-x": number;
  "--marker-y": number;
};

export type MarketRouteCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  today: string;
  locating: string;
  scheduleTitle: string;
  scheduleText: string;
  swipeHint: string;
  mapAlt: string;
  mapScrollLabel: string;
  weekdayNames: readonly string[];
  scheduleDays: Record<MarketStopId, string>;
};

export function MarketRouteMap({ copy }: { copy: MarketRouteCopy }) {
  const [weekdayIndex, setWeekdayIndex] = useState<number | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const activeStop = weekdayIndex === null ? null : getMarketStopForWeekday(weekdayIndex);

  useEffect(() => {
    const updateWeekday = () => setWeekdayIndex(getAmsterdamWeekdayIndex(new Date()));
    updateWeekday();
    const interval = window.setInterval(updateWeekday, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const centerActiveStop = useCallback(() => {
    const viewport = viewportRef.current;
    const stage = stageRef.current;

    if (!viewport || !stage || !activeStop) {
      return;
    }

    const markerCenter = stage.clientWidth * (activeStop.x / 100);
    viewport.scrollTo({
      left: Math.max(0, markerCenter - viewport.clientWidth / 2),
      behavior: "auto",
    });
  }, [activeStop]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(centerActiveStop);
    window.addEventListener("resize", centerActiveStop);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", centerActiveStop);
    };
  }, [centerActiveStop]);

  const markerStyle: MarkerStyle | undefined = activeStop
    ? { "--marker-x": activeStop.x, "--marker-y": activeStop.y }
    : undefined;

  return (
    <Container className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.lead}>{copy.lead}</p>
      </header>

      <section className={styles.mapCard} aria-label={copy.title}>
        <div className={styles.statusBar} aria-live="polite">
          <span className={styles.statusLabel}>
            <span className={styles.statusDot} aria-hidden="true" />
            {copy.today}
          </span>
          <span className={styles.statusValue}>
            {activeStop && weekdayIndex !== null
              ? `${copy.weekdayNames[weekdayIndex]} · ${activeStop.name}`
              : copy.locating}
          </span>
        </div>

        <div
          ref={viewportRef}
          className={styles.mapViewport}
          tabIndex={0}
          aria-label={copy.mapScrollLabel}
        >
          <div ref={stageRef} className={styles.mapStage}>
            <Image
              src="/pages/waar-is-de-notenman-kaart.png"
              alt={copy.mapAlt}
              width={1672}
              height={941}
              sizes="(max-width: 899px) 58rem, (max-width: 1200px) 100vw, 1152px"
              className={styles.mapImage}
              priority
              onLoad={centerActiveStop}
            />
            {activeStop && markerStyle ? (
              <span className={styles.marker} style={markerStyle} aria-hidden="true" />
            ) : null}
          </div>
        </div>
        <p className={styles.mapHint}>{copy.swipeHint}</p>
      </section>

      <section className={styles.schedule} aria-labelledby="market-schedule-title">
        <div className={styles.scheduleHeader}>
          <h2 id="market-schedule-title" className={styles.scheduleTitle}>
            {copy.scheduleTitle}
          </h2>
          <p className={styles.scheduleText}>{copy.scheduleText}</p>
        </div>
        <div className={styles.scheduleGrid}>
          {MARKET_ROUTE_GROUPS.map((route) => {
            const stop = MARKET_STOPS[route.stopId];
            const isActive = activeStop?.id === route.stopId;

            return (
              <article
                key={route.stopId}
                className={`${styles.scheduleItem}${isActive ? ` ${styles.scheduleItemActive}` : ""}`}
              >
                <span className={styles.scheduleDay}>{copy.scheduleDays[route.stopId]}</span>
                <strong className={styles.schedulePlace}>{stop.name}</strong>
                {isActive ? <span className={styles.todayBadge}>{copy.today}</span> : null}
              </article>
            );
          })}
        </div>
      </section>
    </Container>
  );
}
