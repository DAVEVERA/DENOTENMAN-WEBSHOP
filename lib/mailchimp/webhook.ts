import { createHmac, timingSafeEqual } from "node:crypto";
import type { Locale, NewsletterConsentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isLocale } from "@/lib/i18n";
import { normalizeSubscriberEmail } from "@/lib/mailchimp/subscriberHash";

export type MailchimpWebhookEvent =
  | {
      type: "subscribe" | "unsubscribe" | "cleaned" | "profile";
      email: string;
      firstName?: string;
      lastName?: string;
      locale?: Locale;
    }
  | {
      type: "upemail";
      oldEmail: string;
      newEmail: string;
    };

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

const SIGNATURE_TOLERANCE_SECONDS = 300;

type VerifyMailchimpWebhookSignatureInput = {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  nowSeconds?: number;
};

function signatureParts(header: string): { timestamp: number; signature: string } | null {
  const parts = new Map(
    header.split(",").map((part) => {
      const separator = part.indexOf("=");
      return separator === -1
        ? [part.trim(), ""]
        : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    })
  );
  const timestamp = Number(parts.get("t"));
  const signature = parts.get("v1");
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0 || !signature) return null;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return null;
  return { timestamp, signature: signature.toLowerCase() };
}

export function verifyMailchimpWebhookSignature({
  rawBody,
  signatureHeader,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}: VerifyMailchimpWebhookSignatureInput): boolean {
  if (!signatureHeader || secret.length === 0) return false;
  const parts = signatureParts(signatureHeader);
  if (!parts || Math.abs(nowSeconds - parts.timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${parts.timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  return constantTimeEqual(parts.signature, expected);
}

function optionalFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requiredEmail(formData: FormData, key: string): string | undefined {
  const value = optionalFormString(formData, key);
  if (!value || !/^\S+@\S+\.\S+$/.test(value)) return undefined;
  return normalizeSubscriberEmail(value);
}

export function parseMailchimpWebhook(formData: FormData): MailchimpWebhookEvent | null {
  const type = optionalFormString(formData, "type");
  if (type === "upemail") {
    const oldEmail = requiredEmail(formData, "data[old_email]");
    const newEmail = requiredEmail(formData, "data[new_email]");
    return oldEmail && newEmail ? { type, oldEmail, newEmail } : null;
  }

  if (
    type !== "subscribe" &&
    type !== "unsubscribe" &&
    type !== "cleaned" &&
    type !== "profile"
  ) {
    return null;
  }
  const email = requiredEmail(formData, "data[email]");
  if (!email) return null;

  const rawLocale = optionalFormString(formData, "data[merges][LOCALE]")?.toLowerCase();
  return {
    type,
    email,
    ...(optionalFormString(formData, "data[merges][FNAME]")
      ? { firstName: optionalFormString(formData, "data[merges][FNAME]") }
      : {}),
    ...(optionalFormString(formData, "data[merges][LNAME]")
      ? { lastName: optionalFormString(formData, "data[merges][LNAME]") }
      : {}),
    ...(rawLocale && isLocale(rawLocale) ? { locale: rawLocale } : {}),
  };
}

function profileData(event: {
  firstName?: string;
  lastName?: string;
  locale?: Locale;
}) {
  return {
    ...(event.firstName !== undefined ? { firstName: event.firstName } : {}),
    ...(event.lastName !== undefined ? { lastName: event.lastName } : {}),
    ...(event.locale !== undefined ? { locale: event.locale } : {}),
  };
}

type ConsentStatusWebhookEvent = {
  type: "subscribe" | "unsubscribe" | "cleaned";
  email: string;
  firstName?: string;
  lastName?: string;
  locale?: Locale;
};

function isConsentStatusWebhookEvent(
  event: MailchimpWebhookEvent
): event is ConsentStatusWebhookEvent {
  return event.type === "subscribe" || event.type === "unsubscribe" || event.type === "cleaned";
}

export function mailchimpConsentStatusMutation(
  event: ConsentStatusWebhookEvent,
  existing: { optInAt: Date | null; optOutAt: Date | null } | null,
  now: Date
) {
  const status: NewsletterConsentStatus =
    event.type === "subscribe"
      ? "SUBSCRIBED"
      : event.type === "cleaned"
        ? "CLEANED"
        : "UNSUBSCRIBED";

  return {
    status,
    ...(status === "SUBSCRIBED"
      ? { optInAt: existing?.optInAt ?? now, optOutAt: null }
      : { optOutAt: existing?.optOutAt ?? now }),
  };
}

async function updateEmailAddress(
  transaction: Prisma.TransactionClient,
  oldEmail: string,
  newEmail: string
): Promise<void> {
  const current = await transaction.newsletterConsent.findUnique({ where: { email: oldEmail } });
  if (!current) return;

  const destination = await transaction.newsletterConsent.findUnique({ where: { email: newEmail } });
  if (!destination) {
    await transaction.newsletterConsent.update({ where: { id: current.id }, data: { email: newEmail } });
    return;
  }

  await transaction.newsletterConsent.update({
    where: { id: destination.id },
    data: {
      firstName: destination.firstName ?? current.firstName,
      lastName: destination.lastName ?? current.lastName,
      optInAt: destination.optInAt ?? current.optInAt,
      optInIp: destination.optInIp ?? current.optInIp,
    },
  });
  await transaction.newsletterConsent.update({
    where: { id: current.id },
    data: { status: "UNSUBSCRIBED", optOutAt: current.optOutAt ?? new Date() },
  });
}

export async function applyMailchimpWebhook(event: MailchimpWebhookEvent): Promise<void> {
  if (event.type === "upemail") {
    await prisma.$transaction((transaction) =>
      updateEmailAddress(transaction, event.oldEmail, event.newEmail)
    );
    return;
  }

  if (event.type === "profile") {
    const existing = await prisma.newsletterConsent.findUnique({ where: { email: event.email } });
    if (!existing) return;
    await prisma.newsletterConsent.update({ where: { id: existing.id }, data: profileData(event) });
    return;
  }

  if (!isConsentStatusWebhookEvent(event)) return;

  const existing = await prisma.newsletterConsent.findUnique({ where: { email: event.email } });
  const now = new Date();
  const mutation = mailchimpConsentStatusMutation(event, existing, now);

  await prisma.newsletterConsent.upsert({
    where: { email: event.email },
    create: {
      email: event.email,
      firstName: event.firstName,
      lastName: event.lastName,
      ...mutation,
      source: "MAILCHIMP",
      locale: event.locale ?? "nl",
    },
    update: {
      ...mutation,
      ...(event.firstName !== undefined ? { firstName: event.firstName } : {}),
      ...(event.lastName !== undefined ? { lastName: event.lastName } : {}),
      ...(event.locale !== undefined ? { locale: event.locale } : {}),
    },
  });
}
