import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";

// ---------------------------------------------------------------------------
// "Het Notenplan" is a fully separate Vite + Express + Google Gemini project
// that lives at components/ai-elements/het-notenplan. It is a customer-facing
// AI nut-mix configurator with its own package.json, its own dev server
// (server.ts, Express), and its own product catalog (src/data/products.ts).
// It shares no database or runtime with this Next.js app.
//
// This page does NOT run, proxy, or embed that project's server — Vite/Express
// and Next.js/Turbopack are different runtimes that would each need their own
// process and port. Doing so here would be an architecture mismatch, not an
// integration. Instead this page gives admins read-only oversight: whether the
// AI credential is configured in *this* app's environment, and a comparison
// between the Notenplan tool's hardcoded product list and the real Prisma
// catalog, so data drift between the two is visible without needing to run
// the other project.
//
// The catalog snapshot below is a manual copy of the shape/content of
// components/ai-elements/het-notenplan/src/data/products.ts (id, name,
// category) — intentionally NOT imported, since that project is not part of
// this app's build and its own imports are broken outside its Vite setup.
// Update this list by hand when that project's catalog changes.
// ---------------------------------------------------------------------------

const NOTENPLAN_ENV_VAR = "GEMINI_API_KEY";

type NotenplanCategory =
  | "vers-gebrand"
  | "rauw"
  | "mixen"
  | "zoutjes-pinda"
  | "zuidvruchten"
  | "chocolade-cadeau";

const NOTENPLAN_CATEGORY_LABELS: Record<NotenplanCategory, string> = {
  "vers-gebrand": "Vers Gebrand",
  rauw: "Rauwe Noten",
  mixen: "Luxe Mixen",
  "zoutjes-pinda": "Zoutjes & Pinda's",
  zuidvruchten: "Zuidvruchten",
  "chocolade-cadeau": "Chocolade & Cadeau",
};

type NotenplanProductSnapshot = {
  id: string;
  name: string;
  category: NotenplanCategory;
  inStock: boolean;
};

// Snapshot of components/ai-elements/het-notenplan/src/data/products.ts (20 items).
const NOTENPLAN_PRODUCTS: NotenplanProductSnapshot[] = [
  { id: "nm-001", name: "Vers Gebrande Gemengde Noten (Gezouten)", category: "vers-gebrand", inStock: true },
  { id: "nm-002", name: "Vers Gebrande Gemengde Noten (Ongezouten)", category: "vers-gebrand", inStock: true },
  { id: "nm-003", name: "Raw Luxury Nut Mix (Puur & Ongebrand)", category: "rauw", inStock: true },
  { id: "nm-004", name: "Luxe Macadamia Borrelmix", category: "mixen", inStock: true },
  { id: "nm-005", name: "Verse Cashewnoten Gebrand & Gezouten", category: "vers-gebrand", inStock: true },
  { id: "nm-006", name: "Spaanse Smokehouse Rookamandelen", category: "vers-gebrand", inStock: true },
  { id: "nm-007", name: "Koninklijke Macadamias (Vers Gebrand & Gezouten)", category: "rauw", inStock: true },
  { id: "nm-008", name: "Pistachenoten in Dop (Vers Geroosterd & Gezouten)", category: "vers-gebrand", inStock: true },
  { id: "nm-009", name: "Katjang Pedis (Krokant Gekruide Pinda's)", category: "zoutjes-pinda", inStock: true },
  { id: "nm-010", name: "Wasabi Pinda Knabbels", category: "zoutjes-pinda", inStock: true },
  { id: "nm-011", name: "Jumbo Vliespinda's Vers Gebrand in Arachide-Olie", category: "zoutjes-pinda", inStock: true },
  { id: "nm-012", name: "De Notenman Superfood Berry & Nut Mix", category: "mixen", inStock: true },
  { id: "nm-013", name: "Studentenhaver Deluxe (Met Medjoul Dadel Stukjes)", category: "zuidvruchten", inStock: true },
  { id: "nm-014", name: "Biologische Medjoul Dadels Super Giant", category: "zuidvruchten", inStock: true },
  { id: "nm-015", name: "Biologische Zonnebloem- & Pompoenpitten Mix", category: "rauw", inStock: true },
  { id: "nm-016", name: "Keto Power Notenmix (Walnoot, Macadamia, Pecan & Kokos)", category: "mixen", inStock: true },
  { id: "nm-017", name: "Ambachtelijke Pinda-Cashew Rotsjes (Puur 70%)", category: "chocolade-cadeau", inStock: true },
  { id: "nm-018", name: "Luxe Houten Cadeaubox De Notenman (4-vakken)", category: "chocolade-cadeau", inStock: true },
  { id: "nm-019", name: "Gepelde Chileense Walnoten (Halve Bolletjes Grade A)", category: "rauw", inStock: true },
  { id: "nm-020", name: "Borrelplank Rice Cracker & Nut Crunch Mix", category: "zoutjes-pinda", inStock: true },
];

