import assert from "node:assert/strict";
import test from "node:test";
import {
  createMandrillSignature,
  parseMandrillEvents,
  recordMandrillDeliveryEvents,
  verifyMandrillSignature,
} from "../lib/aftersales/provider-events";
import { HEAD, POST } from "../app/api/webhooks/mailchimp-transactional/route";

const webhookKey = "webhook-signing-key";
const webhookUrl = "https://denotenman.com/api/webhooks/mailchimp-transactional";

test("creates and verifies the documented Mandrill HMAC-SHA1 signature", () => {
  const params = new URLSearchParams();
  params.set("z-last", "twee");
  params.set("mandrill_events", "[]");
  const signature = createMandrillSignature(webhookKey, webhookUrl, params);

  assert.equal(
    verifyMandrillSignature({ webhookKey, webhookUrl, params, signature }),
    true
  );
  assert.equal(
    verifyMandrillSignature({ webhookKey, webhookUrl, params, signature: `${signature}x` }),
    false
  );
  assert.equal(
    verifyMandrillSignature({ webhookKey, webhookUrl: `${webhookUrl}/wrong`, params, signature }),
    false
  );
});

test("maps delivery, bounce, complaint, rejection and suppression without storing recipient PII", () => {
  const { tracked, ignored } = parseMandrillEvents(JSON.stringify([
    { event: "delivered", ts: 1_718_000_000, _id: "message-1", msg: { email: "customer@example.com" } },
    { event: "hard_bounce", ts: 1_718_000_001, _id: "message-1", msg: { state: "bounced" } },
    { event: "spam", ts: 1_718_000_002, _id: "message-2" },
    { event: "reject", ts: 1_718_000_003, _id: "message-3", msg: { reject_reason: "unsigned" } },
    { event: "unsub", ts: 1_718_000_004, _id: "message-4" },
    { event: "open", ts: 1_718_000_005, _id: "message-5", ip: "192.0.2.1" },
  ]));

  assert.deepEqual(tracked.map((event) => event.type), [
    "DELIVERED",
    "BOUNCED",
    "COMPLAINED",
    "REJECTED",
    "SUPPRESSED",
  ]);
  assert.equal(ignored, 1);
  assert.equal(tracked[3]?.reasonCode, "unsigned");
  assert.equal(JSON.stringify(tracked).includes("customer@example.com"), false);
  assert.equal(JSON.stringify(tracked).includes("192.0.2.1"), false);
});

test("builds a stable event id for provider retries", () => {
  const raw = JSON.stringify([
    { event: "delivered", ts: 1_718_000_000, _id: "message-retry" },
  ]);
  const first = parseMandrillEvents(raw).tracked[0];
  const second = parseMandrillEvents(raw).tracked[0];
  assert.equal(first?.providerEventId, second?.providerEventId);
  assert.equal(first?.providerEventId.length, 64);
});

test("stores a provider event idempotently and links it by provider message id", async () => {
  const event = parseMandrillEvents(JSON.stringify([
    { event: "delivered", ts: 1_718_000_000, _id: "message-persisted" },
  ])).tracked[0];
  assert.ok(event);

  const stored = new Set<string>();
  const updates: Array<Record<string, unknown>> = [];
  const database = {
    emailDeliveryLog: {
      async findMany() {
        return [{ id: "delivery-log-1", providerMessageId: "message-persisted" }];
      },
    },
    async $transaction<T>(callback: (transaction: {
      emailDeliveryEvent: {
        createMany(args: { data: Array<Record<string, unknown>> }): Promise<{ count: number }>;
      };
      emailDeliveryLog: {
        updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
      };
    }) => Promise<T>): Promise<T> {
      return callback({
        emailDeliveryEvent: {
          async createMany({ data }) {
            let count = 0;
            for (const record of data) {
              const id = String(record.providerEventId);
              if (!stored.has(id)) {
                stored.add(id);
                count += 1;
              }
              assert.equal(record.deliveryId, "delivery-log-1");
              assert.equal("recipientEmail" in record, false);
            }
            return { count };
          },
        },
        emailDeliveryLog: {
          async updateMany(args) {
            updates.push(args);
            return { count: 1 };
          },
        },
      });
    },
  };

  assert.deepEqual(await recordMandrillDeliveryEvents([event], database), {
    recorded: 1,
    duplicates: 0,
    unmatched: 0,
  });
  assert.deepEqual(await recordMandrillDeliveryEvents([event], database), {
    recorded: 0,
    duplicates: 1,
    unmatched: 0,
  });
  assert.equal(updates.length, 2);
  assert.equal((updates[0]?.data as { status?: string }).status, "DELIVERED");
});

test("rejects an invalid signature before processing events", async () => {
  const previousKey = process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_KEY;
  const previousUrl = process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_URL;
  process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_KEY = webhookKey;
  process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_URL = webhookUrl;
  try {
    const response = await POST(new Request(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-mandrill-signature": "invalid",
      },
      body: new URLSearchParams({ mandrill_events: "[]" }),
    }));
    assert.equal(response.status, 401);
  } finally {
    if (previousKey === undefined) delete process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_KEY;
    else process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_KEY = previousKey;
    if (previousUrl === undefined) delete process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_URL;
    else process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_URL = previousUrl;
  }
});

test("acknowledges a signed empty or repeated-safe batch", async () => {
  const previousKey = process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_KEY;
  const previousUrl = process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_URL;
  process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_KEY = webhookKey;
  process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_URL = webhookUrl;
  try {
    const params = new URLSearchParams({ mandrill_events: "[]" });
    const signature = createMandrillSignature(webhookKey, webhookUrl, params);
    const response = await POST(new Request(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-mandrill-signature": signature,
      },
      body: params,
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      received: 0,
      ignored: 0,
      recorded: 0,
      duplicates: 0,
      unmatched: 0,
    });
    assert.equal(HEAD().status, 200);
  } finally {
    if (previousKey === undefined) delete process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_KEY;
    else process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_KEY = previousKey;
    if (previousUrl === undefined) delete process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_URL;
    else process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_URL = previousUrl;
  }
});
