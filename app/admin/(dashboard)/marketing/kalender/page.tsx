import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { listNewsletterCampaigns } from "@/lib/mailchimp/newsletter";
import {
  bannerCalendarEvents,
  buildMonthGrid,
  campaignCalendarEvents,
  newsletterCalendarEvents,
  type MarketingCalendarEvent,
} from "@/lib/marketing-calendar";

const TYPE_LABELS: Record<MarketingCalendarEvent["type"], string> = {
  actie: "Actie",
  banner: "Banner",
  nieuwsbrief: "Nieuwsbrief",
};

const TYPE_STYLES: Record<MarketingCalendarEvent["type"], string> = {
  actie: "bg-accent/15 text-accent-hover",
  banner: "bg-blue-100 text-blue-800",
  nieuwsbrief: "bg-purple-100 text-purple-800",
};

const WEEKDAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

const MONTH_FORMATTER = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" });

function parseMonth(value: string | undefined): Date {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    if (year && month >= 1 && month <= 12) return new Date(year, month - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function monthParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export default async function MarketingCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await connection();
  const { month } = await searchParams;
  const monthDate = parseMonth(month);

  const [campaigns, banners] = await Promise.all([
    prisma.marketingCampaign.findMany({
      select: { id: true, title: true, startsAt: true, endsAt: true },
    }),
    prisma.marketingBanner.findMany({
      select: { id: true, title: true, startsAt: true, endsAt: true },
    }),
  ]);

  let newsletterEvents: MarketingCalendarEvent[] = [];
  let newslettersUnavailable = false;
  try {
    const { drafts, sent } = await listNewsletterCampaigns();
    newsletterEvents = newsletterCalendarEvents([...drafts, ...sent]);
  } catch {
    newslettersUnavailable = true;
  }

  const events = [
    ...campaignCalendarEvents(campaigns),
    ...bannerCalendarEvents(banners),
    ...newsletterEvents,
  ];
  const days = buildMonthGrid(monthDate, events);

  return (
    <div>
      <Link href="/admin/marketing" className="text-body-sm text-accent-hover underline underline-offset-4">
        ← Terug naar marketing
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-xl text-text">Marketingkalender</h1>
          <p className="mt-1 text-body-sm text-muted">
            Acties, banners en nieuwsbrieven in één maandoverzicht.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/marketing/kalender?month=${monthParam(addMonths(monthDate, -1))}`}
            className="inline-flex min-h-9 items-center rounded-button border border-border bg-background px-3 text-body-sm font-semibold"
            aria-label="Vorige maand"
          >
            ←
          </Link>
          <p className="font-heading text-body-sm font-semibold capitalize text-text">
            {MONTH_FORMATTER.format(monthDate)}
          </p>
          <Link
            href={`/admin/marketing/kalender?month=${monthParam(addMonths(monthDate, 1))}`}
            className="inline-flex min-h-9 items-center rounded-button border border-border bg-background px-3 text-body-sm font-semibold"
            aria-label="Volgende maand"
          >
            →
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-muted">
        {(Object.keys(TYPE_LABELS) as Array<MarketingCalendarEvent["type"]>).map((type) => (
          <span key={type} className={`inline-flex items-center rounded-button px-2 py-1 ${TYPE_STYLES[type]}`}>
            {TYPE_LABELS[type]}
          </span>
        ))}
      </div>

      {newslettersUnavailable ? (
        <p className="mt-4 rounded-panel border border-red-200 bg-red-50 p-3 text-body-sm text-red-800">
          Mailchimp-nieuwsbrieven konden niet worden geladen. Acties en banners worden wel getoond.
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-7 gap-px overflow-hidden rounded-panel border border-border bg-border text-body-sm">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-surface px-2 py-2 text-center text-xs font-semibold uppercase tracking-heading text-muted"
          >
            {label}
          </div>
        ))}
        {days.map((day) => (
          <div
            key={day.date.toISOString()}
            className={`min-h-[92px] bg-surface p-2 ${day.inMonth ? "" : "opacity-40"}`}
          >
            <p className="text-xs font-semibold text-muted">{day.date.getDate()}</p>
            <div className="mt-1 space-y-1">
              {day.events.slice(0, 3).map((event) => (
                <Link
                  key={event.id}
                  href={event.href}
                  title={`${TYPE_LABELS[event.type]} · ${event.label} · ${event.title}`}
                  className={`block truncate rounded-button px-1.5 py-0.5 text-xs font-semibold ${TYPE_STYLES[event.type]}`}
                >
                  {event.title}
                </Link>
              ))}
              {day.events.length > 3 ? (
                <p className="text-xs text-muted">+{day.events.length - 3} meer</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
