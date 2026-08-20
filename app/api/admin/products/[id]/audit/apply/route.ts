import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasAdminSession } from "@/lib/admin-api-auth";
import {
  AuditConflictError,
  auditApplicationSchema,
  prepareAuditProposalApplication,
} from "@/lib/product-audit-core";
import { buildProductAudit, buildProductRevalidationPath, loadProductAuditSnapshot } from "@/lib/product-audit";
import { prisma } from "@/lib/prisma";
import { buildProductIndexNowUrls, scheduleIndexNowUrls } from "@/lib/indexnow";
import { BASE_URL } from "@/lib/routes";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const parsed = auditApplicationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const snapshot = await loadProductAuditSnapshot(id);
    if (!snapshot) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const application = prepareAuditProposalApplication(snapshot, parsed.data);

    await prisma.$transaction([
      ...application.updates.map((update) => prisma.productTranslation.update({
          where: { productId_locale: { productId: id, locale: update.locale } },
          data: {
            shortDescription: update.shortDescription,
            shortDescriptionHtml: update.shortDescriptionHtml,
            description: update.description,
            descriptionHtml: update.descriptionHtml,
            seoTitle: update.seoTitle,
            metaDescription: update.metaDescription,
          },
        })),
      prisma.product.update({ where: { id }, data: { updatedAt: new Date() } }),
    ]);

    const indexNowContext = await prisma.product.findUnique({
      where: { id },
      select: {
        translations: { select: { locale: true, slug: true } },
        productCategories: {
          select: {
            category: {
              select: { translations: { select: { locale: true, slug: true } } },
            },
          },
        },
      },
    });
    if (indexNowContext) {
      scheduleIndexNowUrls(buildProductIndexNowUrls({
        baseUrl: BASE_URL,
        translations: indexNowContext.translations,
        categoryTranslations: indexNowContext.productCategories.flatMap(
          (assignment) => assignment.category.translations
        ),
      }));
    }

    for (const update of application.updates) {
      const slug = snapshot.translations.find((translation) => translation.locale === update.locale)?.slug;
      if (slug) revalidatePath(buildProductRevalidationPath(update.locale, slug));
    }
    revalidatePath(`/admin/producten/${id}`);
    revalidatePath(`/admin/producten/${id}/audit`);

    return NextResponse.json({ appliedLocales: application.updates.map((update) => update.locale), audit: await buildProductAudit(id) });
  } catch (error) {
    if (error instanceof AuditConflictError) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.code === "TRANSLATION_MISSING"
            ? "Deze vertaling bestaat nog niet en kan niet vanuit de audit worden aangemaakt."
            : "Het product is gewijzigd na het genereren. Voer de audit opnieuw uit voordat je toepast.",
        },
        { status: 409 }
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR", issues: error.flatten() }, { status: 400 });
    }
    console.error(`Applying product audit proposal failed for ${id}`, error);
    return NextResponse.json({ error: "APPLY_FAILED", message: "De voorstellen zijn niet toegepast." }, { status: 500 });
  }
}