// Normalize a product name to a comparable token for fuzzy name matching
// across the two catalogs (strip punctuation/parenthetical qualifiers, lowercase).
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Two names are considered a match if one normalized form contains the other,
// or they share enough significant words — good enough for a manual-review
// data-integrity hint, not meant to be exact.
function namesLikelyMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const wordsA = new Set(na.split(" ").filter((w) => w.length > 3));
  const wordsB = new Set(nb.split(" ").filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let shared = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) shared += 1;
  });
  const smaller = Math.min(wordsA.size, wordsB.size);
  return shared / smaller >= 0.6;
}

export default async function NotenplanPage() {
  const geminiConfigured = Boolean(process.env[NOTENPLAN_ENV_VAR]?.trim());

  const activeProducts = await prisma.product.findMany({
    where: { isActive: true },
    include: { translations: { where: { locale: "nl" } } },
    orderBy: { createdAt: "desc" },
  });

  const catalogEntries = activeProducts
    .map((product) => ({
      id: product.id,
      name: product.translations[0]?.name ?? null,
      basePriceCents: product.basePriceCents,
    }))
    .filter((entry): entry is { id: string; name: string; basePriceCents: number } => entry.name !== null);

  // Notenplan products with no plausible match in the real, active catalog.
  const unmatchedNotenplanProducts = NOTENPLAN_PRODUCTS.filter(
    (np) => !catalogEntries.some((real) => namesLikelyMatch(np.name, real.name))
  );

  // Active real products not represented anywhere in the Notenplan tool.
  const missedOpportunityProducts = catalogEntries.filter(
    (real) => !NOTENPLAN_PRODUCTS.some((np) => namesLikelyMatch(np.name, real.name))
  );

  const matchedCount = NOTENPLAN_PRODUCTS.length - unmatchedNotenplanProducts.length;

  const categoryCounts = NOTENPLAN_PRODUCTS.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-xl text-text">Notenplan</h1>
          <p className="mt-1 text-body-sm text-muted">
            Overzicht van de AI-notenmix-configurator voor klanten (&ldquo;Het Notenplan&rdquo;).
          </p>
        </div>
      </div>

      {/* Standalone-tool explanation */}
      <div className="mt-6 rounded-panel border border-border bg-surface p-5">
        <h2 className="font-heading text-heading-lg text-text">Losstaand tool, geen onderdeel van deze app</h2>
        <p className="mt-2 text-body-sm text-text">
          Het Notenplan is een apart gebouwde applicatie (Vite + Express + Google Gemini AI) die klanten
          via vragen over gelegenheid, budget en dieetwensen naar een AI-gegenereerd notenmix-voorstel leidt.
          De broncode staat in dit project onder{" "}
          <code className="rounded bg-background px-1.5 py-0.5 text-xs">
            components/ai-elements/het-notenplan
          </code>
          , maar het draait op een eigen server (eigen <code className="rounded bg-background px-1.5 py-0.5 text-xs">server.ts</code>,
          eigen poort, eigen build) en deelt geen database met deze Next.js-app.
        </p>
        <p className="mt-2 text-body-sm text-text">
          Deze pagina toont daarom alleen wat vanuit hier zichtbaar is: of de AI-sleutel in de omgeving van
          déze app is ingesteld, en een vergelijking tussen de productdata die het tool intern gebruikt en de
          echte productcatalogus. Om het tool zelf te beheren of te updaten (nieuwe producten, prijzen,
          teksten), pas je{" "}
          <code className="rounded bg-background px-1.5 py-0.5 text-xs">
            components/ai-elements/het-notenplan/src/data/products.ts
          </code>{" "}
          aan en deploy je dat project apart (eigen build/hosting, bijvoorbeeld op een eigen subdomein).
          Dit admin-portal start of proxyt dat proces niet.
        </p>
      </div>

      {/* Env / config status card */}
      <div className="mt-6 rounded-panel border border-border bg-surface p-5">
        <h2 className="font-heading text-heading-lg text-text">AI-configuratie</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center rounded-button px-3 py-1.5 text-body-sm font-semibold",
              geminiConfigured ? "bg-accent/10 text-accent-hover" : "bg-red-50 text-red-700"
            )}
          >
            {geminiConfigured ? "GEMINI_API_KEY ingesteld" : "GEMINI_API_KEY ontbreekt"}
          </span>
          <code className="rounded bg-background px-1.5 py-0.5 text-xs text-muted">{NOTENPLAN_ENV_VAR}</code>
        </div>
        <p className="mt-3 text-body-sm text-muted">
          {geminiConfigured
            ? "Deze omgevingsvariabele is beschikbaar in de omgeving van dit Next.js-project. Let op: het Notenplan-tool draait als losstaand proces en leest zijn eigen omgevingsvariabelen bij zijn eigen deployment — een correcte waarde hier garandeert niet dat de losstaande tool-deployment ook is voorzien van de sleutel."
            : "Deze omgevingsvariabele staat niet (of leeg) in de omgeving van dit Next.js-project. Dat is alleen relevant als je van plan bent de sleutel via dezelfde omgeving/secret-store te beheren als het losstaande Notenplan-tool; de tool zelf heeft zijn eigen .env nodig bij zijn eigen deployment."}
        </p>
        <p className="mt-2 text-body-sm text-muted">
          Zie <code className="rounded bg-background px-1.5 py-0.5 text-xs">components/ai-elements/het-notenplan/.env.example</code> voor
          de volledige lijst benodigde variabelen van het losstaande tool.
        </p>
      </div>

      {/* Product catalog preview */}
      <div className="mt-6 rounded-panel border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-heading-lg text-text">Productcatalogus in het Notenplan-tool</h2>
          <p className="text-body-sm text-muted">{NOTENPLAN_PRODUCTS.length} producten (hardcoded in het tool)</p>
        </div>
        <p className="mt-2 text-body-sm text-muted">
          Deze lijst is een momentopname van{" "}
          <code className="rounded bg-background px-1.5 py-0.5 text-xs">
            components/ai-elements/het-notenplan/src/data/products.ts
          </code>
          . Het tool leest niet uit de echte productcatalogus (Prisma) — werk deze lijst dus handmatig bij
          wanneer dat bestand wijzigt.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(categoryCounts).map(([category, count]) => (
            <span
              key={category}
              className="inline-flex items-center rounded-button border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted"
            >
              {NOTENPLAN_CATEGORY_LABELS[category as NotenplanCategory]} · {count}
            </span>
          ))}
        </div>

        <div className="mt-4 max-h-[50vh] overflow-y-auto rounded-panel border border-border">
          <table className="w-full text-body-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-heading">Naam (in Notenplan)</th>
                <th className="px-4 py-3 font-heading">Categorie</th>
                <th className="px-4 py-3 font-heading">Match in echte catalogus</th>
              </tr>
            </thead>
            <tbody>
              {NOTENPLAN_PRODUCTS.map((product) => {
                const matched = catalogEntries.some((real) => namesLikelyMatch(product.name, real.name));
                return (
                  <tr key={product.id} className="border-b border-border last:border-0 hover:bg-background">
                    <td className="px-4 py-3 text-text">{product.name}</td>
                    <td className="px-4 py-3 text-muted">{NOTENPLAN_CATEGORY_LABELS[product.category]}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-button px-2 py-1 text-xs font-semibold",
                          matched ? "bg-accent/10 text-accent-hover" : "bg-red-50 text-red-700"
                        )}
                      >
                        {matched ? "Gevonden" : "Niet gevonden"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data-integrity summary */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-panel border border-border bg-surface p-5">
          <h2 className="font-heading text-heading-lg text-text">Data-integriteit: onbekende producten</h2>
          <p className="mt-1 text-body-sm text-muted">
            {matchedCount} / {NOTENPLAN_PRODUCTS.length} Notenplan-producten hebben een waarschijnlijke match
            in de actieve productcatalogus.
          </p>
          {unmatchedNotenplanProducts.length === 0 ? (
            <p className="mt-3 text-body-sm text-text">
              Geen afwijkingen gevonden — alle Notenplan-producten lijken terug te vinden in de echte catalogus.
            </p>
          ) : (
            <>
              <p className="mt-3 text-body-sm text-text">
                Deze producten adviseert het Notenplan-tool aan klanten, maar ze zijn niet (meer) te vinden als
                actief product in de echte catalogus. Mogelijk verkeerd gespeld, uit assortiment gehaald, of
                nooit als los product aangemaakt.
              </p>
              <ul className="mt-3 space-y-2">
                {unmatchedNotenplanProducts.map((product) => (
                  <li
                    key={product.id}
                    className="rounded-button border border-red-200 bg-red-50 px-3 py-2 text-body-sm text-red-800"
                  >
                    {product.name}
                    <span className="ml-2 text-xs text-red-700/80">
                      ({NOTENPLAN_CATEGORY_LABELS[product.category]})
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="rounded-panel border border-border bg-surface p-5">
          <h2 className="font-heading text-heading-lg text-text">Gemiste kans: niet aanbevolen producten</h2>
          <p className="mt-1 text-body-sm text-muted">
            Actieve producten in de echte catalogus die het Notenplan-tool nooit aanbeveelt.
          </p>
          {missedOpportunityProducts.length === 0 ? (
            <p className="mt-3 text-body-sm text-text">
              Geen afwijkingen gevonden — alle actieve producten lijken vertegenwoordigd in het Notenplan-tool.
            </p>
          ) : (
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {missedOpportunityProducts.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between gap-3 rounded-button border border-border bg-background px-3 py-2 text-body-sm text-text"
                >
                  <span>{product.name}</span>
                  <span className="whitespace-nowrap text-muted">{formatPrice(product.basePriceCents, "nl")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
