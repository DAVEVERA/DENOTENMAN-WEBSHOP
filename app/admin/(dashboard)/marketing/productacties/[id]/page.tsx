import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { PromotionEditor } from "@/components/admin-panel/promotions/PromotionEditor";
import { prisma } from "@/lib/prisma";
import { promotionAdmin, promotionEditorOptions, promotionToInput } from "../data";

export default async function EditProductPromotionPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const [{ canEdit }, options, promotion] = await Promise.all([
    promotionAdmin(),
    promotionEditorOptions(),
    prisma.promotion.findUnique({ where: { id } }),
  ]);
  if (!promotion) notFound();

  return (
    <div>
      <Link href="/admin/marketing/productacties" className="text-body-sm text-accent-hover underline underline-offset-4">← Terug naar productacties</Link>
      <h1 className="mt-3 break-words text-heading-xl text-text">{promotion.name}</h1>
      <div className="mt-6">
        <PromotionEditor promotionId={promotion.id} initial={promotionToInput(promotion)} products={options.products} categories={options.categories} canEdit={canEdit} />
      </div>
    </div>
  );
}
