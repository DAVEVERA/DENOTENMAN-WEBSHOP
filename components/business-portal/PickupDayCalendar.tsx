"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  MARKET_STOPS,
  MARKET_STOP_COLORS,
  getMarketStopForDate,
  isMarketStopId,
  isPickupDayAllowedForLocation,
  type MarketStopId,
} from "@/lib/market-schedule";

const WEEKDAY_LABELS = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function PickupDayCalendar({
  selectedDay,
  onSelect,
  disabled = false,
  fixedPickupLocationId = null,
}: {
  selectedDay: Date | null;
  onSelect: (day: Date | null) => void;
  disabled?: boolean;
  fixedPickupLocationId?: string | null;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const weeks = useMemo(() => {
    const firstOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - startOffset);

    const days: Date[] = [];
    for (let i = 0; i < 42; i += 1) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + i);
      days.push(day);
    }
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) result.push(days.slice(i, i + 7));
    return result;
  }, [visibleMonth]);

  const monthLabel = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" }).format(visibleMonth);
  const legendIds: MarketStopId[] = fixedPickupLocationId && isMarketStopId(fixedPickupLocationId)
    ? [fixedPickupLocationId]
    : ["antwerpen", "uden", "hilvarenbeek", "haaren"];

  return (
    <div className="max-w-sm rounded-panel border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
          disabled={disabled}
          aria-label="Vorige maand"
          className="flex h-9 w-9 items-center justify-center rounded-button border border-border disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="font-heading text-body-md font-semibold capitalize text-text">{monthLabel}</p>
        <button
          type="button"
          onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
          disabled={disabled}
          aria-label="Volgende maand"
          className="flex h-9 w-9 items-center justify-center rounded-button border border-border disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {weeks.flat().map((day) => {
          const inMonth = day.getMonth() === visibleMonth.getMonth();
          const isPast = day < today;
          const stop = getMarketStopForDate(day);
          const colors = MARKET_STOP_COLORS[stop.id];
          const selected = selectedDay ? isSameDay(day, selectedDay) : false;
          const allowedForLocation = isPickupDayAllowedForLocation(day, fixedPickupLocationId);
          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={disabled || isPast || !inMonth || !allowedForLocation}
              onClick={() => onSelect(selected ? null : day)}
              title={allowedForLocation ? stop.name : undefined}
              aria-label={allowedForLocation ? `${day.getDate()} ${monthLabel}, ${stop.name}` : undefined}
              aria-hidden={!allowedForLocation || !inMonth ? true : undefined}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-button text-xs font-semibold transition-colors duration-hover-fast ${
                !inMonth || !allowedForLocation ? "pointer-events-none opacity-0" : isPast ? "cursor-not-allowed opacity-30" : ""
              } ${selected ? "ring-2 ring-accent ring-offset-1" : ""} ${colors.bg} ${colors.text}`}
            >
              <span>{day.getDate()}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
        {legendIds.map((id) => (
          <span key={id} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${MARKET_STOP_COLORS[id].dot}`} aria-hidden="true" />
            {MARKET_STOPS[id].name}
          </span>
        ))}
      </div>

      {selectedDay && isPickupDayAllowedForLocation(selectedDay, fixedPickupLocationId) ? (
        <p className="mt-3 text-body-sm text-text">
          Voorkeursdag: <strong>{new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long" }).format(selectedDay)}</strong>
          {" · "}
          {getMarketStopForDate(selectedDay).name}
        </p>
      ) : (
        <p className="mt-3 text-body-sm text-muted">Kies eventueel een voorkeursdag voor het ophalen.</p>
      )}
    </div>
  );
}
