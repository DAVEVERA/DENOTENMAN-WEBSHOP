import { NextResponse, type NextRequest } from "next/server";
import { getMailchimpEnvironment } from "@/lib/env";
import { getMailchimpClient } from "@/lib/mailchimp/client";
import { runMailchimpRequest } from "@/lib/mailchimp/limiter";
import { subscriberHash } from "@/lib/mailchimp/subscriberHash";
import {
  createNewsletterRateLimiter,
  newsletterSignupInputSchema,
  parseNewsletterSignupBody,
  pendingNewsletterConsentData,
  submitNewsletterSignup,
} from "@/lib/newsletter-signup";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 4_096;
const acceptedBody = { ok: true, status: "pending" } as const;
const checkNewsletterRateLimit = createNewsletterRateLimiter();

function json(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

function clientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const value = forwarded || request.headers.get("x-real-ip")?.trim();
  return value ? value.slice(0, 64) : undefined;
}

function acceptedResponse() {
  return json(acceptedBody, { status: 202 });
}

function isFormSubmission(contentType: string) {
  return contentType.toLowerCase().includes("application/x-www-form-urlencoded");
}

function formRedirect(
  request: NextRequest,
  locale: "nl" | "en" | "fr",
  status: "success" | "invalid" | "unavailable" | "rate-limited",
  retryAfterSeconds?: number,
) {
  const destination = new URL(`/${locale}`, request.url);
  destination.searchParams.set("newsletter", status);
  destination.hash = "newsletter-signup";
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "no-store");
  if (retryAfterSeconds) {
    response.headers.set("Retry-After", String(retryAfterSeconds));
  }
  return response;
}

function requestedLocale(request: NextRequest): "nl" | "en" | "fr" {
  const locale = request.nextUrl.searchParams.get("locale");
  return locale === "en" || locale === "fr" ? locale : "nl";
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const formSubmission = isFormSubmission(contentType);
  const fallbackLocale = requestedLocale(request);
  const ipAddress = clientIp(request);
  const rateLimit = checkNewsletterRateLimit(ipAddress ?? "unknown");
  if (rateLimit.limited) {
    if (formSubmission) {
      return formRedirect(
        request,
        fallbackLocale,
        "rate-limited",
        rateLimit.retryAfterSeconds,
      );
    }
    return json(
      { ok: false, error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    if (formSubmission) return formRedirect(request, fallbackLocale, "invalid");
    return json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    if (formSubmission) return formRedirect(request, fallbackLocale, "invalid");
    return json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = parseNewsletterSignupBody(rawBody, contentType);
  } catch {
    if (formSubmission) return formRedirect(request, fallbackLocale, "invalid");
    return json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
  }

  const parsed = newsletterSignupInputSchema.safeParse(body);
  if (!parsed.success) {
    if (formSubmission) return formRedirect(request, fallbackLocale, "invalid");
    return json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
  }

  // A filled honeypot gets the same response as a real request, but performs no
  // external call or database write.
  if (parsed.data.website.length > 0) {
    return formSubmission
      ? formRedirect(request, parsed.data.locale, "success")
      : acceptedResponse();
  }

  try {
    await submitNewsletterSignup(parsed.data, ipAddress, {
      async getExistingConsentStatus(email) {
        const existing = await prisma.newsletterConsent.findUnique({
          where: { email },
          select: { status: true },
        });
        return existing?.status ?? null;
      },
      async addPendingMailchimpMember(signup, existingStatus) {
        const environment = getMailchimpEnvironment();
        const shouldRequestFreshConfirmation =
          existingStatus === "UNSUBSCRIBED" || existingStatus === "CLEANED";
        await runMailchimpRequest(() =>
          getMailchimpClient().lists.setListMember(
            environment.MAILCHIMP_AUDIENCE_ID,
            subscriberHash(signup.email),
            {
              email_address: signup.email,
              status_if_new: "pending",
              ...(shouldRequestFreshConfirmation ? { status: "pending" as const } : {}),
              merge_fields: { LOCALE: signup.locale },
            }
          )
        );
      },
      async savePendingConsent(signup) {
        const data = pendingNewsletterConsentData(signup);
        await prisma.$transaction(async (transaction) => {
          const current = await transaction.newsletterConsent.findUnique({
            where: { email: signup.email },
            select: { status: true },
          });

          if (current?.status === "SUBSCRIBED") return;

          await transaction.newsletterConsent.upsert({
            where: { email: signup.email },
            create: { email: signup.email, ...data },
            update: data,
          });
        });
      },
    });
    return formSubmission
      ? formRedirect(request, parsed.data.locale, "success")
      : acceptedResponse();
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? String(error.status)
        : "unknown";
    console.error("Newsletter signup dependency failed", { status });
    if (formSubmission) {
      return formRedirect(request, parsed.data.locale, "unavailable");
    }
    return json({ ok: false, error: "TEMPORARILY_UNAVAILABLE" }, { status: 503 });
  }
}
