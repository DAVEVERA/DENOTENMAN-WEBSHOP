import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { verifyStripeSignature } from "../lib/developer-portal/stripe";

const secret = "whsec_test_secret";
const payload = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_test_1" } } });
const now = 1_790_000_000_000;
const sign = (body: string, at: number, key = secret) => `t=${at},v1=${createHmac("sha256", key).update(`${at}.${body}`).digest("hex")}`;

test("a correctly signed, recent Stripe call is accepted", () => {
  assert.equal(verifyStripeSignature(payload, sign(payload, now / 1000), secret, now), true);
  // Stripe may send several signatures while it rolls a secret.
  assert.equal(verifyStripeSignature(payload, `${sign(payload, now / 1000, "whsec_old")},v1=${sign(payload, now / 1000).split("v1=")[1]}`, secret, now), true);
});

test("forged, altered, old or unsigned calls are refused", () => {
  assert.equal(verifyStripeSignature(payload, sign(payload, now / 1000, "whsec_other"), secret, now), false);
  assert.equal(verifyStripeSignature(payload.replace("cs_test_1", "cs_test_2"), sign(payload, now / 1000), secret, now), false);
  assert.equal(verifyStripeSignature(payload, sign(payload, now / 1000 - 600), secret, now), false);
  assert.equal(verifyStripeSignature(payload, null, secret, now), false);
  assert.equal(verifyStripeSignature(payload, "t=abc,v1=zz", secret, now), false);
});
