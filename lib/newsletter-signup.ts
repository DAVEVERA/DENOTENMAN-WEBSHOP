import { z } from "zod";
import type { Locale } from "@/lib/i18n";
import { normalizeSubscriberEmail } from "@/lib/mailchimp/subscriberHash";

export const newsletterSignupInputSchema = z
  .object({
    email: z.string().trim().email().max(254),
    locale: z.enum(["nl", "en", "fr"]),
    consent: z.literal(true),
    website: z.string().trim().max(200).optional().default(""),
  })
  .strict();

export type NewsletterSignupInput = z.infer<typeof newsletterSignupInputSchema>;

export type PendingNewsletterSignup = {
  email: string;
  locale: Locale;
  ipAddress?: string;
};

export type NewsletterConsentState =
  | "SUBSCRIBED"
  | "UNSUBSCRIBED"
  | "PENDING"
  | "CLEANED";

export type NewsletterSignupDependencies = {
  getExistingConsentStatus: (email: string) => Promise<NewsletterConsentState | null>;
  addPendingMailchimpMember: (
    signup: PendingNewsletterSignup,
    existingStatus: NewsletterConsentState | null
  ) => Promise<void>;
  savePendingConsent: (signup: PendingNewsletterSignup) => Promise<void>;
};

export function pendingNewsletterConsentData(signup: PendingNewsletterSignup) {
  return {
    status: "PENDING" as const,
    source: "FORM" as const,
    locale: signup.locale,
    ...(signup.ipAddress ? { optInIp: signup.ipAddress } : {}),
  };
}

export async function submitNewsletterSignup(
  input: NewsletterSignupInput,
  ipAddress: string | undefined,
  dependencies: NewsletterSignupDependencies
): Promise<void> {
  const signup: PendingNewsletterSignup = {
    email: normalizeSubscriberEmail(input.email),
    locale: input.locale,
    ...(ipAddress ? { ipAddress } : {}),
  };

  const existingStatus = await dependencies.getExistingConsentStatus(signup.email);
  if (existingStatus === "SUBSCRIBED") return;

  // Mailchimp is the source that sends the double-opt-in confirmation. Save the
  // local pending record only after that request has been accepted. Retrying is
  // safe because Mailchimp's member endpoint and the local upsert are idempotent.
  await dependencies.addPendingMailchimpMember(signup, existingStatus);
  await dependencies.savePendingConsent(signup);
}

type RateLimitEntry = { count: number; resetAt: number };

type NewsletterRateLimiterOptions = {
  limit?: number;
  windowMs?: number;
  maxKeys?: number;
  now?: () => number;
};

export type NewsletterRateLimitResult = {
  limited: boolean;
  retryAfterSeconds: number;
};

export function createNewsletterRateLimiter({
  limit = 8,
  windowMs = 10 * 60_000,
  maxKeys = 5_000,
  now = Date.now,
}: NewsletterRateLimiterOptions = {}) {
  const attempts = new Map<string, RateLimitEntry>();

  return (key: string): NewsletterRateLimitResult => {
    const currentTime = now();
    let entry = attempts.get(key);

    if (!entry || entry.resetAt <= currentTime) {
      if (!entry && attempts.size >= maxKeys) {
        for (const [storedKey, storedEntry] of attempts) {
          if (storedEntry.resetAt <= currentTime) attempts.delete(storedKey);
        }
        while (attempts.size >= maxKeys) {
          const oldestKey = attempts.keys().next().value as string | undefined;
          if (!oldestKey) break;
          attempts.delete(oldestKey);
        }
      }

      entry = { count: 0, resetAt: currentTime + windowMs };
      attempts.set(key, entry);
    }

    entry.count += 1;
    return {
      limited: entry.count > limit,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1_000)),
    };
  };
}
