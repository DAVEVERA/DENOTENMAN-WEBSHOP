"use client";

import Link from "next/link";
import { useState } from "react";
import { LoaderCircle, Plus, Tag } from "lucide-react";

import { PromotionBadges } from "@/components/product/PromotionBadges";
import type { BadgeView } from "@/lib/promotions/engine";

export type ProductPromotionToggle = {
  id: string;
  name: string;
  kindLabel: string;
  statusLabel: string;
  /** Whether this product is in the promotion right now. */
  included: boolean;
  /** How it is included, e.g. "via categorie Noten" or "alle producten". */
  reach: string;
  badge: BadgeView;
};

/** Checkboxes on a product's admin page: in which promotions and labels is this product? */
export function ProductPromotionToggles({ productId, promotions, canEdit }: { productId: string; promotions: ProductPromotionToggle[]; canEdit: boolean }) {
  const [state, setState] = useState(() => new Map(promotions.map((promotion) => [promotion.id, promotion.included])));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: string, included: boolean) {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/promotions/${id}/products`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, included }),
      });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(body.message || "Opslaan mislukt.");
      setState((current) => new Map(current).set(id, included));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Opslaan mislukt.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-6 rounded-panel border border-border bg-surface p-4 shadow-card md:p-5" aria-labelledby="product-promotions">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="product-promotions" className="flex items-center gap-2 font-heading text-heading-sm font-bold text-text"><Tag className="h-5 w-5 text-accent-ink" aria-hidden="true" />Acties en labels</h2>
        {canEdit ? (
          <Link href={`/admin/marketing/productacties/nieuw?product=${encodeURIComponent(productId)}`} className="inline-flex min-h-11 items-center gap-2 rounded-button border border-border px-3 text-body-sm font-semibold text-text">
            <Plus className="h-4 w-4" aria-hidden="true" />Nieuwe actie voor dit product
          </Link>
        ) : null}
      </div>
      {promotions.length ? (
        <ul className="mt-3 grid gap-2">
          {promotions.map((promotion) => {
            const included = state.get(promotion.id) ?? false;
            return (
              <li key={promotion.id} className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-background p-3">
                <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={included} disabled={!canEdit || busy !== null} onChange={(event) => void toggle(promotion.id, event.target.checked)} className="h-5 w-5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-body-sm font-semibold text-text">{promotion.name}</span>
                    <span className="block text-xs text-muted">{promotion.kindLabel} · {promotion.statusLabel} · {promotion.reach}</span>
                  </span>
                </label>
                {busy === promotion.id ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
                <PromotionBadges badges={[promotion.badge]} placement="detail" locale="nl" />
                <Link href={`/admin/marketing/productacties/${promotion.id}`} className="text-xs font-semibold text-accent-hover underline underline-offset-4">Bewerken</Link>
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-3 text-body-sm text-muted">Er zijn nog geen acties of labels. Maak er een aan voor dit product.</p>}
      {error ? <p role="alert" className="mt-3 text-body-sm font-semibold text-red-700">{error}</p> : null}
    </section>
  );
}
