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
