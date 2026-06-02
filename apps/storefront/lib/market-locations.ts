export type MarketLocation = {
  name: string;
  city: string;
  x: number;
  y: number;
  days: readonly number[];
  label: string;
};

export const MAP_SIZE = {
  width: 1672,
  height: 941,
} as const;

export const MARKET_LOCATIONS: readonly MarketLocation[] = [
  { name: "Anvers", city: "Antwerpen", x: 17.46, y: 36.88, days: [5, 6], label: "Vrijdag en zaterdag" },
  { name: "Hilvarenbeek", city: "Hilvarenbeek", x: 51.2, y: 54.41, days: [4], label: "Donderdag" },
  { name: "Uden", city: "Uden", x: 66.87, y: 53.45, days: [3], label: "Woensdag" },
  { name: "Haaren", city: "Haaren", x: 83.13, y: 64.4, days: [0, 1, 2], label: "Zondag, maandag en dinsdag" },
] as const;

export const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function getActiveMarketLocation(dayIndex: number) {
  return MARKET_LOCATIONS.find((location) => location.days.includes(dayIndex)) ?? null;
}
