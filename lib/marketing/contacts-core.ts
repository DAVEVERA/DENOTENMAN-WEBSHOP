// Pure logic for the e-mail address list in Marketing: one row per Mailchimp audience
// member, enriched with what the shop knows (business accounts, checkout opt-ins,
// orders). No I/O here, so it can be tested directly.

export type ContactCountry = "NL" | "BE" | "OTHER" | null;
export type ContactType = "particulier" | "zakelijk";
export type ContactStatus = "subscribed" | "unsubscribed" | "pending" | "cleaned" | "transactional" | "archived";

export type AudienceMember = {
  email: string;
  status: string;
  firstName: string;
  lastName: string;
  tags: string[];
  /** Mailchimp's own geolocation, the weakest source for the country. */
  geoCountry: string | null;
};

export type BusinessFact = { email: string; companyName: string; contactName: string; city: string | null; country: string | null };
export type ConsentFact = { email: string; firstName: string | null; lastName: string | null; city: string | null; country: string | null };
export type OrderFact = { email: string; contactName: string; city: string | null; country: string | null };

export type Contact = {
  email: string;
  name: string;
  company: string | null;
  city: string | null;
  country: ContactCountry;
  /** Where the country came from, for the admin's trust. */
  countrySource: "zakelijk account" | "checkout" | "bestelling" | "Mailchimp" | null;
  type: ContactType;
  status: ContactStatus;
};

export const BUSINESS_TAG = "Zakelijk";

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("nl-NL");
}

function country(value: string | null | undefined): ContactCountry {
  const upper = value?.trim().toUpperCase();
  if (!upper) return null;
  if (upper === "NL" || upper === "NLD" || upper === "NETHERLANDS") return "NL";
  if (upper === "BE" || upper === "BEL" || upper === "BELGIUM") return "BE";
  return "OTHER";
}

function status(value: string): ContactStatus {
  return (["subscribed", "unsubscribed", "pending", "cleaned", "transactional", "archived"] as const).find((known) => known === value) ?? "unsubscribed";
}

export function buildContacts(
  members: AudienceMember[],
  facts: { business: BusinessFact[]; consents: ConsentFact[]; orders: OrderFact[] },
): Contact[] {
  // The first row per address wins, so callers pass the newest order first.
  const byEmail = <T extends { email: string }>(rows: T[]) => {
    const map = new Map<string, T>();
    for (const row of rows) if (!map.has(normalizeEmail(row.email))) map.set(normalizeEmail(row.email), row);
    return map;
  };
  const business = byEmail(facts.business);
  const consents = byEmail(facts.consents);
  const orders = byEmail(facts.orders);
  return members.map((member) => {
    const email = normalizeEmail(member.email);
    const account = business.get(email);
    const consent = consents.get(email);
    const order = orders.get(email);
    const sources: Array<[Contact["countrySource"], string | null | undefined]> = [
      ["zakelijk account", account?.country],
      ["checkout", consent?.country],
      ["bestelling", order?.country],
      ["Mailchimp", member.geoCountry],
    ];
    const found = sources.find(([, value]) => country(value) !== null);
    const memberName = [member.firstName, member.lastName].filter(Boolean).join(" ").trim();
    const consentName = [consent?.firstName, consent?.lastName].filter(Boolean).join(" ").trim();
    return {
      email,
      name: memberName || consentName || account?.contactName || order?.contactName || "",
      company: account?.companyName ?? null,
      city: account?.city || consent?.city || order?.city || null,
      country: found ? country(found[1]) : null,
      countrySource: found ? found[0] : null,
      type: account || member.tags.some((tag) => tag.toLowerCase() === BUSINESS_TAG.toLowerCase()) ? "zakelijk" : "particulier",
      status: status(member.status),
    };
  });
}

export type ContactFilter = {
  country: "NL" | "BE" | "OTHER" | "UNKNOWN" | null;
  type: ContactType | null;
  status: ContactStatus | "all";
  query: string;
};

export const DEFAULT_CONTACT_FILTER: ContactFilter = { country: null, type: null, status: "subscribed", query: "" };

