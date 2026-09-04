export const MARKET_TIME_ZONE = "Europe/Amsterdam";

export const MARKET_STOPS = {
  hilvarenbeek: {
    id: "hilvarenbeek",
    name: "Hilvarenbeek",
    x: 51.1,
    y: 54.5,
  },
  uden: {
    id: "uden",
    name: "Uden",
    x: 66.9,
    y: 53.5,
  },
  antwerpen: {
    id: "antwerpen",
    name: "Antwerpen",
    x: 17.5,
    y: 36.6,
  },
  haaren: {
    id: "haaren",
    name: "Haaren (NB)",
    x: 83.1,
    y: 64.5,
  },
} as const;

export type MarketStopId = keyof typeof MARKET_STOPS;
export type MarketStop = (typeof MARKET_STOPS)[MarketStopId];

// Fixed brand colors per market stop, used to color-code pickup-day
// calendars. Haaren is the home base rather than a market stand, so it
// gets a neutral tone instead of one of the three requested market colors.
export const MARKET_STOP_COLORS: Record<MarketStopId, { bg: string; text: string; dot: string }> = {
  hilvarenbeek: { bg: "bg-blue-100", text: "text-blue-900", dot: "bg-blue-500" },
  uden: { bg: "bg-emerald-100", text: "text-emerald-900", dot: "bg-emerald-500" },
  antwerpen: { bg: "bg-orange-100", text: "text-orange-900", dot: "bg-orange-500" },
  haaren: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" },
};

export const MARKET_ROUTE_GROUPS: readonly {
  stopId: MarketStopId;
  weekdays: readonly number[];
}[] = [
  { stopId: "hilvarenbeek", weekdays: [4] },
  { stopId: "uden", weekdays: [5] },
  { stopId: "antwerpen", weekdays: [6] },
  { stopId: "haaren", weekdays: [0, 1, 2, 3] },
] as const;

const AMSTERDAM_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: MARKET_TIME_ZONE,
  weekday: "short",
});

const WEEKDAY_INDEX_BY_NAME: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function getAmsterdamWeekdayIndex(date: Date): number {
  const weekday = AMSTERDAM_WEEKDAY_FORMATTER.format(date);
  const weekdayIndex = WEEKDAY_INDEX_BY_NAME[weekday];

  if (weekdayIndex === undefined) {
    throw new Error(`Unsupported Amsterdam weekday: ${weekday}`);
  }

  return weekdayIndex;
}

export function getMarketStopForWeekday(weekdayIndex: number): MarketStop {
  const route = MARKET_ROUTE_GROUPS.find((item) => item.weekdays.includes(weekdayIndex));

  if (!route) {
    throw new RangeError(`Weekday index must be between 0 and 6, received ${weekdayIndex}`);
  }

  return MARKET_STOPS[route.stopId];
}

export function getMarketStopForDate(date: Date): MarketStop {
  return getMarketStopForWeekday(getAmsterdamWeekdayIndex(date));
}
