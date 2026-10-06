import "server-only";

import { getMailchimpEnvironment } from "@/lib/env";
import { getMailchimpClient } from "@/lib/mailchimp/client";
import { runMailchimpRequest } from "@/lib/mailchimp/limiter";
import { subscriberHash } from "@/lib/mailchimp/subscriberHash";
import { prisma } from "@/lib/prisma";
import { subscribeCheckoutCustomer, type CheckoutOptInOrder, type CheckoutOptInResult } from "./checkout-optin";

type ListsSdk = {
  setListMember: (listId: string, hash: string, body: Record<string, unknown>) => Promise<{ status?: string }>;
  updateListMemberTags: (listId: string, hash: string, body: Record<string, unknown>) => Promise<unknown>;
};

/** Subscribes a paying customer who kept the checkout box ticked. Never throws. */
export async function applyCheckoutNewsletterOptIn(order: CheckoutOptInOrder): Promise<CheckoutOptInResult | null> {
  if (!order.newsletterOptIn || order.isTest) return null;
  try {
    const lists = getMailchimpClient().lists as unknown as ListsSdk;
    const listId = getMailchimpEnvironment().MAILCHIMP_AUDIENCE_ID;
    return await subscribeCheckoutCustomer(order, {
      existingStatus: async (email) =>
        (await prisma.newsletterConsent.findUnique({ where: { email }, select: { status: true } }))?.status ?? null,
      upsertMailchimpMember: async ({ email, firstName, lastName }) => {
        // status_if_new: an existing member keeps their status, so an unsubscribe is respected.
        const member = await runMailchimpRequest(() =>
          lists.setListMember(listId, subscriberHash(email), {
            email_address: email,
            status_if_new: "subscribed",
            merge_fields: { FNAME: firstName, LNAME: lastName },
          }),
        );
        return member?.status ?? "subscribed";
      },
      tagMailchimpMember: async (email, tags) => {
        await runMailchimpRequest(() =>
          lists.updateListMemberTags(listId, subscriberHash(email), { tags: tags.map((name) => ({ name, status: "active" })) }),
        );
      },
      saveConsent: async ({ email, firstName, lastName, status, city, country, locale }) => {
        const now = new Date();
        await prisma.newsletterConsent.upsert({
          where: { email },
          create: { email, firstName, lastName, status, source: "CHECKOUT", optInAt: status === "SUBSCRIBED" ? now : null, locale, city, country },
          update: {
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            status,
            city: city ?? undefined,
            country: country ?? undefined,
            ...(status === "SUBSCRIBED" ? { optInAt: now } : {}),
          },
        });
      },
    });
  } catch (error) {
    console.error("Checkout newsletter opt-in failed", {
      orderId: order.id,
      message: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
    });
    return null;
  }
}
