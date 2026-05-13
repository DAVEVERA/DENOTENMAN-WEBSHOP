import Link from "next/link";
import { FileText } from "lucide-react";

export const metadata = {
  title: "Algemene Voorwaarden",
  description: "De algemene voorwaarden van De Notenman webshop.",
};

export default function AlgemeneVoorwaardenPage() {
  return (
    <div className="bg-surface min-h-screen py-24">
      <div className="container-shop max-w-4xl">
        <div className="flex flex-col items-center text-center mb-16">
          <div className="h-16 w-16 bg-brand-primary text-brand-gold rounded-full flex items-center justify-center mb-6 shadow-lg">
            <FileText className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-brand-primary sm:text-5xl">
            Algemene Voorwaarden
          </h1>
          <p className="mt-4 text-lg text-brand-primary/70">
            Regels en afspraken voor een eerlijke samenwerking.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-8 sm:p-16 border-t-8 border-t-brand-gold shadow-xl prose prose-brand max-w-none">
          <h2 className="text-2xl font-bold text-brand-primary mb-4">Artikel 1 - Definities</h2>
          <p className="text-brand-primary/80 leading-relaxed mb-8">
            In deze voorwaarden wordt verstaan onder:
            <br />
            <strong>De Notenman:</strong> de webshop die producten op afstand aanbiedt.
            <br />
            <strong>Klant:</strong> de natuurlijke of rechtspersoon die een overeenkomst op afstand
            aangaat met De Notenman.
          </p>

          <h2 className="text-2xl font-bold text-brand-primary mb-4">
            Artikel 2 - Toepasselijkheid
          </h2>
          <p className="text-brand-primary/80 leading-relaxed mb-8">
            Deze algemene voorwaarden zijn van toepassing op elk aanbod van de ondernemer en op elke
            tot stand gekomen overeenkomst op afstand tussen ondernemer en consument.
          </p>

          <h2 className="text-2xl font-bold text-brand-primary mb-4">Artikel 3 - Het aanbod</h2>
          <p className="text-brand-primary/80 leading-relaxed mb-8">
            Indien een aanbod een beperkte geldigheidsduur heeft of onder voorwaarden geschiedt,
            wordt dit nadrukkelijk in het aanbod vermeld. Het aanbod is vrijblijvend. Alle
            afbeeldingen, specificaties en gegevens in het aanbod zijn indicatief en kunnen geen
            aanleiding zijn tot schadevergoeding of ontbinding van de overeenkomst.
          </p>

          <h2 className="text-2xl font-bold text-brand-primary mb-4">
            Artikel 4 - De overeenkomst
          </h2>
          <p className="text-brand-primary/80 leading-relaxed mb-8">
            De overeenkomst komt tot stand op het moment van aanvaarding door de consument van het
            aanbod en het voldoen aan de daarbij gestelde voorwaarden. De Notenman bevestigt
            onverwijld langs elektronische weg de ontvangst van de aanvaarding van het aanbod.
          </p>

          <h2 className="text-2xl font-bold text-brand-primary mb-4">
            Artikel 5 - Levering en uitvoering
          </h2>
          <p className="text-brand-primary/80 leading-relaxed mb-8">
            De Notenman zal de grootst mogelijke zorgvuldigheid in acht nemen bij het in ontvangst
            nemen en bij de uitvoering van bestellingen van producten. Als plaats van levering geldt
            het adres dat de consument aan het bedrijf kenbaar heeft gemaakt.
          </p>

          <p className="text-brand-primary/60 italic text-sm mt-12 border-t border-brand-primary/10 pt-4">
            Laatst gewijzigd: Mei 2026.
          </p>
        </div>

        <div className="text-center mt-12">
          <Link
            href="/"
            className="inline-block text-brand-primary font-bold hover:text-brand-gold transition-colors underline decoration-brand-gold underline-offset-4"
          >
            Terug naar home
          </Link>
        </div>
      </div>
    </div>
  );
}
