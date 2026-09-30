import { after, connection } from "next/server";

import { MarketingCalendar, type OtherCalendarEvent } from "@/components/admin-panel/social/MarketingCalendar";
import { listNewsletterCampaigns } from "@/lib/mailchimp/newsletter";
import {
  bannerCalendarEvents,
  campaignCalendarEvents,
  newsletterCalendarEvents,
  type MarketingCalendarEvent,
} from "@/lib/marketing-calendar";
import { requireAdminPage } from "@/lib/developer-portal/page-auth";
import { prisma } from "@/lib/prisma";
import { listSocialAccounts, listSocialCampaigns, listSocialPosts, processDueSocialPosts } from "@/lib/social/service";

function parseMonth(value: string | undefined): { year: number; month: number } {
  if (value && /^\d{4}-\d{2}$/u.test(value)) {
    const [year, month] = value.split("-").map(Number);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) return { year, month: month - 1 };
  }
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
  return { year: now.getFullYear(), month: now.getMonth() };
}

function toOther(events: MarketingCalendarEvent[]): OtherCalendarEvent[] {
  return events.map((event) => ({ id: event.id, type: event.type, label: event.label, title: event.title, at: event.date.toISOString(), href: event.href }));
}

export default async function MarketingCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await connection();
  const { adminUserId } = await requireAdminPage();
  const { month: monthValue } = await searchParams;
  const { year, month } = parseMonth(monthValue);
  // A week of margin on both sides covers the neighbouring days shown in the grid, in any time zone.
  const from = new Date(Date.UTC(year, month, 1) - 8 * 86_400_000);
  const to = new Date(Date.UTC(year, month + 1, 1) + 8 * 86_400_000);

  const [admin, posts, accounts, campaigns, discountCampaigns, banners] = await Promise.all([
    prisma.adminUser.findUnique({ where: { id: adminUserId }, select: { role: true } }),
    listSocialPosts({ from, to }),
    listSocialAccounts(),
    listSocialCampaigns(),
    prisma.marketingCampaign.findMany({ select: { id: true, title: true, startsAt: true, endsAt: true } }),
    prisma.marketingBanner.findMany({ select: { id: true, title: true, startsAt: true, endsAt: true } }),
  ]);

  let newsletterEvents: MarketingCalendarEvent[] = [];
  let newslettersUnavailable = false;
  try {
    const { drafts, sent } = await listNewsletterCampaigns();
    newsletterEvents = newsletterCalendarEvents([...drafts, ...sent]);
  } catch {
    newslettersUnavailable = true;
  }

  // Safety net next to the scheduler: publishes quick posts whose time has passed.
  after(() => processDueSocialPosts(undefined, 60_000, { skipVideo: true }).catch((error) => console.error("Social scheduler (calendar) failed", error)));

  const otherEvents = toOther([...campaignCalendarEvents(discountCampaigns), ...bannerCalendarEvents(banners), ...newsletterEvents])
    .filter((event) => event.at >= from.toISOString() && event.at < to.toISOString());

  return (
    <MarketingCalendar
      key={`${year}-${month}`}
      year={year}
      month={month}
      initialPosts={posts}
      accounts={accounts}
      initialCampaigns={campaigns}
      otherEvents={otherEvents}
      canWrite={admin?.role === "OWNER" || admin?.role === "ADMIN"}
      newslettersUnavailable={newslettersUnavailable}
    />
  );
}
