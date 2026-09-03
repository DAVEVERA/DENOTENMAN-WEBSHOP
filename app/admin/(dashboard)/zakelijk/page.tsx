import Link from "next/link";
import type { BusinessAccountStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/cn";
import { Bell, Building2, Plus } from "lucide-react";
import { MarkBusinessEventsReadButton } from "./BusinessEventInbox";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";

const VALID_STATUSES = new Set<string>(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]);

const STATUS_TABS: { label: string; status: BusinessAccountStatus | null }[] = [
  { label: "Alle", status: null },
  { label: "In afwachting", status: "PENDING" },
  { label: "Goedgekeurd", status: "APPROVED" },
  { label: "Afgewezen", status: "REJECTED" },
  { label: "Geschorst", status: "SUSPENDED" },
];

const STATUS_LABELS: Record<BusinessAccountStatus, string> = {
  PENDING: "In afwachting",
  APPROVED: "Goedgekeurd",
  REJECTED: "Afgewezen",
  SUSPENDED: "Geschorst",
};

const STATUS_BADGE_CLASSES: Record<BusinessAccountStatus, string> = {
  PENDING: "bg-border text-muted",
  APPROVED: "bg-accent/10 text-accent-hover",
  REJECTED: "bg-red-50 text-red-700",
  SUSPENDED: "bg-violet-50 text-violet-800",
};

export default async function ZakelijkPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const session = await verifyAdminSessionToken((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");
  const activeStatus =
    status && VALID_STATUSES.has(status) ? (status as BusinessAccountStatus) : null;

  const [businessAccounts, unreadEvents, recentEvents, unreadCount] = await Promise.all([
    prisma.businessAccount.findMany({
      where: { deletedAt: null, ...(activeStatus ? { status: activeStatus } : {}) },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orderLists: true } } },
    }),
    prisma.businessEvent.findMany({
      where: { actorType: "CUSTOMER", reads: { none: { adminUserId: session.userId } } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        businessAccount: { select: { companyName: true } },
        reads: { where: { adminUserId: session.userId }, select: { readAt: true } },
      },
    }),
    prisma.businessEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        businessAccount: { select: { companyName: true } },
        reads: { where: { adminUserId: session.userId }, select: { readAt: true } },
      },
    }),
    prisma.businessEvent.count({
      where: { actorType: "CUSTOMER", reads: { none: { adminUserId: session.userId } } },
    }),
  ]);
  const visibleEvents = [...unreadEvents, ...recentEvents.filter((event) => !unreadEvents.some((unread) => unread.id === event.id))].slice(0, 16);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-xl text-text">Zakelijk</h1>
          <p className="mt-1 text-body-sm text-muted">
            {businessAccounts.length} {businessAccounts.length === 1 ? "zakelijk account" : "zakelijke accounts"}
          </p>
        </div>
        <Link href="/admin/zakelijk/nieuw" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-accent px-5 font-heading font-bold text-contrast shadow-button sm:w-auto">
          <Plus className="h-5 w-5" aria-hidden="true" /> Nieuw zakelijk account
        </Link>
      </div>

      <section id="meldingen" className={cn("mt-6 rounded-panel border p-4 sm:p-5", unreadCount > 0 ? "border-accent bg-[#FFF9DA]" : "border-border bg-surface")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent text-contrast"><Bell className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <h2 className="font-heading text-heading-sm text-text">Zakelijke meldingen</h2>
              <p className="text-body-sm text-muted">{unreadCount === 0 ? "Alles is bekeken" : `${unreadCount} ongelezen ${unreadCount === 1 ? "gebeurtenis" : "gebeurtenissen"}`}</p>
            </div>
          </div>
          <MarkBusinessEventsReadButton
            unreadCount={unreadCount}
            eventIds={unreadEvents.map((event) => event.id)}
          />
        </div>
        {visibleEvents.length > 0 ? (
          <ol className="mt-4 grid gap-2">
            {visibleEvents.map((event) => (
              <li key={event.id} className={cn("rounded-card border px-4 py-3 text-body-sm", event.actorType !== "CUSTOMER" || event.reads.length > 0 ? "border-border bg-surface" : "border-accent/60 bg-surface")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><span className="font-semibold text-text">{event.businessAccount.companyName}</span><span className="text-muted"> · {event.summary}</span></div>
                  <time className="shrink-0 text-xs text-muted" dateTime={event.createdAt.toISOString()}>{formatEventDate(event.createdAt)}</time>
                </div>
              </li>
            ))}
          </ol>
        ) : <p className="mt-4 text-body-sm text-muted">Nog geen zakelijke gebeurtenissen.</p>}
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const href = tab.status ? `/admin/zakelijk?status=${tab.status}` : "/admin/zakelijk";
          const active = tab.status === activeStatus;
          return (
            <Link
              key={tab.label}
              href={href}
              className={cn(
                "rounded-button border border-border px-3 py-2 font-heading text-body-sm font-semibold transition-colors duration-hover-fast",
                active
                  ? "border-accent bg-accent text-contrast"
                  : "bg-surface text-text hover:border-border-hover"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {businessAccounts.length === 0 ? (
        <p className="mt-6 text-body-sm text-muted">Geen zakelijke accounts gevonden.</p>
      ) : (
        <>
        <div className="mt-6 grid gap-3 md:hidden">
          {businessAccounts.map((account) => (
            <Link key={account.id} href={`/admin/zakelijk/${account.id}`} className="rounded-panel border border-border bg-surface p-4 shadow-card">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background text-accent-ink"><Building2 className="h-5 w-5" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="font-heading text-heading-sm text-text">{account.companyName}</h2><span className={cn("rounded-button px-2 py-1 text-xs font-semibold", STATUS_BADGE_CLASSES[account.status])}>{STATUS_LABELS[account.status]}</span></div>
                  {account.customerNumber ? <p className="mt-0.5 text-xs font-semibold text-muted">Klantnr. {account.customerNumber}</p> : null}
                  <p className="mt-1 break-words text-body-sm text-muted">{account.contactName} · {account.email}</p>
                  <p className="mt-3 text-xs font-semibold text-text">{account._count.orderLists} {account._count.orderLists === 1 ? "bestellijst" : "bestellijsten"}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-6 hidden overflow-x-auto rounded-panel border border-border bg-surface md:block">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-heading">Klantnr.</th>
                <th className="px-4 py-3 font-heading">Bedrijf</th>
                <th className="px-4 py-3 font-heading">Contactpersoon</th>
                <th className="px-4 py-3 font-heading">E-mail</th>
                <th className="px-4 py-3 font-heading">Status</th>
                <th className="px-4 py-3 text-right font-heading">Bestellijsten</th>
              </tr>
            </thead>
            <tbody>
              {businessAccounts.map((account) => (
                <tr key={account.id} className="border-b border-border last:border-0 hover:bg-background">
                  <td className="px-4 py-3 text-muted">{account.customerNumber ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/zakelijk/${account.id}`}
                      className="font-semibold text-accent-hover underline underline-offset-4"
                    >
                      {account.companyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text">{account.contactName}</td>
                  <td className="px-4 py-3 text-muted">{account.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-button px-2 py-1 text-xs font-semibold",
                        STATUS_BADGE_CLASSES[account.status]
                      )}
                    >
                      {STATUS_LABELS[account.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-text">{account._count.orderLists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}

function formatEventDate(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}
