import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { mailchimpErrorResponse } from "@/lib/mailchimp/admin-response";
import { sendNewsletterTest } from "@/lib/mailchimp/newsletter";
import { newsletterTestSchema } from "@/lib/mailchimp/schemas";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession(request))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const parsed = newsletterTestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }

  const { id } = await params;
  try {
    await sendNewsletterTest(id, parsed.data.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mailchimpErrorResponse(error);
  }
}
