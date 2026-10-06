import assert from "node:assert/strict";
import test from "node:test";

import { countryTag, splitName, subscribeCheckoutCustomer, CUSTOMER_TAG, type CheckoutOptInDependencies, type CheckoutOptInOrder } from "../lib/newsletter/checkout-optin";

const order: CheckoutOptInOrder = {
  id: "o1",
  contactEmail: "  Fedor.Jansen@Example.com ",
  contactName: "Fedor van den Berg",
  shippingCity: "Haaren",
  shippingCountry: "NL",
  locale: "nl",
  newsletterOptIn: true,
  isTest: false,
};

function fakes(overrides: { previous?: Awaited<ReturnType<CheckoutOptInDependencies["existingStatus"]>>; mailchimp?: string } = {}) {
  const calls = { upsert: [] as unknown[], tags: [] as unknown[], saved: [] as Array<Record<string, unknown>> };
  const dependencies: CheckoutOptInDependencies = {
    existingStatus: async () => overrides.previous ?? null,
    upsertMailchimpMember: async (input) => { calls.upsert.push(input); return overrides.mailchimp ?? "subscribed"; },
    tagMailchimpMember: async (email, tags) => { calls.tags.push({ email, tags }); },
    saveConsent: async (input) => { calls.saved.push(input); },
  };
  return { calls, dependencies };
}

test("a paying customer who kept the box ticked is subscribed with name, place and country", async () => {
  const { calls, dependencies } = fakes();
  const result = await subscribeCheckoutCustomer(order, dependencies);
  assert.deepEqual(result, { status: "subscribed", mailchimpStatus: "subscribed" });
  assert.deepEqual(calls.upsert, [{ email: "fedor.jansen@example.com", firstName: "Fedor", lastName: "van den Berg" }]);
  assert.deepEqual(calls.tags, [{ email: "fedor.jansen@example.com", tags: [CUSTOMER_TAG, "Land NL"] }]);
  assert.equal(calls.saved[0].status, "SUBSCRIBED");
  assert.equal(calls.saved[0].city, "Haaren");
  assert.equal(calls.saved[0].country, "NL");
});

test("an unticked box, a test order or an earlier unsubscribe never subscribes", async () => {
  for (const [input, previous, reason] of [
    [{ ...order, newsletterOptIn: false }, null, "not-opted-in"],
    [{ ...order, isTest: true }, null, "test-order"],
    [order, "UNSUBSCRIBED", "previously-unsubscribed"],
    [order, "CLEANED", "previously-unsubscribed"],
  ] as const) {
    const { calls, dependencies } = fakes({ previous });
    assert.deepEqual(await subscribeCheckoutCustomer(input, dependencies), { status: "skipped", reason });
    assert.equal(calls.upsert.length, 0, reason);
    assert.equal(calls.saved.length, 0, reason);
  }
});

test("when Mailchimp still has the address unsubscribed, the unsubscribe is mirrored, not overwritten", async () => {
  const { calls, dependencies } = fakes({ mailchimp: "unsubscribed" });
  assert.deepEqual(await subscribeCheckoutCustomer(order, dependencies), { status: "skipped", reason: "previously-unsubscribed" });
  assert.equal(calls.tags.length, 0);
  assert.equal(calls.saved[0].status, "UNSUBSCRIBED");
});

test("an existing subscriber stays subscribed and gets the customer tags", async () => {
  const { calls, dependencies } = fakes({ previous: "SUBSCRIBED" });
  assert.equal((await subscribeCheckoutCustomer({ ...order, shippingCountry: "BE" }, dependencies)).status, "kept");
  assert.deepEqual((calls.tags[0] as { tags: string[] }).tags, [CUSTOMER_TAG, "Land BE"]);
});

test("helpers: country tags only for NL and BE, names split on the first space", () => {
  assert.equal(countryTag("NL"), "Land NL");
  assert.equal(countryTag("DE"), null);
  assert.equal(countryTag(null), null);
  assert.deepEqual(splitName("  Anna  "), { firstName: "Anna", lastName: "" });
});
