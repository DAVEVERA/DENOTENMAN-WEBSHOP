import "server-only";

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
  init: { method: "GET" | "POST"; form?: Record<string, string>; idempotencyKey?: string },
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

export async function createStripeCheckoutSession(input: {
  secretKey: string;
  invoiceId: string;
  invoiceNumber: string;
  title: string;
  totalCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}, fetchImpl?: StripeFetch): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>(input.secretKey, "/checkout/sessions", {
    method: "POST",
    // One session per invoice and amount per day: a double click reuses the same session.
    idempotencyKey: `developer-invoice-${input.invoiceId}-${input.totalCents}-${new Date().toISOString().slice(0, 10)}`,
    form: {
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": input.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(input.totalCents),
      "line_items[0][price_data][product_data][name]": `Factuur ${input.invoiceNumber}`,
      "line_items[0][price_data][product_data][description]": input.title.slice(0, 250),
      client_reference_id: input.invoiceId,
      "metadata[developer_invoice_id]": input.invoiceId,
      "metadata[invoice_number]": input.invoiceNumber,
      "payment_intent_data[description]": `Factuur ${input.invoiceNumber}`,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
    },
  }, fetchImpl);
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
