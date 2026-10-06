import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { mailchimpErrorResponse } from "@/lib/mailchimp/admin-response";
import { syncContactTags } from "@/lib/marketing/contacts.server";

export const runtime = "nodejs";

// Brings the "Land NL", "Land BE" and "Zakelijk" tags in Mailchimp in line with the shop's data.
export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    return NextResponse.json(await syncContactTags());
  } catch (error) {
    return mailchimpErrorResponse(error);
  }
}
