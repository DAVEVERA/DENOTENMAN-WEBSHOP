import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET, HEAD, POST } from "../app/api/webhooks/mailchimp/route";

async function main(): Promise<void> {
  const originalSecret = process.env.MAILCHIMP_WEBHOOK_SECRET;
  delete process.env.MAILCHIMP_WEBHOOK_SECRET;

  try {
    assert.equal(GET().status, 200);
    assert.equal(HEAD().status, 200);

    const verification = await POST(
      new NextRequest("https://denotenman.com/api/webhooks/mailchimp", { method: "POST" })
    );
    assert.equal(verification.status, 200);

    const eventWithoutSecret = await POST(
      new NextRequest("https://denotenman.com/api/webhooks/mailchimp", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "type=unsubscribe&data%5Bemail%5D=test%40example.com",
      })
    );
    assert.equal(eventWithoutSecret.status, 503);
    assert.equal(eventWithoutSecret.headers.get("retry-after"), "300");
  } finally {
    if (originalSecret === undefined) {
      delete process.env.MAILCHIMP_WEBHOOK_SECRET;
    } else {
      process.env.MAILCHIMP_WEBHOOK_SECRET = originalSecret;
    }
  }

  console.log("Mailchimp webhook route tests passed");
}

void main();
