"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import { planSafeMetadataFixes } from "@/lib/ai-vindbaarheid/metadata-fixes";
import { product as productPath } from "@/lib/routes";

export async function applySafeMetadataFixes(formData: FormData) {
  const session = await verifyAdminSessionToken(
    (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  );
  if (!session) redirect("/admin/login");
  const admin = await prisma.adminUser.findUnique({
    where: { id: session.userId },
    select: { active: true },
  });
  if (!admin?.active) redirect("/admin/login");

  const id = formData.get("product");
  if (typeof id !== "string" || !id || id.length > 128) {
    redirect("/admin/ai-vindbaarheid");
  }

  const product = await prisma.product.findFirst({
    where: { id, isActive: true },
    select: {
      id: true,
      translations: {
        select: {
          locale: true,
          name: true,
          slug: true,
          shortDescription: true,
          seoTitle: true,
          metaDescription: true,
        },
      },
    },
  });
  if (!product) redirect("/admin/ai-vindbaarheid");

  const fixes = planSafeMetadataFixes(product.translations);
  let changed = 0;
  for (const fix of fixes) {
    // Optimistic guard: only write when the value is still the one reviewed.
    const result = await prisma.productTranslation.updateMany({
      where: {
        productId: product.id,
        locale: fix.locale,
        [fix.field]: fix.expected,
      },
      data: { [fix.field]: fix.value },
    });
    changed += result.count;
  }

  if (changed) {
    for (const translation of product.translations) {
      revalidatePath(productPath(translation.locale, translation.slug));
    }
    revalidatePath(`/admin/producten/${product.id}/audit`);
  }
  revalidatePath("/admin/ai-vindbaarheid");
  redirect(`/admin/ai-vindbaarheid?product=${encodeURIComponent(product.id)}&fixed=${changed}`);
}
