// Pure logic for sending a newsletter to a saved Mailchimp segment or to a
// combination of tags. Free of Mailchimp/env imports so it can be unit tested.
// Shapes follow the Mailchimp Marketing API: POST /campaigns
// recipients.segment_opts = { saved_segment_id } or { match, conditions },
// with tag conditions { condition_type: "StaticSegment", field: "static_segment",
// op: "static_is" | "static_not", value: <tag id> }.

import { z } from "zod";

export const newsletterTargetingSchema = z
  .object({
    savedSegmentId: z.number().int().positive().nullable(),
    includeTagIds: z.array(z.number().int().positive()).max(20),
    excludeTagIds: z.array(z.number().int().positive()).max(20),
    match: z.enum(["any", "all"]),
  })
  .strict();

export type NewsletterTargeting = z.infer<typeof newsletterTargetingSchema>;

export type AudienceSegment = {
  id: number;
  name: string;
  /** "saved" segments are rule-based; "static" segments are Mailchimp tags. */
  type: "saved" | "static";
  memberCount: number;
};

export const EMPTY_TARGETING: NewsletterTargeting = {
  savedSegmentId: null,
  includeTagIds: [],
  excludeTagIds: [],
  match: "any",
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

/** A Dutch reason the selection cannot be sent as-is, or null when it is valid. */
export function targetingProblem(targeting: NewsletterTargeting | undefined): string | null {
  if (!targeting) return "Kies een segment of ten minste één tag.";
  const tagCount = targeting.includeTagIds.length + targeting.excludeTagIds.length;
  if (targeting.savedSegmentId !== null && tagCount > 0) return "Kies óf een opgeslagen segment, óf tags; niet allebei.";
  if (targeting.savedSegmentId === null && tagCount === 0) return "Kies een segment of ten minste één tag.";
  if (targeting.includeTagIds.some((id) => targeting.excludeTagIds.includes(id))) return "Een tag kan niet tegelijk opgenomen en uitgesloten zijn.";
  // Mailchimp applies one match rule to every condition, so "any" with an exclusion
  // would also reach everyone outside the excluded tag.
  if (targeting.match === "any" && targeting.excludeTagIds.length > 0 && tagCount > 1) {
    return "Uitsluiten werkt alleen samen met ‘alle gekozen tags’.";
  }
  return null;
}

export class NewsletterTargetingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NewsletterTargetingError";
  }
}

export function buildTargetingSegmentOpts(targeting: NewsletterTargeting | undefined): UnknownRecord {
  const problem = targetingProblem(targeting);
  if (problem || !targeting) throw new NewsletterTargetingError(problem ?? "Kies een segment of tags.");
  if (targeting.savedSegmentId !== null) return { saved_segment_id: targeting.savedSegmentId };
  return {
    match: targeting.match,
    conditions: [
      ...targeting.includeTagIds.map((value) => ({ condition_type: "StaticSegment", field: "static_segment", op: "static_is", value })),
      ...targeting.excludeTagIds.map((value) => ({ condition_type: "StaticSegment", field: "static_segment", op: "static_not", value })),
    ],
  };
}

/** Reads a campaign's recipients back into a segment/tag selection, or null when it is something else. */
export function targetingFromRecipients(recipients: UnknownRecord): NewsletterTargeting | null {
  const opts = recipients.segment_opts;
  if (!isRecord(opts)) return null;
  if (typeof opts.saved_segment_id === "number" && opts.saved_segment_id > 0 && !opts.conditions) {
    return { ...EMPTY_TARGETING, savedSegmentId: opts.saved_segment_id };
  }
  if (!Array.isArray(opts.conditions) || opts.conditions.length === 0 || opts.saved_segment_id || opts.prebuilt_segment_id) return null;
  const match = opts.match === "all" ? "all" : opts.match === "any" ? "any" : null;
  if (!match) return null;
  const includeTagIds: number[] = [];
  const excludeTagIds: number[] = [];
  for (const condition of opts.conditions) {
    if (!isRecord(condition) || condition.condition_type !== "StaticSegment" || condition.field !== "static_segment") return null;
    const value = Number(condition.value);
    if (!Number.isInteger(value) || value <= 0) return null;
    if (condition.op === "static_is") includeTagIds.push(value);
    else if (condition.op === "static_not") excludeTagIds.push(value);
    else return null;
  }
  return { savedSegmentId: null, includeTagIds, excludeTagIds, match };
}

export function mapAudienceSegments(response: unknown): AudienceSegment[] {
  const segments = isRecord(response) && Array.isArray(response.segments) ? response.segments : [];
  return segments
    .filter((segment): segment is UnknownRecord => isRecord(segment) && typeof segment.id === "number" && typeof segment.name === "string")
    .filter((segment) => segment.type === "saved" || segment.type === "static")
    .map((segment) => ({
      id: segment.id as number,
      name: segment.name as string,
      type: segment.type as "saved" | "static",
      memberCount: typeof segment.member_count === "number" ? segment.member_count : 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "nl"));
}
