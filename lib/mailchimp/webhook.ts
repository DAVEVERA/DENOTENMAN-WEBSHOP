import { timingSafeEqual } from "node:crypto";
import type { Locale, NewsletterConsentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isLocale } from "@/lib/i18n";
import { normalizeSubscriberEmail } from "@/lib/mailchimp/subscriberHash";

type MailchimpWebhookEvent =
  | {
      type: "unsubscribe" | "cleaned" | "profile";
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

export function verifyMailchimpWebhookSecret(url: string, expectedSecret: string): boolean {
  const suppliedSecret = new URL(url).searchParams.get("secret");
  return suppliedSecret !== null && constantTimeEqual(suppliedSecret, expectedSecret);
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

  if (type !== "unsubscribe" && type !== "cleaned" && type !== "profile") return null;
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

  const status: NewsletterConsentStatus =
    event.type === "cleaned" ? "CLEANED" : "UNSUBSCRIBED";
  await prisma.newsletterConsent.upsert({
    where: { email: event.email },
    create: {
      email: event.email,
      firstName: event.firstName,
      lastName: event.lastName,
      status,
      optOutAt: new Date(),
      source: "MAILCHIMP",
      locale: event.locale ?? "nl",
    },
    update: {
      status,
      optOutAt: new Date(),
      ...(event.firstName !== undefined ? { firstName: event.firstName } : {}),
      ...(event.lastName !== undefined ? { lastName: event.lastName } : {}),
      ...(event.locale !== undefined ? { locale: event.locale } : {}),
    },
  });
}
