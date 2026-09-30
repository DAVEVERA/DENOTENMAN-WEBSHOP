import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { mailchimpErrorResponse } from "@/lib/mailchimp/admin-response";
import {
  createNewsletterCampaign,
  getAudienceRecipientCount,
  listNewsletterCampaigns,
  newsletterHtml,
} from "@/lib/mailchimp/newsletter";
import { extractNewsletterContent } from "@/lib/mailchimp/template";
import { saveNewsletterDocument } from "@/lib/newsletter/store";
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
    // With blocks, the stored content is what the server renders, never the client's HTML.
    const input = parsed.data.document ? { ...parsed.data, contentHtml: extractNewsletterContent(newsletterHtml(parsed.data)) } : parsed.data;
    const campaign = await createNewsletterCampaign(input);
    if (input.document) await saveNewsletterDocument(campaign.id, input.document);
    await recordNewsletterShadow(admin, campaign, input, "CREATE");
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return mailchimpErrorResponse(error);
  }
}
