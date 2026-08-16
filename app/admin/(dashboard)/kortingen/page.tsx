import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatPrice } from "@/lib/format";
import { DiscountRowActions } from "./DiscountRowActions";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  ACTIVE: "Actief",
  SCHEDULED: "Ingepland",
  EXPIRED: "Verlopen",
};

function discountValueLabel(percentOff: number | null, amountOffCents: number | null): string {
  if (percentOff !== null) return `${percentOff}%`;
  if (amountOffCents !== null) return formatPrice(amountOffCents, "nl");
  return "—";
}

export default async function KortingenPage() {
  const discounts = await prisma.discount.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-xl text-text">Kortingen</h1>
          <p className="mt-1 text-body-sm text-muted">
            {discounts.length} {discounts.length === 1 ? "kortingscode" : "kortingscodes"}
          </p>
        </div>
        <Link
          href="/admin/kortingen/nieuw"
          className="inline-flex min-h-11 items-center rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast shadow-button"
        >
          Nieuwe kortingscode
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-panel border border-border bg-surface">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-heading">Code</th>
              <th className="px-4 py-3 font-heading">Titel</th>
              <th className="px-4 py-3 font-heading">Status</th>
              <th className="px-4 py-3 text-right font-heading">Korting</th>
              <th className="px-4 py-3 font-heading">Geldig</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {discounts.map((discount) => (
              <tr key={discount.id} className="border-b border-border last:border-0 hover:bg-background">
                <td className="px-4 py-3">
                  <span className="font-mono font-semibold text-text">{discount.code}</span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-text">{discount.title}</p>
                  {discount.subtitle ? (
                    <p className="mt-0.5 text-muted">{discount.subtitle}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      discount.status === "ACTIVE"
                        ? "inline-flex items-center rounded-button bg-accent/10 px-2 py-1 text-xs font-semibold text-accent-hover"
                        : "inline-flex items-center rounded-button bg-border px-2 py-1 text-xs font-semibold text-muted"
                    }
                  >
                    {STATUS_LABELS[discount.status] ?? discount.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-text">
                  {discountValueLabel(discount.percentOff, discount.amountOffCents)}
                </td>
                <td className="px-4 py-3 text-muted">
                  {discount.startsAt ? formatDate(discount.startsAt, "nl") : "—"} –{" "}
                  {discount.endsAt ? formatDate(discount.endsAt, "nl") : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <DiscountRowActions discountId={discount.id} />
                </td>
              </tr>
            ))}
            {discounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  Geen kortingscodes gevonden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
