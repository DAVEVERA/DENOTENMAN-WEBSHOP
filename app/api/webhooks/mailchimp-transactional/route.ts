import {
  parseMandrillEvents,
  recordMandrillDeliveryEvents,
  verifyMandrillSignature,
} from "@/lib/aftersales/provider-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function HEAD(): Response {
  return new Response(null, { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
  const webhookKey = process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_KEY?.trim();
  if (!webhookKey) {
    return Response.json({ error: "Webhook signing key is niet geconfigureerd" }, { status: 503 });
  }

  const body = await request.text();
  const params = new URLSearchParams(body);
  const webhookUrl = process.env.MAILCHIMP_TRANSACTIONAL_WEBHOOK_URL?.trim() || request.url;
  const signature = request.headers.get("x-mandrill-signature");
  if (!verifyMandrillSignature({ webhookKey, webhookUrl, params, signature })) {
    return Response.json({ error: "Ongeldige webhookhandtekening" }, { status: 401 });
  }

  const rawEvents = params.get("mandrill_events");
  if (rawEvents === null) {
    return Response.json({ error: "mandrill_events ontbreekt" }, { status: 400 });
  }

  try {
    const { tracked, ignored } = parseMandrillEvents(rawEvents);
    const result = await recordMandrillDeliveryEvents(tracked);
    return Response.json({ received: tracked.length + ignored, ignored, ...result });
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && error.message.startsWith("mandrill_events"))) {
      return Response.json({ error: "Ongeldige mandrill_events payload" }, { status: 400 });
    }
    console.error("Mailchimp Transactional webhook kon niet worden verwerkt", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json({ error: "Webhook kon niet worden verwerkt" }, { status: 500 });
  }
}
