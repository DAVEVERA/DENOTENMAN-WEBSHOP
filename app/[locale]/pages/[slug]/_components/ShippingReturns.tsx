import { Truck, Clock, RefreshCcw, Package } from "lucide-react";

export function ShippingReturns({ locale }: { locale: string }) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-contrast sm:text-5xl">
          Verzending & <span className="text-accent">Bezorging</span>
        </h1>
        <p className="mt-4 text-lg text-muted">
          Snel, betrouwbaar en zorgvuldig verpakt.
        </p>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
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
            className="flex items-start gap-4 bg-surface p-6 rounded-card border border-border shadow-card"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-button bg-contrast text-accent">
              <feature.icon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-contrast text-lg">{feature.title}</h3>
              <p className="text-muted mt-1">{feature.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Information */}
      <div className="bg-surface rounded-panel p-8 sm:p-12 border-t-8 border-t-contrast shadow-card">
        <div className="space-y-12 text-text">
          <section>
            <h2 className="text-2xl font-bold text-contrast border-b-2 border-border pb-3 mb-6">
              Verzendkosten
            </h2>
            <ul className="space-y-4">
              <li className="flex justify-between items-center bg-background/30 p-4 rounded-card border border-border">
                <span className="font-medium">Bestellingen onder €40,- (NL)</span>
                <span className="font-bold text-contrast">€ 5,95</span>
              </li>
              <li className="flex justify-between items-center bg-background/30 p-4 rounded-card border border-border">
                <span className="font-medium">Bestellingen vanaf €40,- (NL)</span>
                <span className="font-bold text-accent">Gratis</span>
              </li>
              <li className="flex justify-between items-center bg-background/30 p-4 rounded-card border border-border">
                <span className="font-medium">Bestellingen onder €50,- (BE)</span>
                <span className="font-bold text-contrast">€ 7,95</span>
              </li>
              <li className="flex justify-between items-center bg-background/30 p-4 rounded-card border border-border">
                <span className="font-medium">Bestellingen vanaf €50,- (BE)</span>
                <span className="font-bold text-accent">Gratis</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-contrast border-b-2 border-border pb-3 mb-6">
              Levertijden
            </h2>
            <p className="leading-relaxed">
              We streven ernaar je pakket zo snel mogelijk te leveren. Bestellingen geplaatst op
              werkdagen vóór 15:00 uur worden in principe dezelfde dag nog verzonden. Dit betekent
              dat je de bestelling in 95% van de gevallen de volgende dag in huis hebt via PostNL
              of DHL.
            </p>
            <p className="leading-relaxed mt-4">
              Let op: Rondom feestdagen kan de levertijd afwijken door drukte bij de
              pakketdiensten.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-contrast border-b-2 border-border pb-3 mb-6">
              Retourneren
            </h2>
            <p className="leading-relaxed">
              Voedselproducten hebben beperkte retourmogelijkheden vanwege hygiëne en
              voedselveiligheid. Echter heb je het recht om ongeopende, verzegelde verpakkingen
              binnen 14 dagen zonder opgave van reden te retourneren.
            </p>
            <p className="leading-relaxed mt-4">
              De retourkosten zijn in dit geval voor eigen rekening. Neem altijd eerst contact op
              met onze klantenservice (info@denotenman.com) voordat je een product retour stuurt,
              zodat we je de juiste instructies kunnen geven.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
