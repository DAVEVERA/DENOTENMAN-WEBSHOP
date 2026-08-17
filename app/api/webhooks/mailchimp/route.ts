import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  applyMailchimpWebhook,
  parseMailchimpWebhook,
  verifyMailchimpWebhookSignature,
} from "@/lib/mailchimp/webhook";

export const runtime = "nodejs";

const READY_MESSAGE = "Mailchimp webhook callback ready";
const RETRY_HEADERS = { "Retry-After": "300" };

export function GET() {
  return new NextResponse(READY_MESSAGE, { status: 200 });
}

export function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (rawBody.trim().length === 0) {
    return new NextResponse(READY_MESSAGE, { status: 200 });
  }

  const secret = process.env.MAILCHIMP_WEBHOOK_SECRET?.trim();
  if (!secret || secret.length < 24) {
    return NextResponse.json(
      { error: "WEBHOOK_NOT_CONFIGURED" },
      { status: 503, headers: RETRY_HEADERS }
    );
  }

  if (
    !verifyMailchimpWebhookSignature({
      rawBody,
      signatureHeader: request.headers.get("x-mailchimp-signature"),
      secret,
    })
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const formData = new FormData();
  for (const [key, value] of new URLSearchParams(rawBody)) {
    formData.append(key, value);
  }
  const event = parseMailchimpWebhook(formData);
  if (!event) {
    return NextResponse.json({ error: "INVALID_WEBHOOK" }, { status: 400 });
  }

  await applyMailchimpWebhook(event);
  return new NextResponse("OK", { status: 200 });
}