export function filterContacts(contacts: Contact[], filter: ContactFilter): Contact[] {
  const query = filter.query.trim().toLocaleLowerCase("nl-NL");
  return contacts.filter((contact) =>
    (filter.status === "all" || contact.status === filter.status)
    && (!filter.type || contact.type === filter.type)
    && (!filter.country || (filter.country === "UNKNOWN" ? contact.country === null : contact.country === filter.country))
    && (!query || [contact.email, contact.name, contact.company ?? "", contact.city ?? ""].some((value) => value.toLocaleLowerCase("nl-NL").includes(query))),
  );
}

export type ContactSortKey = "email" | "name" | "city" | "country" | "type";

export function sortContacts(contacts: Contact[], key: ContactSortKey, direction: "asc" | "desc"): Contact[] {
  const collator = new Intl.Collator("nl", { sensitivity: "base", numeric: true });
  const value = (contact: Contact) => contact[key] || null;
  const compare = (left: string | null, right: string | null) =>
    left === right ? 0 : left === null ? 1 : right === null ? -1 : collator.compare(left, right);
  const sorted = [...contacts].sort((left, right) => compare(value(left), value(right)) || collator.compare(left.email, right.email));
  return direction === "desc" ? sorted.reverse() : sorted;
}

export function countContacts(contacts: Contact[]) {
  const subscribed = contacts.filter((contact) => contact.status === "subscribed");
  const count = (country: ContactCountry, type: ContactType) => subscribed.filter((contact) => contact.country === country && contact.type === type).length;
  return {
    total: contacts.length,
    subscribed: subscribed.length,
    groups: [
      { country: "NL" as const, type: "particulier" as const, count: count("NL", "particulier") },
      { country: "NL" as const, type: "zakelijk" as const, count: count("NL", "zakelijk") },
      { country: "BE" as const, type: "particulier" as const, count: count("BE", "particulier") },
      { country: "BE" as const, type: "zakelijk" as const, count: count("BE", "zakelijk") },
    ],
    unknownCountry: subscribed.filter((contact) => contact.country === null).length,
  };
}

/** The Mailchimp tag that holds the members of a country, as kept in sync by the admin. */
export function countryTagName(country: "NL" | "BE"): string {
  return `Land ${country}`;
}

/**
 * Turns the list's country/type filter into the newsletter's audience: a built-in
 * audience when possible, otherwise a tag selection (include country, include or
 * exclude the business tag, all must match).
 */
export function newsletterAudienceFor(
  filter: { country: "NL" | "BE" | null; type: ContactType | null },
  tagIds: { NL?: number | null; BE?: number | null; business?: number | null },
):
  | { audience: "all" | "zakelijk" | "particulier" }
  | { audience: "segment"; targeting: { savedSegmentId: null; includeTagIds: number[]; excludeTagIds: number[]; match: "all" } }
  | { error: string } {
  if (!filter.country) return { audience: filter.type ?? "all" };
  const countryTag = tagIds[filter.country];
  if (!countryTag) return { error: `De tag "${countryTagName(filter.country)}" bestaat nog niet in Mailchimp. Werk eerst de landen-tags bij.` };
  if (filter.type && !tagIds.business) return { error: `De tag "${BUSINESS_TAG}" bestaat nog niet in Mailchimp. Synchroniseer eerst de zakelijke contacten.` };
  return {
    audience: "segment",
    targeting: {
      savedSegmentId: null,
      includeTagIds: filter.type === "zakelijk" ? [countryTag, tagIds.business as number] : [countryTag],
      excludeTagIds: filter.type === "particulier" ? [tagIds.business as number] : [],
      match: "all",
    },
  };
}

/** Which members to add to and remove from a country tag so it matches the shop's data. */
export function countryTagChanges(contacts: Contact[], country: "NL" | "BE", currentMembers: string[]) {
  const wanted = new Set(contacts.filter((contact) => contact.country === country && contact.status !== "archived").map((contact) => contact.email));
  const current = new Set(currentMembers.map(normalizeEmail));
  return {
    add: [...wanted].filter((email) => !current.has(email)),
    remove: [...current].filter((email) => !wanted.has(email)),
  };
}
