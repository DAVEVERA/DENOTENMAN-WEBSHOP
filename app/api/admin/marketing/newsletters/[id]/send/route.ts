import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { mailchimpErrorResponse } from "@/lib/mailchimp/admin-response";
import { sendNewsletter } from "@/lib/mailchimp/newsletter";
import { newsletterSendSchema } from "@/lib/mailchimp/schemas";
import { updateNewsletterShadowStatus } from "@/lib/mailchimp/shadow";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession(request))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const parsed = newsletterSendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "CONFIRMATION_REQUIRED" }, { status: 400 });
  }

  const { id } = await params;
  try {
    await sendNewsletter(id);
    await updateNewsletterShadowStatus(id, "SENT", new Date());
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mailchimpErrorResponse(error);
  }
}
