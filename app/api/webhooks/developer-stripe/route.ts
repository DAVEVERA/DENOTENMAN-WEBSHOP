import { NextResponse, type NextRequest } from "next/server";

import { handleDeveloperStripeWebhook } from "@/lib/developer-portal/service";

export const runtime = "nodejs";

/**
 * Stripe calls this when a payment for developer invoices completes. The signature is
 * checked against the stored webhook secret, and the payment itself is fetched from
 * Stripe again before any invoice is marked paid.
 */
export async function POST(request: NextRequest) {
  const payload = await request.text();
  try {
    const result = await handleDeveloperStripeWebhook(payload, request.headers.get("stripe-signature"));
    if (!result.ok) return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
    return NextResponse.json({ received: true, paid: result.paid.length });
  } catch (error) {
    // A 500 makes Stripe retry later.
    console.error("Developer invoices: Stripe webhook failed", error);
    return NextResponse.json({ error: "WEBHOOK_FAILED" }, { status: 500 });
  }
}
