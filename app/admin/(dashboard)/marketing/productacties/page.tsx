import Link from "next/link";
import { connection } from "next/server";
import { Plus } from "lucide-react";

import { PromotionBadges } from "@/components/product/PromotionBadges";
import { isPromotionLive, ruleFromRow, type BadgeView } from "@/lib/promotions/engine";
import { prisma } from "@/lib/prisma";
import { promotionAdmin } from "./data";

const KIND_LABELS = { PRICE: "Actieprijs", VOLUME: "Stapelkorting", LOYALTY: "Vaste klantenkorting", LABEL: "Label" } as const;
const STATUS_LABELS = { DRAFT: "Concept", ACTIVE: "Actief", PAUSED: "Gepauzeerd", ARCHIVED: "Gearchiveerd" } as const;

function formatDate(date: Date | null): string {
  return date ? new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" }).format(date) : "—";
}

export default async function ProductPromotionsPage() {
  await connection();
  const { canEdit } = await promotionAdmin();
  const promotions = await prisma.promotion.findMany({ orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }] });
  const now = new Date();

  return (
    <div>
      <Link href="/admin/marketing" className="text-body-sm text-accent-hover underline underline-offset-4">← Terug naar marketing</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="text-heading-xl text-text">Productacties & labels</h1>
          <p className="mt-1 text-body-sm text-muted">Actieprijzen, stapelkorting, vaste klantenkorting en labels zoals Nieuw of Terug op voorraad. De prijs wordt bij het afrekenen altijd opnieuw op de server berekend.</p>
        </div>
        {canEdit ? (
          <Link href="/admin/marketing/productacties/nieuw" className="inline-flex min-h-11 items-center gap-2 rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast shadow-button">
            <Plus className="h-4 w-4" aria-hidden="true" />Nieuwe actie
          </Link>
        ) : null}
      </div>

      {promotions.length ? (
        <div className="mt-6 overflow-x-auto rounded-panel border border-border bg-surface">
          <table className="w-full min-w-[46rem] text-body-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-heading">Actie</th>
                <th className="px-4 py-3 font-heading">Label</th>
                <th className="px-4 py-3 font-heading">Status</th>
                <th className="px-4 py-3 font-heading">Planning</th>
                <th className="px-4 py-3 font-heading">Producten</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((promotion) => {
                const rule = ruleFromRow(promotion);
                const live = promotion.status === "ACTIVE" && isPromotionLive(rule, now);
                const badge: BadgeView = {
                  id: rule.id, kind: rule.kind, text: rule.badge.text.nl, background: rule.badge.background, color: rule.badge.color,
                  shape: rule.badge.shape, position: rule.badge.position, size: "sm",
                  percentOff: rule.kind === "PRICE" && rule.discountType === "PERCENT" && rule.badge.showPercent ? rule.discountValue : null,
                  countdownEndsAt: null, placements: { card: true, detail: true, cart: true },
                };
                const scope = promotion.scope === "ALL" ? "Alle producten" : promotion.scope === "CATEGORIES" ? `${promotion.categoryIds.length} categorie(ën)` : `${promotion.productIds.length} product(en)`;
                return (
                  <tr key={promotion.id} className="border-b border-border last:border-0 hover:bg-background">
                    <td className="px-4 py-3">
                      <Link href={`/admin/marketing/productacties/${promotion.id}`} className="font-semibold text-text underline-offset-4 hover:underline">{promotion.name}</Link>
                      <p className="text-xs text-muted">{KIND_LABELS[promotion.kind]} · prioriteit {promotion.priority}</p>
                    </td>
                    <td className="px-4 py-3"><PromotionBadges badges={[badge]} placement="detail" locale="nl" /></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${live ? "bg-green-100 text-green-800" : promotion.status === "ACTIVE" ? "bg-amber-100 text-amber-900" : "bg-background text-muted"}`}>
                        {live ? "Nu zichtbaar" : promotion.status === "ACTIVE" ? "Gepland / buiten tijdvenster" : STATUS_LABELS[promotion.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(promotion.startsAt)} → {formatDate(promotion.endsAt)}{promotion.weekdays.length ? ` · ${promotion.weekdays.length} dag(en)/week` : ""}</td>
                    <td className="px-4 py-3 text-muted">{scope}{promotion.excludedProductIds.length ? `, ${promotion.excludedProductIds.length} uitgesloten` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 rounded-panel border border-dashed border-border bg-surface p-8 text-center">
          <p className="font-heading text-heading-sm font-bold text-text">Nog geen productacties</p>
          <p className="mt-1 text-body-sm text-muted">Start met een actieprijs, stapelkorting of een label zoals &quot;Nieuw&quot;.</p>
        </div>
      )}
    </div>
  );
}
