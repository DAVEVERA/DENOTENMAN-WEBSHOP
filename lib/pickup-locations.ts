export type PickupCountry = "NL" | "BE";

export type PickupLocation = {
  id: string;
  name: string;
  country: PickupCountry;
  // First digit(s) of postal codes considered closest to this location.
  // Used only to pre-select a sensible default in NL; customers can still
  // pick the other location themselves.
  postalPrefixes: string[];
  // TODO: fill in the real market address once available.
  address: string;
  // TODO: fill in the real market day/time once available.
  schedule: string;
};

export const PICKUP_LOCATIONS: PickupLocation[] = [
  {
    id: "uden",
    name: "Uden",
    country: "NL",
    postalPrefixes: ["5"],
    address: "TODO: marktadres Uden",
    schedule: "TODO: dag en tijd Uden",
  },
  {
    id: "hilvarenbeek",
    name: "Hilvarenbeek",
    country: "NL",
    postalPrefixes: ["5"],
    address: "TODO: marktadres Hilvarenbeek",
    schedule: "TODO: dag en tijd Hilvarenbeek",
  },
  {
    id: "antwerpen",
    name: "Antwerpen",
    country: "BE",
    postalPrefixes: [],
    address: "TODO: marktadres Antwerpen",
    schedule: "TODO: dag en tijd Antwerpen",
  },
];

export function getPickupLocation(id: string): PickupLocation | undefined {
  return PICKUP_LOCATIONS.find((location) => location.id === id);
}

export function getPickupLocationsForCountry(country: string): PickupLocation[] {
  return PICKUP_LOCATIONS.filter((location) => location.country === country);
}

export function closestPickupLocationId(
  country: string,
  postalCode: string | undefined
): string | undefined {
  const candidates = getPickupLocationsForCountry(country);
  if (candidates.length === 0) return undefined;
  if (!postalCode) return candidates[0].id;

  const normalized = postalCode.trim();
  const match = candidates.find((location) =>
    location.postalPrefixes.some((prefix) => normalized.startsWith(prefix))
  );
  return (match ?? candidates[0]).id;
}
