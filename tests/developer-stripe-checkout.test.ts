import assert from "node:assert/strict";
import test from "node:test";

import { createStripeCheckoutSession, DeveloperStripeError } from "../lib/developer-portal/stripe";

const input = {
  secretKey: "rk_test_51AbCdEfGhIjKlMnOpQr",
  invoices: [{ id: "inv-1", number: "MNRV-2026-001", title: "Onderhoud", totalCents: 12_100 }],
  currency: "EUR",
  successUrl: "https://denotenman.com/admin/ontwikkelaarsfacturen?betaling=gelukt",
  cancelUrl: "https://denotenman.com/admin/ontwikkelaarsfacturen?betaling=geannuleerd",
};

function stripeStub(accepts: (methods: string[]) => boolean) {
  const calls: Array<{ methods: string[]; key: string | null }> = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    const form = new URLSearchParams(String(init?.body));
    const methods = [...form.entries()].filter(([name]) => name.startsWith("payment_method_types")).map(([, value]) => value);
    calls.push({ methods, key: new Headers(init?.headers).get("idempotency-key") });
    if (accepts(methods)) return Response.json({ id: "cs_test_ok", url: "https://checkout.stripe.com/c/pay/ok", payment_status: "unpaid", status: "open" });
    return Response.json({ error: { type: "invalid_request_error", message: "No valid payment method types for this Checkout Session." } }, { status: 400 });
  };
  return { calls, fetchImpl };
}

test("the payment page offers iDEAL only", async () => {
  const { calls, fetchImpl } = stripeStub(() => true);
  const session = await createStripeCheckoutSession(input, fetchImpl);
  assert.equal(session.id, "cs_test_ok");
  assert.deepEqual(calls.map((call) => call.methods), [["ideal"]]);
});

test("without iDEAL on the account Stripe's reason is shown; other errors are not retried", async () => {
  const none = stripeStub(() => false);
  await assert.rejects(createStripeCheckoutSession(input, none.fetchImpl), (error: unknown) => error instanceof DeveloperStripeError && /No valid payment method types/u.test(error.message));
  assert.equal(none.calls.length, 1);

  let calls = 0;
  const rejected: typeof fetch = async () => { calls += 1; return Response.json({ error: { message: "Invalid currency" } }, { status: 400 }); };
  await assert.rejects(createStripeCheckoutSession(input, rejected), /Invalid currency/u);
  assert.equal(calls, 1);
});

test("another return page is a new request, not a replay of the first", async () => {
  const { calls, fetchImpl } = stripeStub(() => true);
  await createStripeCheckoutSession(input, fetchImpl);
  await createStripeCheckoutSession({ ...input, successUrl: `${input.successUrl}&detail=1` }, fetchImpl);
  assert.notEqual(calls[0].key, calls[1].key);
});

test("a refusal Stripe replays from an earlier request is asked again under a fresh key", async () => {
  const keys: string[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    keys.push(new Headers(init?.headers).get("idempotency-key") ?? "");
    if (keys.length === 1) {
      return Response.json({ error: { message: "The payment method type provided: ideal is invalid." } }, { status: 400, headers: { "idempotent-replayed": "true" } });
    }
    return Response.json({ id: "cs_test_fresh", url: "https://checkout.stripe.com/c/pay/fresh", payment_status: "unpaid", status: "open" });
  };
  const session = await createStripeCheckoutSession(input, fetchImpl);
  assert.equal(session.id, "cs_test_fresh");
  assert.equal(keys.length, 2);
  assert.ok(keys[1].startsWith(`${keys[0]}-retry-`));

  let calls = 0;
  const fresh: typeof fetch = async () => { calls += 1; return Response.json({ error: { message: "The payment method type provided: ideal is invalid." } }, { status: 400 }); };
  await assert.rejects(createStripeCheckoutSession(input, fresh), /ideal is invalid/u);
  assert.equal(calls, 1, "a fresh refusal is not asked again");
});
