import assert from "node:assert/strict";
import test from "node:test";
import { groupOrdersForMarketManifest, marketManifestLocationLabel } from "../lib/market-manifest";

test("labels a known market stop with its name and fixed weekday", () => {
  assert.equal(marketManifestLocationLabel("hilvarenbeek"), "Hilvarenbeek — donderdag");
  assert.equal(marketManifestLocationLabel("uden"), "Uden — vrijdag");
  assert.equal(marketManifestLocationLabel("antwerpen"), "Antwerpen — zaterdag");
});

test("falls back to the raw id for an unrecognized location", () => {
  assert.equal(marketManifestLocationLabel("some-unknown-id"), "some-unknown-id");
});

test("groups orders by pickup location and sorts orders alphabetically within a group", () => {
  const groups = groupOrdersForMarketManifest([
    { id: "o1", contactName: "Zeeman", contactPhone: null, pickupLocationId: "uden", items: [] },
    { id: "o2", contactName: "Aalders", contactPhone: null, pickupLocationId: "uden", items: [] },
    { id: "o3", contactName: "Bakker", contactPhone: "06-123", pickupLocationId: "antwerpen", items: [] },
  ]);

  assert.equal(groups.length, 2);
  const antwerpen = groups.find((group) => group.locationId === "antwerpen");
  const uden = groups.find((group) => group.locationId === "uden");
  assert.ok(antwerpen);
  assert.ok(uden);
  assert.deepEqual(uden.orders.map((order) => order.contactName), ["Aalders", "Zeeman"]);
  assert.equal(antwerpen.orders[0].contactPhone, "06-123");
});

test("groups orders with no pickup location under an explicit unknown bucket", () => {
  const groups = groupOrdersForMarketManifest([
    { id: "o1", contactName: "Jansen", contactPhone: null, pickupLocationId: null, items: [] },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].locationLabel, "Onbekende afhaallocatie");
});
