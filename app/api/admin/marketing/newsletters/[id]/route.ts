import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/admin-audit";
import { mailchimpErrorResponse } from "@/lib/mailchimp/admin-response";
import {
  deleteNewsletterCampaign,
  getNewsletterCampaign,
  updateNewsletterCampaign,
} from "@/lib/mailchimp/newsletter";
import { newsletterDraftSchema } from "@/lib/mailchimp/schemas";
import { recordNewsletterShadow } from "@/lib/mailchimp/shadow";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await context.params;
  try {
    return NextResponse.json({ campaign: await getNewsletterCampaign(id) });
  } catch (error) {
    return mailchimpErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = newsletterDraftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await context.params;
  try {
    const existing = await getNewsletterCampaign(id);
    if (existing.status !== "save") {
      return NextResponse.json({ error: "CAMPAIGN_NOT_EDITABLE" }, { status: 409 });
    }
    const campaign = await updateNewsletterCampaign(id, parsed.data);
    await recordNewsletterShadow(admin, campaign, parsed.data, "UPDATE");
    return NextResponse.json({ campaign });
  } catch (error) {
    return mailchimpErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await context.params;
  try {
    const campaign = await getNewsletterCampaign(id);
    if (campaign.status !== "save") {
      return NextResponse.json({ error: "CAMPAIGN_NOT_DELETABLE" }, { status: 409 });
    }

    await deleteNewsletterCampaign(id);
    const existing = await prisma.newsletterCampaign.findUnique({ where: { id } });
    if (existing) {
      await prisma.$transaction(async (transaction) => {
        await transaction.newsletterCampaign.delete({ where: { id } });
        await recordAudit(
          transaction,
          admin,
          "NewsletterCampaign",
          id,
          "DELETE",
          existing,
          null
        );
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mailchimpErrorResponse(error);
  }
}
