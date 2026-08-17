import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMailchimpEnvironment } from "@/lib/env";
import {
  applyMailchimpWebhook,
  parseMailchimpWebhook,
  verifyMailchimpWebhookSecret,
} from "@/lib/mailchimp/webhook";

export const runtime = "nodejs";

function isVerified(request: NextRequest): boolean {
  return verifyMailchimpWebhookSecret(
    request.url,
    getMailchimpEnvironment().MAILCHIMP_WEBHOOK_SECRET
  );
}

export async function GET(request: NextRequest) {
  return isVerified(request)
    ? new NextResponse("Mailchimp webhook ready", { status: 200 })
    : new NextResponse("Unauthorized", { status: 401 });
}

export async function POST(request: NextRequest) {
  if (!isVerified(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const event = parseMailchimpWebhook(await request.formData());
  if (!event) {
    return NextResponse.json({ error: "INVALID_WEBHOOK" }, { status: 400 });
  }

  await applyMailchimpWebhook(event);
  return new NextResponse("OK", { status: 200 });
}
