import assert from "node:assert/strict";
import {
  PICKUP_LOCATIONS,
  getPickupLocation,
  getPickupLocationsForCountry,
  closestPickupLocationId,
} from "../lib/pickup-locations";

assert.equal(PICKUP_LOCATIONS.length, 3);

assert.deepEqual(
  getPickupLocationsForCountry("NL").map((location) => location.id).sort(),
  ["hilvarenbeek", "uden"]
);
assert.deepEqual(
  getPickupLocationsForCountry("BE").map((location) => location.id),
  ["antwerpen"]
);
assert.deepEqual(getPickupLocationsForCountry("FR"), []);

assert.equal(getPickupLocation("uden")?.country, "NL");
assert.equal(getPickupLocation("antwerpen")?.country, "BE");
assert.equal(getPickupLocation("unknown"), undefined);

// Falls back to the first NL location when no postal code is given.
assert.equal(closestPickupLocationId("NL", undefined), "uden");
// Both NL locations currently share the "5" prefix, so any 5xxx postcode
// resolves to the first match; this stays correct once real prefixes are
// filled in and locations no longer overlap.
assert.equal(closestPickupLocationId("NL", "5405 AB"), "uden");

// BE has a single location regardless of postal code.
assert.equal(closestPickupLocationId("BE", "2000"), "antwerpen");

// Unknown country has no pickup locations at all.
assert.equal(closestPickupLocationId("FR", "75001"), undefined);

console.log("pickup location tests passed");
