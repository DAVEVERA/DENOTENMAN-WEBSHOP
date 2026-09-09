import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/pbkdf2-password";

const target = new URL(process.env.DATABASE_URL ?? "");
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.port !== '55435' || target.pathname !== '/notenman_release_qa') {
  throw new Error('Synthetic fixtures may only be created in the isolated local release QA database.');
}
const prisma = new PrismaClient();
async function main() {
  const admin = await prisma.adminUser.upsert({ where: { username: 'release-qa' }, update: {}, create: {
    id: 'release-qa-admin', username: 'release-qa', name: 'Lokale testbeheerder', role: 'OWNER',
    passwordHash: await hashPassword('local-only-release-qa'),
  } });
  const category = await prisma.category.upsert({ where: { slug: 'noten' }, update: {}, create: {
    slug: 'noten', translations: { create: ['nl', 'en', 'fr'].map(locale => ({ locale: locale as 'nl' | 'en' | 'fr', slug: 'noten', name: 'Testnoten' })) },
  } });
  for (const [index, name] of ['QA amandelen', 'QA cashewnoten'].entries()) {
    const slug = `release-qa-noten-${index + 1}`;
    await prisma.product.upsert({ where: { slug }, update: {}, create: {
      id: slug, slug, sku: slug, basePriceCents: 500,
      translations: { create: ['nl', 'en', 'fr'].map(locale => ({ locale: locale as 'nl' | 'en' | 'fr', slug, name,
        description: 'Synthetisch testproduct, niet te koop.', shortDescription: 'Alleen voor lokale controle.' })) },
      productCategories: { create: { categoryId: category.id, isPrimary: true } },
      attributes: { create: index === 0 ? [
        { key: 'ingredients', value: '100% amandelen (synthetische testtekst)' },
        { key: 'allergens', value: 'Noten' },
      ] : [] },
      variants: { create: { id: `${slug}-variant`, sku: `${slug}-500`, priceCents: 500, stock: 100, weightGrams: 500, preparation: 'RAW', salting: 'UNSALTED',
        translations: { create: ['nl', 'en', 'fr'].map(locale => ({ locale: locale as 'nl' | 'en' | 'fr', label: '500 gram' })) } } },
    } });
  }
  const account = await prisma.businessAccount.upsert({ where: { id: 'release-qa-business' }, update: { deletedAt: null }, create: {
    id: 'release-qa-business', companyName: 'Synthetisch testbedrijf', contactName: 'Testklant', email: 'release-qa@example.invalid', status: 'APPROVED',
    passwordHash: await hashPassword('local-only-release-qa'),
  } });
  await prisma.businessOrderList.upsert({ where: { id: 'release-qa-list' }, update: {}, create: {
    id: 'release-qa-list', businessAccountId: account.id, createdByAdminId: admin.id, title: 'Vaste testbestellijst', status: 'SENT', totalCents: 1000,
    items: { create: [
      { id: 'release-qa-line-1', productName: 'QA amandelen', variantLabel: '500 gram', quantity: 2, unitPriceCents: 500, productVariantId: 'release-qa-noten-1-variant' },
      { id: 'release-qa-line-2', productName: 'QA cashewnoten', variantLabel: '500 gram', quantity: 0, unitPriceCents: 500, sortOrder: 1, productVariantId: 'release-qa-noten-2-variant' },
    ] },
  } });
  console.log('Synthetic QA fixtures ready: 2 products, 1 admin, 1 business account and 1 reusable list. No external provider called.');
}
main().finally(() => prisma.$disconnect());
