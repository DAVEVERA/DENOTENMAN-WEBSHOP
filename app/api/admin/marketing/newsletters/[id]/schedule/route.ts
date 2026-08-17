import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { mailchimpErrorResponse } from "@/lib/mailchimp/admin-response";
import { scheduleNewsletter } from "@/lib/mailchimp/newsletter";
import { newsletterScheduleSchema } from "@/lib/mailchimp/schemas";
import { updateNewsletterShadowStatus } from "@/lib/mailchimp/shadow";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession(request))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const parsed = newsletterScheduleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;
  try {
    await scheduleNewsletter(id, parsed.data.scheduleTime);
    await updateNewsletterShadowStatus(id, "SCHEDULED", new Date(parsed.data.scheduleTime));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mailchimpErrorResponse(error);
  }
}
