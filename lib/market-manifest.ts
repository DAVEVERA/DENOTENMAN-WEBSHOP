import { MARKET_ROUTE_GROUPS, MARKET_STOPS, isMarketStopId } from "@/lib/market-schedule";

// Pure grouping logic for the market pickup hand-out list (afhaalmanifest).
// Consumer PICKUP orders don't carry a specific pickup date — customers only
// choose a market location (see lib/pickup-locations.ts) and pick up on that
// market's next occurrence. So "per markt/dag" groups by pickup location,
// labeled with that market's fixed weekday from lib/market-schedule.ts.

const WEEKDAY_LABELS_NL = [
  "zondag",
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
];

export function marketManifestLocationLabel(locationId: string): string {
  if (!isMarketStopId(locationId)) return locationId;
  const name = MARKET_STOPS[locationId].name;
  const route = MARKET_ROUTE_GROUPS.find((group) => group.stopId === locationId);
  const dayLabel = route ? route.weekdays.map((weekday) => WEEKDAY_LABELS_NL[weekday]).join(" & ") : null;
  return dayLabel ? `${name} — ${dayLabel}` : name;
}

export type MarketManifestOrderItem = {
  productName: string;
  variantLabel: string;
  quantity: number;
};

export type MarketManifestOrder = {
  id: string;
  contactName: string;
  contactPhone: string | null;
  pickupLocationId: string | null;
  items: MarketManifestOrderItem[];
};

export type MarketManifestGroup = {
  locationId: string;
  locationLabel: string;
  orders: MarketManifestOrder[];
};

const UNKNOWN_LOCATION_ID = "onbekend";

export function groupOrdersForMarketManifest(
  orders: MarketManifestOrder[]
): MarketManifestGroup[] {
  const ordersByLocation = new Map<string, MarketManifestOrder[]>();

  for (const order of orders) {
    const key = order.pickupLocationId ?? UNKNOWN_LOCATION_ID;
    const list = ordersByLocation.get(key);
    if (list) {
      list.push(order);
    } else {
      ordersByLocation.set(key, [order]);
    }
  }

  const groups: MarketManifestGroup[] = Array.from(ordersByLocation.entries()).map(
    ([locationId, groupOrders]) => ({
      locationId,
      locationLabel:
        locationId === UNKNOWN_LOCATION_ID ? "Onbekende afhaallocatie" : marketManifestLocationLabel(locationId),
      orders: [...groupOrders].sort((a, b) => a.contactName.localeCompare(b.contactName, "nl")),
    })
  );

  return groups.sort((a, b) => a.locationLabel.localeCompare(b.locationLabel, "nl"));
}
