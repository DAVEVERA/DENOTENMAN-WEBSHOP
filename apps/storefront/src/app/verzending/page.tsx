import Link from "next/link";
import { Truck, Clock, RefreshCcw, Package } from "lucide-react";

export const metadata = {
  title: "Verzending & Bezorging",
  description: "Informatie over verzendkosten, levertijden en retourneren bij De Notenman.",
};

export default function VerzendingPage() {
  return (
    <div className="bg-surface min-h-screen py-24">
      <div className="container-shop max-w-4xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-brand-primary sm:text-5xl">
            Verzending & <span className="text-brand-gold">Bezorging</span>
          </h1>
          <p className="mt-4 text-lg text-brand-primary/70">
            Snel, betrouwbaar en zorgvuldig verpakt.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {[
            {
              icon: Truck,
              title: "Gratis verzending",
              desc: "Vanaf €40 in Nederland en €50 in België.",
            },
            {
              icon: Clock,
              title: "Snelle levering",
              desc: "Voor 15:00 besteld op werkdagen = morgen in huis.",
            },
            {
              icon: Package,
              title: "Zorgvuldig verpakt",
              desc: "Luchtdicht en versheids-gegarandeerd.",
            },
            {
              icon: RefreshCcw,
              title: "14 Dagen bedenktijd",
              desc: "Niet goed? Retourneer ongeopende producten.",
            },
          ].map((feature, idx) => (
            <div
              key={idx}
              className="flex items-start gap-4 bg-white p-6 rounded-2xl border border-brand-gold/30 shadow-sm"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary text-brand-gold">
                <feature.icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-brand-primary text-lg">{feature.title}</h3>
                <p className="text-brand-primary/70 mt-1">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Style Information */}
        <div className="bg-white rounded-3xl p-8 sm:p-12 border-t-8 border-t-brand-primary shadow-xl">
          <div className="space-y-12">
            <section>
              <h2 className="text-2xl font-bold text-brand-primary border-b-2 border-brand-gold/30 pb-3 mb-6">
                Verzendkosten
              </h2>
              <ul className="space-y-4 text-brand-primary/80">
                <li className="flex justify-between items-center bg-surface p-4 rounded-xl border border-brand-primary/10">
                  <span className="font-medium">Bestellingen onder €40,- (NL)</span>
                  <span className="font-bold text-brand-primary">€ 5,95</span>
                </li>
                <li className="flex justify-between items-center bg-surface p-4 rounded-xl border border-brand-primary/10">
                  <span className="font-medium">Bestellingen vanaf €40,- (NL)</span>
                  <span className="font-bold text-brand-gold">Gratis</span>
                </li>
                <li className="flex justify-between items-center bg-surface p-4 rounded-xl border border-brand-primary/10">
                  <span className="font-medium">Bestellingen onder €50,- (BE)</span>
                  <span className="font-bold text-brand-primary">€ 7,95</span>
                </li>
                <li className="flex justify-between items-center bg-surface p-4 rounded-xl border border-brand-primary/10">
                  <span className="font-medium">Bestellingen vanaf €50,- (BE)</span>
                  <span className="font-bold text-brand-gold">Gratis</span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-brand-primary border-b-2 border-brand-gold/30 pb-3 mb-6">
                Levertijden
              </h2>
              <p className="text-brand-primary/80 leading-relaxed">
                We streven ernaar je pakket zo snel mogelijk te leveren. Bestellingen geplaatst op
                werkdagen vóór 15:00 uur worden in principe dezelfde dag nog verzonden. Dit betekent
                dat je de bestelling in 95% van de gevallen de volgende dag in huis hebt via PostNL
                of DHL.
              </p>
              <p className="text-brand-primary/80 leading-relaxed mt-4">
                Let op: Rondom feestdagen kan de levertijd afwijken door drukte bij de
                pakketdiensten.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-brand-primary border-b-2 border-brand-gold/30 pb-3 mb-6">
                Retourneren
              </h2>
              <p className="text-brand-primary/80 leading-relaxed">
                Voedselproducten hebben beperkte retourmogelijkheden vanwege hygiëne en
                voedselveiligheid. Echter heb je het recht om ongeopende, verzegelde verpakkingen
                binnen 14 dagen zonder opgave van reden te retourneren.
              </p>
              <p className="text-brand-primary/80 leading-relaxed mt-4">
                De retourkosten zijn in dit geval voor eigen rekening. Neem altijd eerst contact op
                met onze klantenservice (info@denotenman.com) voordat je een product retour stuurt,
                zodat we je de juiste instructies kunnen geven.
              </p>
            </section>
          </div>
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
