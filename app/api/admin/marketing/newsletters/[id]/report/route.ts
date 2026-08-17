import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { mailchimpErrorResponse } from "@/lib/mailchimp/admin-response";
import { getNewsletterReport } from "@/lib/mailchimp/newsletter";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession(request))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  try {
    return NextResponse.json({ report: await getNewsletterReport(id) });
  } catch (error) {
    return mailchimpErrorResponse(error);
  }
}
