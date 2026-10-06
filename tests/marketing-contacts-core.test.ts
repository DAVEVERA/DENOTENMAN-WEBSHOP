import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContacts,
  countContacts,
  countryTagChanges,
  DEFAULT_CONTACT_FILTER,
  filterContacts,
  newsletterAudienceFor,
  sortContacts,
  type AudienceMember,
} from "../lib/marketing/contacts-core";

const member = (email: string, extra: Partial<AudienceMember> = {}): AudienceMember => ({
  email,
  status: "subscribed",
  firstName: "",
  lastName: "",
  tags: [],
  geoCountry: null,
  ...extra,
});

const contacts = buildContacts(
  [
    member("Bakker@Example.com", { geoCountry: "BE" }),
    member("anna@example.com", { firstName: "Anna", lastName: "de Vries", geoCountry: "NL" }),
    member("winkel@example.be", { tags: ["Zakelijk"] }),
    member("oud@example.com", { status: "unsubscribed" }),
    member("onbekend@example.com"),
  ],
  {
    business: [{ email: "bakker@example.com", companyName: "Bakkerij Jansen", contactName: "Piet Jansen", city: "Tilburg", country: "NL" }],
    consents: [{ email: "anna@example.com", firstName: "Anna", lastName: "", city: "Haaren", country: "BE" }],
    orders: [
      { email: "winkel@example.be", contactName: "Els Peeters", city: "Antwerpen", country: "BE" },
      { email: "oud@example.com", contactName: "Oud Klant", city: "Breda", country: "NL" },
    ],
  },
);
const byEmail = (email: string) => contacts.find((contact) => contact.email === email)!;

test("the shop's own data beats Mailchimp's geolocation, in a fixed order", () => {
  assert.deepEqual(
    { ...byEmail("bakker@example.com") },
    { email: "bakker@example.com", name: "Piet Jansen", company: "Bakkerij Jansen", city: "Tilburg", country: "NL", countrySource: "zakelijk account", type: "zakelijk", status: "subscribed" },
  );
  assert.equal(byEmail("anna@example.com").country, "BE");
  assert.equal(byEmail("anna@example.com").countrySource, "checkout");
  assert.equal(byEmail("anna@example.com").name, "Anna de Vries");
  assert.equal(byEmail("winkel@example.be").countrySource, "bestelling");
  assert.equal(byEmail("winkel@example.be").type, "zakelijk", "the Zakelijk tag counts as business");
  assert.equal(byEmail("onbekend@example.com").country, null);
  assert.equal(byEmail("onbekend@example.com").type, "particulier");
});

test("filters combine country, type, status and search; the default shows subscribers only", () => {
  assert.equal(filterContacts(contacts, DEFAULT_CONTACT_FILTER).length, 4);
  assert.deepEqual(
    filterContacts(contacts, { ...DEFAULT_CONTACT_FILTER, country: "BE", type: "particulier" }).map((contact) => contact.email),
    ["anna@example.com"],
  );
  assert.deepEqual(filterContacts(contacts, { ...DEFAULT_CONTACT_FILTER, country: "UNKNOWN" }).map((contact) => contact.email), ["onbekend@example.com"]);
  assert.deepEqual(filterContacts(contacts, { ...DEFAULT_CONTACT_FILTER, status: "all", query: "breda" }).map((contact) => contact.email), ["oud@example.com"]);
});

test("sorting by city puts unknown places last and flips on desc", () => {
  const asc = sortContacts(contacts, "city", "asc").map((contact) => contact.city);
  assert.deepEqual(asc, ["Antwerpen", "Breda", "Haaren", "Tilburg", null]);
  assert.equal(sortContacts(contacts, "city", "desc")[0].city, null);
});

test("counts per country and type cover subscribers only", () => {
  const counts = countContacts(contacts);
  assert.equal(counts.total, 5);
  assert.equal(counts.subscribed, 4);
  assert.deepEqual(counts.groups.map((group) => group.count), [0, 1, 1, 1]);
  assert.equal(counts.unknownCountry, 1);
});

test("the newsletter audience follows the filter", () => {
  const tags = { NL: 11, BE: 12, business: 99 };
  assert.deepEqual(newsletterAudienceFor({ country: null, type: null }, tags), { audience: "all" });
  assert.deepEqual(newsletterAudienceFor({ country: null, type: "zakelijk" }, tags), { audience: "zakelijk" });
  assert.deepEqual(newsletterAudienceFor({ country: "BE", type: "particulier" }, tags), {
    audience: "segment",
    targeting: { savedSegmentId: null, includeTagIds: [12], excludeTagIds: [99], match: "all" },
  });
  assert.deepEqual(newsletterAudienceFor({ country: "NL", type: "zakelijk" }, tags), {
    audience: "segment",
    targeting: { savedSegmentId: null, includeTagIds: [11, 99], excludeTagIds: [], match: "all" },
  });
  assert.ok("error" in newsletterAudienceFor({ country: "NL", type: null }, { BE: 12 }));
});

test("country tag changes add the missing members and remove the stale ones", () => {
  assert.deepEqual(countryTagChanges(contacts, "BE", ["WINKEL@example.be", "bakker@example.com"]), {
    add: ["anna@example.com"],
    remove: ["bakker@example.com"],
  });
});
