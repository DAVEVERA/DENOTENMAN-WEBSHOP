import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { mailchimpErrorResponse } from "@/lib/mailchimp/admin-response";
import { listAudienceSegments } from "@/lib/mailchimp/newsletter";

// Saved segments and tags in the Mailchimp audience, for the "Segment of tags" choice.
export async function GET(request: NextRequest) {
  if (!(await getAdminSession(request))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    return NextResponse.json({ segments: await listAudienceSegments() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return mailchimpErrorResponse(error);
  }
}
