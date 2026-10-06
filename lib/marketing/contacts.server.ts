import "server-only";

import { getMailchimpEnvironment } from "@/lib/env";
import { getMailchimpClient } from "@/lib/mailchimp/client";
import { runMailchimpRequest } from "@/lib/mailchimp/limiter";
import { BUSINESS_TAG_NAME, syncBusinessNewsletterTags } from "@/lib/mailchimp/business-segment";
import { prisma } from "@/lib/prisma";
import { buildContacts, countryTagChanges, countryTagName, type AudienceMember, type Contact } from "./contacts-core";

type UnknownRecord = Record<string, unknown>;

type ListSdk = {
  getListMembersInfo: (listId: string, options: UnknownRecord) => Promise<unknown>;
  listSegments: (listId: string, options: UnknownRecord) => Promise<unknown>;
  createSegment: (listId: string, body: UnknownRecord) => Promise<unknown>;
  getSegmentMembersList: (listId: string, segmentId: string | number, options: UnknownRecord) => Promise<unknown>;
  batchSegmentMembers: (body: UnknownRecord, listId: string, segmentId: string | number) => Promise<unknown>;
};

const PAGE_SIZE = 1000;
/** A safety stop; the audience is far smaller than this. */
const MAX_MEMBERS = 50_000;
const BATCH_SIZE = 500;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function lists() {
  return getMailchimpClient().lists as unknown as ListSdk;
}

function audienceId() {
  return getMailchimpEnvironment().MAILCHIMP_AUDIENCE_ID;
}

/** Reads a page-wise Mailchimp collection (`key` holds the rows) until it is exhausted. */
async function readAllPages(key: string, fetchPage: (offset: number) => Promise<unknown>): Promise<UnknownRecord[]> {
  const rows: UnknownRecord[] = [];
  for (let offset = 0; offset < MAX_MEMBERS; offset += PAGE_SIZE) {
    const response = await runMailchimpRequest(() => fetchPage(offset));
    const page = isRecord(response) && Array.isArray(response[key]) ? response[key].filter(isRecord) : [];
    rows.push(...page);
    const total = isRecord(response) && typeof response.total_items === "number" ? response.total_items : 0;
    if (page.length < PAGE_SIZE || rows.length >= total) break;
  }
  return rows;
}

export function mapAudienceMember(row: UnknownRecord): AudienceMember | null {
  const email = text(row.email_address);
  if (!email) return null;
  const merge = isRecord(row.merge_fields) ? row.merge_fields : {};
  const location = isRecord(row.location) ? row.location : {};
  return {
    email,
    status: text(row.status),
    firstName: text(merge.FNAME),
    lastName: text(merge.LNAME),
    tags: Array.isArray(row.tags) ? row.tags.filter(isRecord).map((tag) => text(tag.name)).filter(Boolean) : [],
    geoCountry: text(location.country_code) || null,
  };
}

async function loadAudienceMembers(): Promise<AudienceMember[]> {
  const rows = await readAllPages("members", (offset) =>
    lists().getListMembersInfo(audienceId(), {
      count: PAGE_SIZE,
      offset,
      fields: ["members.email_address", "members.status", "members.merge_fields", "members.tags", "members.location", "total_items"],
    }),
  );
  return rows.map(mapAudienceMember).filter((member): member is AudienceMember => member !== null);
}

async function loadShopFacts() {
  const [accounts, consents, orders] = await Promise.all([
    prisma.businessAccount.findMany({
      where: { deletedAt: null },
      select: { email: true, companyName: true, contactName: true, country: true, shippingCity: true, billingCity: true },
    }),
    prisma.newsletterConsent.findMany({ select: { email: true, firstName: true, lastName: true, city: true, country: true } }),
    // Newest first: buildContacts keeps the first row per address.
    prisma.order.findMany({
      where: { isTest: false, status: { in: ["PAID", "FULFILLED"] } },
      orderBy: { createdAt: "desc" },
      select: { contactEmail: true, contactName: true, shippingCity: true, shippingCountry: true },
    }),
  ]);
  return {
    business: accounts.map((account) => ({
      email: account.email,
      companyName: account.companyName,
      contactName: account.contactName,
      city: account.shippingCity || account.billingCity || null,
      country: account.country,
    })),
    consents,
    orders: orders.map((order) => ({ email: order.contactEmail, contactName: order.contactName, city: order.shippingCity, country: order.shippingCountry })),
  };
}

