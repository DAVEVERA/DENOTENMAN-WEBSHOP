import "server-only";
import type { AdminUser, NewsletterCampaignStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/admin-audit";
import type { NewsletterDetail, NewsletterDraftInput } from "@/lib/mailchimp/newsletter";

function localStatus(status: NewsletterDetail["status"]): NewsletterCampaignStatus {
  if (status === "sent" || status === "sending") return "SENT";
  if (status === "schedule") return "SCHEDULED";
  return "DRAFT";
}

export async function recordNewsletterShadow(
  admin: AdminUser,
  campaign: NewsletterDetail,
  input: NewsletterDraftInput,
  action: "CREATE" | "UPDATE"
): Promise<void> {
  try {
    await prisma.$transaction(async (transaction) => {
      const before = await transaction.newsletterCampaign.findUnique({ where: { id: campaign.id } });
      const after = await transaction.newsletterCampaign.upsert({
        where: { id: campaign.id },
        create: {
          id: campaign.id,
          subject: input.subject,
          bodyHtml: input.contentHtml,
          status: localStatus(campaign.status),
          sentAt: campaign.sendTime ? new Date(campaign.sendTime) : null,
        },
        update: {
          subject: input.subject,
          bodyHtml: input.contentHtml,
          status: localStatus(campaign.status),
          sentAt: campaign.sendTime ? new Date(campaign.sendTime) : undefined,
        },
      });
      await recordAudit(transaction, admin, "NewsletterCampaign", campaign.id, action, before, after);
    });
  } catch (error) {
    console.error(`Could not record Mailchimp campaign ${campaign.id} in the local audit log`, error);
  }
}

export async function updateNewsletterShadowStatus(
  campaignId: string,
  status: NewsletterCampaignStatus,
  date: Date
): Promise<void> {
  try {
    const existing = await prisma.newsletterCampaign.findUnique({ where: { id: campaignId } });
    if (!existing) return;
    await prisma.newsletterCampaign.update({
      where: { id: campaignId },
      data: {
        status,
        ...(status === "SENT" ? { sentAt: date } : { scheduledAt: date }),
      },
    });
  } catch (error) {
    console.error(`Could not update local Mailchimp campaign status for ${campaignId}`, error);
  }
}
