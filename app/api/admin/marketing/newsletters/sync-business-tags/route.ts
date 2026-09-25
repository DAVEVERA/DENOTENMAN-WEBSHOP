import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { mailchimpErrorResponse } from "@/lib/mailchimp/admin-response";
import { syncBusinessNewsletterTags } from "@/lib/mailchimp/business-segment";

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const result = await syncBusinessNewsletterTags();
    return NextResponse.json(result);
  } catch (error) {
    return mailchimpErrorResponse(error);
  }
}
