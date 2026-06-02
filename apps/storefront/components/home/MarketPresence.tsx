"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getActiveMarketLocation,
  MAP_SIZE,
  MARKET_LOCATIONS,
  WEEKDAY_TO_INDEX,
} from "../../lib/market-locations";

function getAmsterdamDayIndex() {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Europe/Amsterdam",
  }).format(new Date());

  return WEEKDAY_TO_INDEX[weekday] ?? new Date().getDay();
}

export function MarketPresence() {
  const [today] = useState(getAmsterdamDayIndex);
  const [selectedName, setSelectedName] = useState(() => {
    const currentLocation = getActiveMarketLocation(getAmsterdamDayIndex());
    return currentLocation?.name ?? MARKET_LOCATIONS[0].name;
  });

  const activeLocation = useMemo(() => getActiveMarketLocation(today), [today]);

  const selectedLocation =
    MARKET_LOCATIONS.find((location) => location.name === selectedName) ?? activeLocation;

  return (
    <section className="landing-market-presence" aria-label="Marktlocaties van De Notenman">
      <div className="landing-market-presence__locations" role="list">
        {MARKET_LOCATIONS.map((location) => {
          const isActive = activeLocation?.name === location.name;
          const isSelected = selectedLocation?.name === location.name;

          return (
            <button
              className="landing-market-presence__location"
              type="button"
              key={location.name}
              data-active={isActive ? "true" : undefined}
              data-selected={isSelected ? "true" : undefined}
              aria-pressed={isSelected}
              onClick={() => setSelectedName(location.name)}
            >
              <span className="landing-market-presence__lamp" aria-hidden="true" />
              <span>{location.name}</span>
            </button>
          );
        })}
      </div>
      {selectedLocation ? (
        <p className="landing-market-presence__days">
          {selectedLocation.name}: {selectedLocation.label}
        </p>
      ) : null}
    </section>
  );
}

export function MarketMapBlinkers() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [today] = useState(getAmsterdamDayIndex);
  const [mapStyle, setMapStyle] = useState<CSSProperties>({
    "--market-map-position": "50% 50%",
    "--market-marker-x": "50%",
    "--market-marker-y": "50%",
  } as CSSProperties);

  const activeLocation = useMemo(() => getActiveMarketLocation(today), [today]);

  useEffect(() => {
    const mapElement = mapRef.current;

    if (!mapElement || !activeLocation) return;

    const updateMarkerPosition = () => {
      const { width, height } = mapElement.getBoundingClientRect();

      if (!width || !height) return;

      const isMobileHero = width <= 620;
      const focusX = isMobileHero ? activeLocation.x : 50;
      const focusY = isMobileHero ? activeLocation.y : 50;
      const scale = Math.max(width / MAP_SIZE.width, height / MAP_SIZE.height);
      const renderedWidth = MAP_SIZE.width * scale;
      const renderedHeight = MAP_SIZE.height * scale;
      const offsetX = (width - renderedWidth) * (focusX / 100);
      const offsetY = (height - renderedHeight) * (focusY / 100);
      const markerX = offsetX + renderedWidth * (activeLocation.x / 100);
      const markerY = offsetY + renderedHeight * (activeLocation.y / 100);

      setMapStyle({
        "--market-map-position": `${focusX}% ${focusY}%`,
        "--market-marker-x": `${markerX}px`,
        "--market-marker-y": `${markerY}px`,
      } as CSSProperties);
    };

    updateMarkerPosition();

    const resizeObserver = new ResizeObserver(updateMarkerPosition);
    resizeObserver.observe(mapElement);

    return () => resizeObserver.disconnect();
  }, [activeLocation]);

  if (!activeLocation) return null;

  return (
    <div
      className="landing-market-map-layer"
      data-location={activeLocation.name}
      ref={mapRef}
      style={mapStyle}
      aria-hidden="true"
    >
      <span className="landing-market-map-blinker">
        <span className="landing-market-map-blinker__halo" />
        <span className="landing-market-map-blinker__ring" />
        <span className="landing-market-map-blinker__core" />
      </span>
    </div>
  );
}
