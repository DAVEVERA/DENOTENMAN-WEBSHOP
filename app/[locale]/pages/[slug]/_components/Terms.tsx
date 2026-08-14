import { FileText } from "lucide-react";

export function Terms({ locale }: { locale: string }) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col items-center text-center mb-12">
        <div className="h-16 w-16 bg-contrast text-accent rounded-full flex items-center justify-center mb-6 shadow-md">
          <FileText className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-contrast sm:text-5xl">
          Algemene Voorwaarden
        </h1>
        <p className="mt-4 text-lg text-muted">
          Regels en afspraken voor een eerlijke samenwerking.
        </p>
      </div>

      <div className="bg-surface rounded-panel p-8 sm:p-12 border-t-8 border-t-accent shadow-card prose max-w-none text-text">
        <h2 className="text-2xl font-bold text-contrast mb-4">Artikel 1 - Definities</h2>
        <p className="leading-relaxed mb-8">
          In deze voorwaarden wordt verstaan onder:
          <br />
          <strong className="text-contrast">De Notenman:</strong> de webshop die producten op afstand aanbiedt.
          <br />
          <strong className="text-contrast">Klant:</strong> de natuurlijke of rechtspersoon die een overeenkomst op afstand
          aangaat met De Notenman.
        </p>

        <h2 className="text-2xl font-bold text-contrast mb-4">
          Artikel 2 - Toepasselijkheid
        </h2>
        <p className="leading-relaxed mb-8">
          Deze algemene voorwaarden zijn van toepassing op elk aanbod van de ondernemer en op elke
          tot stand gekomen overeenkomst op afstand tussen ondernemer en consument.
        </p>

        <h2 className="text-2xl font-bold text-contrast mb-4">Artikel 3 - Het aanbod</h2>
        <p className="leading-relaxed mb-8">
          Indien een aanbod een beperkte geldigheidsduur heeft of onder voorwaarden geschiedt,
          wordt dit nadrukkelijk in het aanbod vermeld. Het aanbod is vrijblijvend. Alle
          afbeeldingen, specificaties en gegevens in het aanbod zijn indicatief en kunnen geen
          aanleiding zijn tot schadevergoeding of ontbinding van de overeenkomst.
        </p>

        <h2 className="text-2xl font-bold text-contrast mb-4">
          Artikel 4 - De overeenkomst
        </h2>
        <p className="leading-relaxed mb-8">
          De overeenkomst komt tot stand op het moment van aanvaarding door de consument van het
          aanbod en het voldoen aan de daarbij gestelde voorwaarden. De Notenman bevestigt
          onverwijld langs elektronische weg de ontvangst van de aanvaarding van het aanbod.
        </p>

        <h2 className="text-2xl font-bold text-contrast mb-4">
          Artikel 5 - Levering en uitvoering
        </h2>
        <p className="leading-relaxed mb-8">
          De Notenman zal de grootst mogelijke zorgvuldigheid in acht nemen bij het in ontvangst
          nemen en bij de uitvoering van bestellingen van producten. Als plaats van levering geldt
          het adres dat de consument aan het bedrijf kenbaar heeft gemaakt.
        </p>

        <p className="italic text-sm mt-12 border-t border-border pt-4 text-muted">
          Laatst gewijzigd: Mei 2026.
        </p>
      </div>
    </div>
  );
}