/** Every Mailchimp audience member, enriched with place, country and customer type from the shop. */
export async function loadContacts(): Promise<Contact[]> {
  const [members, facts] = await Promise.all([loadAudienceMembers(), loadShopFacts()]);
  return buildContacts(members, facts);
}

async function staticSegments(): Promise<Array<{ id: number; name: string }>> {
  const response = await runMailchimpRequest(() => lists().listSegments(audienceId(), { type: "static", count: 1000 }));
  const segments = isRecord(response) && Array.isArray(response.segments) ? response.segments.filter(isRecord) : [];
  return segments
    .filter((segment) => typeof segment.id === "number" && typeof segment.name === "string")
    .map((segment) => ({ id: segment.id as number, name: segment.name as string }));
}

async function ensureTag(name: string, existing: Array<{ id: number; name: string }>): Promise<number> {
  const found = existing.find((segment) => segment.name.toLowerCase() === name.toLowerCase());
  if (found) return found.id;
  const created = await runMailchimpRequest(() => lists().createSegment(audienceId(), { name, static_segment: [] }));
  if (!isRecord(created) || typeof created.id !== "number") throw new Error(`Mailchimp gaf geen id terug voor tag "${name}".`);
  return created.id;
}

export type CountryTagSyncResult = {
  countries: Array<{ country: "NL" | "BE"; tagId: number; added: number; removed: number; errors: number }>;
  business: { total: number; tagged: number; skipped: number };
};

/**
 * Makes the Mailchimp tags "Land NL", "Land BE" and "Zakelijk" match the shop's data, so a
 * newsletter can target a country/type selection. Creates a missing country tag.
 */
export async function syncContactTags(): Promise<CountryTagSyncResult> {
  const business = await syncBusinessNewsletterTags();
  const contacts = await loadContacts();
  const segments = await staticSegments();
  const countries: CountryTagSyncResult["countries"] = [];
  for (const country of ["NL", "BE"] as const) {
    const tagId = await ensureTag(countryTagName(country), segments);
    const current = await readAllPages("members", (offset) =>
      lists().getSegmentMembersList(audienceId(), tagId, { count: PAGE_SIZE, offset, fields: ["members.email_address", "total_items"] }),
    );
    const changes = countryTagChanges(contacts, country, current.map((row) => text(row.email_address)).filter(Boolean));
    let errors = 0;
    for (let index = 0; index < Math.max(changes.add.length, changes.remove.length); index += BATCH_SIZE) {
      const response = await runMailchimpRequest(() =>
        lists().batchSegmentMembers(
          { members_to_add: changes.add.slice(index, index + BATCH_SIZE), members_to_remove: changes.remove.slice(index, index + BATCH_SIZE) },
          audienceId(),
          tagId,
        ),
      );
      if (isRecord(response) && Array.isArray(response.errors)) errors += response.errors.length;
    }
    countries.push({ country, tagId, added: changes.add.length, removed: changes.remove.length, errors });
  }
  return { countries, business: { total: business.total, tagged: business.tagged, skipped: business.skipped } };
}

/** Tag ids by name for the newsletter hand-off, without creating anything. */
export async function contactTagIds(): Promise<{ NL: number | null; BE: number | null; business: number | null }> {
  const segments = await staticSegments();
  const id = (name: string) => segments.find((segment) => segment.name.toLowerCase() === name.toLowerCase())?.id ?? null;
  return { NL: id(countryTagName("NL")), BE: id(countryTagName("BE")), business: id(BUSINESS_TAG_NAME) };
}
