import assert from "node:assert/strict";
import test from "node:test";
import {
  createNewsletterRateLimiter,
  newsletterSignupInputSchema,
  pendingNewsletterConsentData,
  submitNewsletterSignup,
} from "../lib/newsletter-signup";

test("newsletter signup requires explicit consent and accepts only the public contract", () => {
  assert.equal(
    newsletterSignupInputSchema.safeParse({
      email: "person@example.com",
      locale: "nl",
      consent: true,
      website: "",
    }).success,
    true
  );
  assert.equal(
    newsletterSignupInputSchema.safeParse({ email: "person@example.com", locale: "nl" }).success,
    false
  );
  assert.equal(
    newsletterSignupInputSchema.safeParse({
      email: "person@example.com",
      locale: "nl",
      consent: true,
      tags: ["admin-selected-tag"],
    }).success,
    false
  );
});

test("newsletter signup normalizes email and persists only after Mailchimp accepted pending", async () => {
  const calls: string[] = [];
  const observed: Array<{ email: string; locale: string; ipAddress?: string }> = [];

  await submitNewsletterSignup(
    { email: " Person@Example.COM ", locale: "fr", consent: true, website: "" },
    "192.0.2.10",
    {
      async getExistingConsentStatus() {
        calls.push("lookup");
        return null;
      },
      async addPendingMailchimpMember(signup) {
        calls.push("mailchimp");
        observed.push(signup);
      },
      async savePendingConsent(signup) {
        calls.push("local");
        observed.push(signup);
      },
    }
  );

  assert.deepEqual(calls, ["lookup", "mailchimp", "local"]);
  assert.deepEqual(observed, [
    { email: "person@example.com", locale: "fr", ipAddress: "192.0.2.10" },
    { email: "person@example.com", locale: "fr", ipAddress: "192.0.2.10" },
  ]);
});

test("newsletter signup does not persist a pending record when Mailchimp rejects the request", async () => {
  let saved = false;
  await assert.rejects(
    submitNewsletterSignup(
      { email: "person@example.com", locale: "nl", consent: true, website: "" },
      undefined,
      {
        async getExistingConsentStatus() {
          return null;
        },
        async addPendingMailchimpMember() {
          throw new Error("provider unavailable");
        },
        async savePendingConsent() {
          saved = true;
        },
      }
    )
  );
  assert.equal(saved, false);
});

test("newsletter signup leaves an existing subscribed consent untouched", async () => {
  const calls: string[] = [];

  await submitNewsletterSignup(
    { email: "member@example.com", locale: "nl", consent: true, website: "" },
    "192.0.2.11",
    {
      async getExistingConsentStatus() {
        calls.push("lookup");
        return "SUBSCRIBED";
      },
      async addPendingMailchimpMember() {
        calls.push("mailchimp");
      },
      async savePendingConsent() {
        calls.push("local");
      },
    }
  );

  assert.deepEqual(calls, ["lookup"]);
});

for (const existingStatus of ["UNSUBSCRIBED", "CLEANED"] as const) {
  test(`newsletter signup requests fresh confirmation for ${existingStatus.toLowerCase()} consent`, async () => {
    const calls: string[] = [];

    await submitNewsletterSignup(
      { email: "returning@example.com", locale: "fr", consent: true, website: "" },
      "192.0.2.12",
      {
        async getExistingConsentStatus() {
          calls.push("lookup");
          return existingStatus;
        },
        async addPendingMailchimpMember(_signup, observedStatus) {
          calls.push("mailchimp");
          assert.equal(observedStatus, existingStatus);
        },
        async savePendingConsent() {
          calls.push("local");
        },
      }
    );

    assert.deepEqual(calls, ["lookup", "mailchimp", "local"]);
  });
}

test("pending consent data preserves historical opt-in and opt-out timestamps", () => {
  const data = pendingNewsletterConsentData({
    email: "returning@example.com",
    locale: "en",
    ipAddress: "192.0.2.13",
  });

  assert.deepEqual(data, {
    status: "PENDING",
    source: "FORM",
    locale: "en",
    optInIp: "192.0.2.13",
  });
  assert.equal("optInAt" in data, false);
  assert.equal("optOutAt" in data, false);
});

test("newsletter rate limiter resets by window and remains usable when its key cap is reached", () => {
  let time = 1_000;
  const rateLimit = createNewsletterRateLimiter({
    limit: 2,
    windowMs: 1_000,
    maxKeys: 2,
    now: () => time,
  });

  assert.equal(rateLimit("first").limited, false);
  assert.equal(rateLimit("first").limited, false);
  assert.equal(rateLimit("first").limited, true);
  assert.equal(rateLimit("second").limited, false);
  assert.equal(rateLimit("third").limited, false);

  time = 2_001;
  assert.deepEqual(rateLimit("first"), { limited: false, retryAfterSeconds: 1 });
});
