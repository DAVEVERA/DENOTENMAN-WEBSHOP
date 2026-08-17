import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { mailchimpErrorResponse } from "@/lib/mailchimp/admin-response";
import {
  createNewsletterCampaign,
  getAudienceRecipientCount,
  listNewsletterCampaigns,
} from "@/lib/mailchimp/newsletter";
import { newsletterDraftSchema } from "@/lib/mailchimp/schemas";
import { recordNewsletterShadow } from "@/lib/mailchimp/shadow";

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const [campaigns, recipientCount] = await Promise.all([
      listNewsletterCampaigns(),
      getAudienceRecipientCount(),
    ]);
    return NextResponse.json({ ...campaigns, recipientCount });
  } catch (error) {
    return mailchimpErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = newsletterDraftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const campaign = await createNewsletterCampaign(parsed.data);
    await recordNewsletterShadow(admin, campaign, parsed.data, "CREATE");
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return mailchimpErrorResponse(error);
  }
}
