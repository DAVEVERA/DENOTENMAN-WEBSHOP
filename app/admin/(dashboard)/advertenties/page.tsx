import { prisma } from "@/lib/prisma";
import { googleAdsConfigurationState } from "@/lib/google-ads";
import { GoogleAdsEditor, GoogleAdsGroupDrafts } from "@/components/admin-panel/GoogleAdsEditor";

export default async function AdvertentiesPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product: requestedId } = await searchParams;
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ include: { translations: { where: { locale: "nl" } }, googleAdsConfiguration: true }, orderBy: { slug: "asc" } }),
    prisma.category.findMany({ where: { isActive: true }, include: { translations: { where: { locale: "nl" } } }, orderBy: { sortOrder: "asc" } }),
  ]);
  const selected = products.find((item) => item.id === requestedId) ?? products[0];
  const state = googleAdsConfigurationState();
  const categoryOptions = categories.map((item) => ({ id: item.id, name: item.translations[0]?.name })).filter((item): item is { id: string; name: string } => Boolean(item.name));
  if (!selected) return <div><h1 className="text-heading-xl">Google Ads</h1><p>Maak eerst een product aan.</p></div>;
  const name = selected.translations[0]?.name ?? selected.slug;
  const config = selected.googleAdsConfiguration;
  const defaultUrl = `https://denotenman.com/nl/producten/${selected.translations[0]?.slug ?? selected.slug}`;
  return <div className="space-y-6"><div><h1 className="text-heading-xl text-text">Google Ads</h1><p className="mt-2 max-w-3xl text-body-sm text-muted">Maak advertentieconcepten per product of productgroep. Nieuwe advertenties worden altijd gepauzeerd gepubliceerd en vragen daarna een aparte bevestiging om in te schakelen.</p></div>
    {!state.configured ? <div className="rounded-card border border-amber-300 bg-amber-50 p-4 text-body-sm text-amber-900"><strong>Externe koppeling nog niet actief.</strong> Ontbrekend: {state.missing.join(", ")}. Conceptbeheer werkt wel; publiceren en budget activeren zijn geblokkeerd.</div> : <div className="rounded-card border border-green-200 bg-green-50 p-4 text-body-sm text-green-800">Google Ads-credentials zijn aanwezig. Externe acties vragen nog steeds een bevestiging.</div>}
    <section className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6"><h2 className="text-heading-md">Kies product</h2><form method="get" action="/admin/advertenties" className="mt-3 flex flex-col gap-2 sm:flex-row"><select name="product" defaultValue={selected.id} className="min-h-12 min-w-0 flex-1 rounded-button border border-border bg-white px-3">{products.map((item) => <option key={item.id} value={item.id}>{item.translations[0]?.name ?? item.slug}</option>)}</select><button type="submit" className="min-h-12 rounded-button border border-accent px-5 font-semibold">Open product</button></form></section>
    <GoogleAdsEditor productId={selected.id} configured={state.configured} initial={{ status: config?.status ?? "DRAFT", headlines: config?.headlines.length ? config.headlines : [name.slice(0, 30), "Vers van De Notenman", "Bestel eenvoudig online"], descriptions: config?.descriptions.length ? config.descriptions : [`Ontdek ${name}. Vers verpakt en eenvoudig online besteld.`.slice(0, 90), "Bekijk het assortiment van De Notenman en bestel veilig online."], finalUrl: config?.finalUrl ?? defaultUrl, dailyBudgetMicros: config?.dailyBudgetMicros ?? 5_000_000, published: Boolean(config?.adResourceName), lastError: config?.lastError ?? null }} />
    <GoogleAdsGroupDrafts categories={categoryOptions} />
  </div>;
}
