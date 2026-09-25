import { prisma } from "@/lib/prisma";
import { getMailchimpEnvironment } from "@/lib/env";
import { getMailchimpClient } from "@/lib/mailchimp/client";
import { runMailchimpRequest } from "@/lib/mailchimp/limiter";
import { normalizeSubscriberEmail, subscriberHash } from "@/lib/mailchimp/subscriberHash";
import {
  BUSINESS_TAG_NAME,
  findBusinessSegment,
  syncBusinessNewsletterTagsCore,
  type BusinessSegmentInfo,
  type BusinessSegmentSyncResult,
} from "@/lib/mailchimp/business-segment-logic";

export {
  BUSINESS_TAG_NAME,
  BusinessSegmentUnavailableError,
  buildAudienceSegmentOpts,
  findBusinessSegment,
  syncBusinessNewsletterTagsCore,
} from "@/lib/mailchimp/business-segment-logic";
export type {
  BusinessSegmentInfo,
  BusinessSegmentSyncDeps,
  BusinessSegmentSyncResult,
} from "@/lib/mailchimp/business-segment-logic";

type UnknownRecord = Record<string, unknown>;

type ListSdk = {
  listSegments: (listId: string, options: UnknownRecord) => Promise<unknown>;
  updateListMemberTags: (
    listId: string,
    subscriberHash: string,
    input: UnknownRecord
  ) => Promise<unknown>;
};

function listSdk(): ListSdk {
  return getMailchimpClient().lists as unknown as ListSdk;
}

export async function getBusinessSegmentInfo(): Promise<BusinessSegmentInfo> {
  const audienceId = getMailchimpEnvironment().MAILCHIMP_AUDIENCE_ID;
  const response = await runMailchimpRequest(() =>
    listSdk().listSegments(audienceId, { type: "static", count: 1000 })
  );
  return findBusinessSegment(response);
}

// Tags every non-deleted business account's email as "Zakelijk" in the
// Mailchimp audience, so campaigns can segment by it. Business accounts
// are not linked to NewsletterConsent/Mailchimp membership in the schema,
// so matching happens by email at sync time rather than a stored relation.
export async function syncBusinessNewsletterTags(): Promise<BusinessSegmentSyncResult> {
  const audienceId = getMailchimpEnvironment().MAILCHIMP_AUDIENCE_ID;
  const sdk = listSdk();
  return syncBusinessNewsletterTagsCore({
    listBusinessEmails: async () => {
      const accounts = await prisma.businessAccount.findMany({
        where: { deletedAt: null },
        select: { email: true },
      });
      return accounts.map((account) => account.email);
    },
    tagMember: async (email) => {
      await runMailchimpRequest(() =>
        sdk.updateListMemberTags(audienceId, subscriberHash(normalizeSubscriberEmail(email)), {
          tags: [{ name: BUSINESS_TAG_NAME, status: "active" }],
        })
      );
    },
  });
}
