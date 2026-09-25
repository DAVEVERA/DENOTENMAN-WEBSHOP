// Pure logic for the zakelijk/particulier newsletter segmentation, kept free
// of any Mailchimp/Prisma/env imports so it can be unit tested directly (see
// lib/mailchimp/business-segment.ts for the I/O layer that calls into this).
import type { NewsletterAudience } from "@/lib/mailchimp/schemas";

// Mailchimp tags are implemented as "static" segments: applying the tag
// "Zakelijk" to a list member creates/extends a static segment with that
// name, whose numeric id can then be used in a campaign's segment_opts.
// Source: Mailchimp Marketing API schema for GET /lists/{list_id}/segments
// ("type" enum ["saved","static","fuzzy"], description: "Static segments
// are now known as tags.") and POST /campaigns recipients.segment_opts
// (saved_segment_id / match / conditions), confirmed against the published
// spec at https://raw.githubusercontent.com/mailchimp/mailchimp-client-lib-codegen/main/spec/marketing.json
export const BUSINESS_TAG_NAME = "Zakelijk";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

export type BusinessSegmentInfo = {
  segmentId: number | null;
  memberCount: number;
};

export function findBusinessSegment(response: unknown): BusinessSegmentInfo {
  const segments = isRecord(response) && Array.isArray(response.segments) ? response.segments : [];
  const match = segments.find((segment) => isRecord(segment) && segment.type === "static" && segment.name === BUSINESS_TAG_NAME);
  if (!isRecord(match) || typeof match.id !== "number") {
    return { segmentId: null, memberCount: 0 };
  }
  return {
    segmentId: match.id,
    memberCount: typeof match.member_count === "number" ? match.member_count : 0,
  };
}

export class BusinessSegmentUnavailableError extends Error {
  constructor() {
    super(
      "De zakelijke tag is nog niet gesynchroniseerd met Mailchimp. Synchroniseer eerst de zakelijke contacten."
    );
  }
}

// Builds the `recipients.segment_opts` value for a campaign, per the
// documented Mailchimp shape: { match, conditions: [{ condition_type:
// "StaticSegment", field: "static_segment", op, value }] }. `op` is
// "static_is" to target members of the tag, "static_not" to exclude them.
export function buildAudienceSegmentOpts(
  audience: NewsletterAudience,
  businessSegmentId: number | null
): UnknownRecord | undefined {
  if (audience === "all") return undefined;
  if (audience === "custom") throw new Error("Een bestaande doelgroep kan alleen behouden worden.");
  if (businessSegmentId === null) throw new BusinessSegmentUnavailableError();
  return {
    match: "any",
    conditions: [
      {
        condition_type: "StaticSegment",
        field: "static_segment",
        op: audience === "zakelijk" ? "static_is" : "static_not",
        value: businessSegmentId,
      },
    ],
  };
}

export function audienceFromRecipients(
  recipients: UnknownRecord,
  businessSegmentId: number | null,
): NewsletterAudience {
  const opts = recipients.segment_opts;
  if (opts == null) return "all";
  if (!isRecord(opts)) return "custom";
  if (opts.saved_segment_id || opts.prebuilt_segment_id) return "custom";
  const conditions = opts.conditions;
  if (Object.keys(opts).some((key) => !["saved_segment_id", "match", "conditions"].includes(key))) return "custom";
  if (conditions === undefined || (Array.isArray(conditions) && conditions.length === 0)) return "all";
  if (!Array.isArray(conditions) || conditions.length !== 1 || businessSegmentId === null) return "custom";
  const condition = conditions[0];
  if (!isRecord(condition) || condition.condition_type !== "StaticSegment" || condition.field !== "static_segment"
    || String(condition.value) !== String(businessSegmentId) || !["any", "all"].includes(String(opts.match))) return "custom";
  if (condition.op === "static_is") return "zakelijk";
  if (condition.op === "static_not") return "particulier";
  return "custom";
}

export type BusinessSegmentSyncDeps = {
  listBusinessEmails: () => Promise<string[]>;
  tagMember: (email: string) => Promise<void>;
};

export type BusinessSegmentSyncResult = {
  total: number;
  tagged: number;
  skipped: number;
};

// Pure orchestration, testable without hitting Mailchimp or the database.
export async function syncBusinessNewsletterTagsCore(
  deps: BusinessSegmentSyncDeps
): Promise<BusinessSegmentSyncResult> {
  const emails = await deps.listBusinessEmails();
  let tagged = 0;
  let skipped = 0;
  for (const email of emails) {
    try {
      await deps.tagMember(email);
      tagged += 1;
    } catch (error) {
      // The SDK rejects with SuperAgent errors; only a missing member is skipped.
      const response = isRecord(error) && isRecord(error.response) ? error.response : null;
      const status = isRecord(error) ? error.status ?? response?.status : null;
      if (status !== 404) throw error;
      skipped += 1;
    }
  }
  return { total: emails.length, tagged, skipped };
}
