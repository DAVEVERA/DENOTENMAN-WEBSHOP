export type MarketingCalendarEventType = "actie" | "banner" | "nieuwsbrief";

export type MarketingCalendarEvent = {
  id: string;
  type: MarketingCalendarEventType;
  label: string;
  title: string;
  date: Date;
  href: string;
};

export type MarketingCalendarCampaignInput = {
  id: string;
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type MarketingCalendarNewsletterInput = {
  id: string;
  subject: string;
  status: "save" | "schedule" | "sending" | "sent" | "paused" | "unknown";
  sendTime: string | null;
};

export function campaignCalendarEvents(
  campaigns: MarketingCalendarCampaignInput[]
): MarketingCalendarEvent[] {
  const events: MarketingCalendarEvent[] = [];
  for (const campaign of campaigns) {
    if (campaign.startsAt) {
      events.push({
        id: `actie-${campaign.id}-start`,
        type: "actie",
        label: "Start actie",
        title: campaign.title,
        date: campaign.startsAt,
        href: "/admin/marketing/acties",
      });
    }
    if (campaign.endsAt) {
      events.push({
        id: `actie-${campaign.id}-end`,
        type: "actie",
        label: "Einde actie",
        title: campaign.title,
        date: campaign.endsAt,
        href: "/admin/marketing/acties",
      });
    }
  }
  return events;
}

export function bannerCalendarEvents(
  banners: MarketingCalendarCampaignInput[]
): MarketingCalendarEvent[] {
  const events: MarketingCalendarEvent[] = [];
  for (const banner of banners) {
    if (banner.startsAt) {
      events.push({
        id: `banner-${banner.id}-start`,
        type: "banner",
        label: "Start banner",
        title: banner.title,
        date: banner.startsAt,
        href: "/admin/marketing/banners",
      });
    }
    if (banner.endsAt) {
      events.push({
        id: `banner-${banner.id}-end`,
        type: "banner",
        label: "Einde banner",
        title: banner.title,
        date: banner.endsAt,
        href: "/admin/marketing/banners",
      });
    }
  }
  return events;
}

export function newsletterCalendarEvents(
  campaigns: MarketingCalendarNewsletterInput[]
): MarketingCalendarEvent[] {
  const events: MarketingCalendarEvent[] = [];
  for (const campaign of campaigns) {
    if (!campaign.sendTime) continue;
    events.push({
      id: `nieuwsbrief-${campaign.id}`,
      type: "nieuwsbrief",
      label: campaign.status === "sent" ? "Verzonden" : "Ingepland",
      title: campaign.subject,
      date: new Date(campaign.sendTime),
      href: `/admin/marketing/nieuwsbrieven/${campaign.id}`,
    });
  }
  return events;
}

export type CalendarDay = {
  date: Date;
  inMonth: boolean;
  events: MarketingCalendarEvent[];
};

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Builds the full set of calendar cells (including the leading/trailing days
// of neighboring months needed to complete each week) for a Monday-first
// month grid, with events grouped onto the day they fall on.
export function buildMonthGrid(monthDate: Date, events: MarketingCalendarEvent[]): CalendarDay[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  const gridStart = new Date(year, month, 1 - firstWeekday);

  const lastOfMonth = new Date(year, month + 1, 0);
  const lastWeekday = (lastOfMonth.getDay() + 6) % 7;
  const gridEnd = new Date(year, month, lastOfMonth.getDate() + (6 - lastWeekday));

  const byDay = new Map<string, MarketingCalendarEvent[]>();
  for (const event of events) {
    const key = dayKey(event.date);
    const existing = byDay.get(key);
    if (existing) existing.push(event);
    else byDay.set(key, [event]);
  }

  const days: CalendarDay[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const key = dayKey(cursor);
    days.push({
      date: new Date(cursor),
      inMonth: cursor.getMonth() === month,
      events: byDay.get(key) ?? [],
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
