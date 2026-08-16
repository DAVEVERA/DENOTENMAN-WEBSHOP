import Link from "next/link";
import type { BusinessAccountStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/cn";

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
  const activeStatus =
    status && VALID_STATUSES.has(status) ? (status as BusinessAccountStatus) : null;

  const businessAccounts = await prisma.businessAccount.findMany({
    where: activeStatus ? { status: activeStatus } : undefined,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { quotes: true } } },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-xl text-text">Zakelijk</h1>
          <p className="mt-1 text-body-sm text-muted">
            {businessAccounts.length} {businessAccounts.length === 1 ? "zakelijk account" : "zakelijke accounts"}
          </p>
        </div>
      </div>

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
        <div className="mt-6 overflow-x-auto rounded-panel border border-border bg-surface">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-heading">Bedrijf</th>
                <th className="px-4 py-3 font-heading">Contactpersoon</th>
                <th className="px-4 py-3 font-heading">E-mail</th>
                <th className="px-4 py-3 font-heading">Status</th>
                <th className="px-4 py-3 font-heading">Prijstier</th>
                <th className="px-4 py-3 text-right font-heading">Offertes</th>
              </tr>
            </thead>
            <tbody>
              {businessAccounts.map((account) => (
                <tr key={account.id} className="border-b border-border last:border-0 hover:bg-background">
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
                  <td className="px-4 py-3 text-text">{account.priceTier}</td>
                  <td className="px-4 py-3 text-right text-text">{account._count.quotes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
