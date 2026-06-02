"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import {
  getActiveMarketLocation,
  MARKET_LOCATIONS,
  WEEKDAY_TO_INDEX,
  type MarketLocation,
} from "../../lib/market-locations";

function getAmsterdamDayIndex() {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Europe/Amsterdam",
  }).format(new Date());

  return WEEKDAY_TO_INDEX[weekday] ?? new Date().getDay();
}

function getRouteLink(location: MarketLocation) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${location.name} ${location.city} markt`,
  )}`;
}

export function InteractiveMarketMap() {
  const [today] = useState(getAmsterdamDayIndex);
  const activeLocation = useMemo(() => getActiveMarketLocation(today), [today]);
  const [selectedName, setSelectedName] = useState(activeLocation?.name ?? MARKET_LOCATIONS[0].name);
  const selectedLocation =
    MARKET_LOCATIONS.find((location) => location.name === selectedName) ?? MARKET_LOCATIONS[0];

  return (
    <div className="market-map" aria-label="Interactieve kaart met marktlocaties">
      <div className="market-map__canvas">
        {MARKET_LOCATIONS.map((location) => {
          const isActive = activeLocation?.name === location.name;
          const isSelected = selectedLocation.name === location.name;

          return (
            <button
              key={location.name}
              className="market-map__marker"
              type="button"
              style={
                {
                  "--marker-x": `${location.x}%`,
                  "--marker-y": `${location.y}%`,
                } as CSSProperties
              }
              data-active={isActive ? "true" : undefined}
              data-selected={isSelected ? "true" : undefined}
              aria-pressed={isSelected}
              aria-label={`${location.name}, ${location.label}`}
              onClick={() => setSelectedName(location.name)}
            >
              <span className="market-map__pulse" aria-hidden="true" />
              <span className="market-map__pin" aria-hidden="true" />
              <span className="market-map__marker-label">{location.name}</span>
            </button>
          );
        })}
      </div>

      <aside className="market-map__panel" aria-live="polite">
        <span>{activeLocation?.name === selectedLocation.name ? "Vandaag op de markt" : "Marktlocatie"}</span>
        <h2>{selectedLocation.name}</h2>
        <p>{selectedLocation.label}</p>
        <a href={getRouteLink(selectedLocation)} target="_blank" rel="noreferrer">
          Route openen
        </a>
      </aside>
    </div>
  );
}
