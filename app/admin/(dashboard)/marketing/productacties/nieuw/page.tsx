import Link from "next/link";
import { connection } from "next/server";

import { PromotionEditor } from "@/components/admin-panel/promotions/PromotionEditor";
import { emptyPromotionInput } from "@/lib/promotions/defaults";
import { promotionAdmin, promotionEditorOptions } from "../data";

export default async function NewProductPromotionPage({ searchParams }: { searchParams: Promise<{ product?: string; soort?: string }> }) {
  await connection();
  const [{ canEdit }, options, params] = await Promise.all([promotionAdmin(), promotionEditorOptions(), searchParams]);
  const productIds = params.product && options.products.some((product) => product.id === params.product) ? [params.product] : [];
  const kind = params.soort === "stapelkorting" ? "VOLUME" : params.soort === "label" ? "LABEL" : params.soort === "vaste-klant" ? "LOYALTY" : "PRICE";

  return (
    <div>
      <Link href="/admin/marketing/productacties" className="text-body-sm text-accent-hover underline underline-offset-4">← Terug naar productacties</Link>
      <h1 className="mt-3 text-heading-xl text-text">Nieuwe productactie</h1>
      <div className="mt-6">
        <PromotionEditor initial={emptyPromotionInput(kind, productIds)} products={options.products} categories={options.categories} canEdit={canEdit} />
      </div>
    </div>
  );
}
