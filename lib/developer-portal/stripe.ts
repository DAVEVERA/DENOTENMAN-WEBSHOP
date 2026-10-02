import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Minimal Stripe REST client for the developer's own Stripe account. The shop itself
// takes payments through Mollie; this key belongs to the developer and is only used
// to let De Notenman pay developer invoices.

const STRIPE_API = "https://api.stripe.com/v1";
const TIMEOUT_MS = 15_000;

export class DeveloperStripeError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 502) {
    super(message);
    this.name = "DeveloperStripeError";
  }
}

export function looksLikeStripeSecretKey(value: string): boolean {
  return /^(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}$/u.test(value.trim());
}

type StripeFetch = typeof fetch;

async function stripeRequest<T>(
  secretKey: string,
  path: string,
  init: { method: "GET" | "POST" | "DELETE"; form?: Record<string, string>; idempotencyKey?: string },
  fetchImpl: StripeFetch = fetch,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(`${STRIPE_API}${path}`, {
      method: init.method,
      headers: {
        authorization: `Bearer ${secretKey}`,
        ...(init.form ? { "content-type": "application/x-www-form-urlencoded" } : {}),
        ...(init.idempotencyKey ? { "idempotency-key": init.idempotencyKey } : {}),
      },
      body: init.form ? new URLSearchParams(init.form).toString() : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new DeveloperStripeError("STRIPE_UNAVAILABLE", "Stripe is niet bereikbaar. Probeer het later opnieuw.", 503);
  }
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  if (response.status === 401 || response.status === 403) {
    throw new DeveloperStripeError("STRIPE_KEY_REJECTED", "Stripe weigert de sleutel. Controleer de sleutel in de instellingen.", 502);
  }
  if (!response.ok) {
    throw new DeveloperStripeError("STRIPE_REJECTED", `Stripe weigerde het verzoek: ${body?.error?.message ?? response.status}.`, 502);
  }
  return body as T;
}

/** Checks that the key works and may read Checkout Sessions. */
export async function verifyStripeKey(secretKey: string, fetchImpl?: StripeFetch): Promise<void> {
  await stripeRequest(secretKey, "/checkout/sessions?limit=1", { method: "GET" }, fetchImpl);
}

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  status: "open" | "complete" | "expired";
  metadata?: Record<string, string>;
};

export type CheckoutInvoice = { id: string; number: string; title: string; totalCents: number };

/** One Checkout Session for one or more invoices, each as its own line on the Stripe page. */
export async function createStripeCheckoutSession(input: {
  secretKey: string;
  invoices: CheckoutInvoice[];
  currency: string;
  successUrl: string;
  cancelUrl: string;
}, fetchImpl?: StripeFetch): Promise<StripeCheckoutSession> {
  const ids = input.invoices.map((invoice) => invoice.id);
  const total = input.invoices.reduce((sum, invoice) => sum + invoice.totalCents, 0);
  const numbers = input.invoices.map((invoice) => invoice.number).join(", ");
  const form: Record<string, string> = {
    mode: "payment",
    client_reference_id: ids.join(",").slice(0, 200),
    // Stripe metadata values hold 500 characters: enough for about 18 invoice ids.
    "metadata[developer_invoice_ids]": ids.join(","),
    "metadata[invoice_numbers]": numbers.slice(0, 500),
    "payment_intent_data[description]": `Facturen ${numbers}`.slice(0, 1000),
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  };
  input.invoices.forEach((invoice, index) => {
    form[`line_items[${index}][quantity]`] = "1";
    form[`line_items[${index}][price_data][currency]`] = input.currency.toLowerCase();
    form[`line_items[${index}][price_data][unit_amount]`] = String(invoice.totalCents);
    form[`line_items[${index}][price_data][product_data][name]`] = `Factuur ${invoice.number}`;
    form[`line_items[${index}][price_data][product_data][description]`] = invoice.title.slice(0, 250) || `Factuur ${invoice.number}`;
  });
  return stripeRequest<StripeCheckoutSession>(input.secretKey, "/checkout/sessions", {
    method: "POST",
    // The same selection and amount on the same day reuses one session; a double click never pays twice.
    idempotencyKey: `developer-invoices-${createHash("sha256").update(ids.slice().sort().join(",")).digest("hex").slice(0, 32)}-${total}-${new Date().toISOString().slice(0, 10)}`,
    form,
  }, fetchImpl);
}

/** The invoice ids a Checkout Session pays for. */
export function sessionInvoiceIds(session: StripeCheckoutSession): string[] {
  const list = session.metadata?.developer_invoice_ids ?? session.metadata?.developer_invoice_id ?? "";
  return list.split(",").map((id) => id.trim()).filter(Boolean);
}

export async function retrieveStripeCheckoutSession(
  secretKey: string,
  sessionId: string,
  fetchImpl?: StripeFetch,
): Promise<StripeCheckoutSession> {
  if (!/^cs_(?:live|test)_[A-Za-z0-9]+$/u.test(sessionId)) {
    throw new DeveloperStripeError("STRIPE_SESSION_INVALID", "Onbekende Stripe-betaling.", 400);
  }
  return stripeRequest<StripeCheckoutSession>(secretKey, `/checkout/sessions/${sessionId}`, { method: "GET" }, fetchImpl);
}

// ---------- Webhook: Stripe reports a payment even when nobody returns to the page ----------

export const DEVELOPER_STRIPE_WEBHOOK_EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded"] as const;

type StripeWebhookEndpoint = { id: string; url: string; secret?: string };

export async function listStripeWebhookEndpoints(secretKey: string, fetchImpl?: StripeFetch): Promise<StripeWebhookEndpoint[]> {
  const body = await stripeRequest<{ data?: StripeWebhookEndpoint[] }>(secretKey, "/webhook_endpoints?limit=100", { method: "GET" }, fetchImpl);
  return body.data ?? [];
}

export async function deleteStripeWebhookEndpoint(secretKey: string, id: string, fetchImpl?: StripeFetch): Promise<void> {
  if (!/^we_[A-Za-z0-9]+$/u.test(id)) return;
  await stripeRequest(secretKey, `/webhook_endpoints/${id}`, { method: "DELETE" }, fetchImpl);
}

/** Creates the webhook; Stripe returns its signing secret only now. */
export async function createStripeWebhookEndpoint(secretKey: string, url: string, fetchImpl?: StripeFetch): Promise<{ id: string; secret: string }> {
  const form: Record<string, string> = { url, description: "De Notenman: ontwikkelaarsfacturen automatisch op betaald" };
  DEVELOPER_STRIPE_WEBHOOK_EVENTS.forEach((event, index) => { form[`enabled_events[${index}]`] = event; });
  const endpoint = await stripeRequest<StripeWebhookEndpoint>(secretKey, "/webhook_endpoints", { method: "POST", form }, fetchImpl);
  if (!endpoint.secret) throw new DeveloperStripeError("STRIPE_WEBHOOK_NO_SECRET", "Stripe gaf geen webhookgeheim terug.", 502);
  return { id: endpoint.id, secret: endpoint.secret };
}

/** Checks the Stripe-Signature header (t=…,v1=…) against the raw body, within five minutes. */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, nowMs = Date.now(), toleranceSeconds = 300): boolean {
  if (!header) return false;
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key, value]) => key === "v1" && value).map(([, value]) => value);
  if (!Number.isFinite(timestamp) || !signatures.length) return false;
  if (Math.abs(nowMs / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest();
  return signatures.some((signature) => {
    const given = Buffer.from(signature, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
