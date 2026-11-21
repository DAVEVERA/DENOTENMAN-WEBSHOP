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
    select: { active: true, role: true },
  });
  if (!admin?.active) redirect("/admin/login");
  if (admin.role === "STAFF") redirect("/admin/ai-vindbaarheid");

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
  // Apply updates and their audit records atomically. A stale preview cannot
  // overwrite fields that changed since the product was loaded.
  const changed = await prisma.$transaction(async (tx) => {
    let count = 0;
    for (const fix of fixes) {
      const result = await tx.productTranslation.updateMany({
        where: {
          productId: product.id,
          locale: fix.locale,
          [fix.field]: fix.expected,
        },
        data: { [fix.field]: fix.value },
      });
      if (!result.count) continue;

      const translation = product.translations.find((item) => item.locale === fix.locale);
      await tx.auditLog.create({
        data: {
          adminUserId: session.userId,
          action: "UPDATE",
          entityType: "ProductTranslation",
          entityId: `${product.id}:${fix.locale}`,
          before: { [fix.field]: fix.expected },
          after: { [fix.field]: fix.value, locale: fix.locale, slug: translation?.slug },
        },
      });
      count += result.count;
    }
    return count;
  });

  if (changed) {
    for (const translation of product.translations) {
      revalidatePath(productPath(translation.locale, translation.slug));
    }
    revalidatePath(`/admin/producten/${product.id}/audit`);
  }
  revalidatePath("/admin/ai-vindbaarheid");
  redirect(`/admin/ai-vindbaarheid?product=${encodeURIComponent(product.id)}&fixed=${changed}`);
}
