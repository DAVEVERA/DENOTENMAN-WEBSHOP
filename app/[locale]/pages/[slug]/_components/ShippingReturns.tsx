import { Truck, Clock, RefreshCcw, Package } from "lucide-react";
import {
  FLAT_SHIPPING_CENTS,
  FREE_SHIPPING_THRESHOLD_CENTS,
  RETURN_WINDOW_DAYS,
  STANDARD_HANDLING_DAYS,
  STANDARD_TRANSIT_DAYS,
} from "@/lib/shipping";

function euro(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function ShippingReturns({ locale: _locale }: { locale: string }) {
  const shippingRate = euro(FLAT_SHIPPING_CENTS);
  const freeFrom = euro(FREE_SHIPPING_THRESHOLD_CENTS);
  const deliveryMinimum = STANDARD_HANDLING_DAYS.min + STANDARD_TRANSIT_DAYS.min;
  const deliveryMaximum = STANDARD_HANDLING_DAYS.max + STANDARD_TRANSIT_DAYS.max;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-contrast sm:text-5xl">
          Verzending & <span className="text-accent">retourneren</span>
        </h1>
        <p className="mt-4 text-lg text-muted">Snel, betrouwbaar en zorgvuldig verpakt.</p>
      </div>

      <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2">
        {[
          {
            icon: Truck,
            title: "Gratis verzending",
            desc: `Vanaf ${freeFrom} in Nederland en België. Daaronder betaal je ${shippingRate}.`,
          },
          {
            icon: Clock,
            title: "Verwachte levering",
            desc: `Doorgaans binnen ${deliveryMinimum}–${deliveryMaximum} werkdagen na je bestelling.`,
          },
          {
            icon: Package,
            title: "Zorgvuldig verpakt",
            desc: "Luchtdicht verpakt om kwaliteit en versheid te beschermen.",
          },
          {
            icon: RefreshCcw,
            title: `${RETURN_WINDOW_DAYS} dagen bedenktijd`,
            desc: "Ongeopende en verzegelde verpakkingen kun je binnen de retourtermijn aanmelden.",
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="flex items-start gap-4 rounded-card border border-border bg-surface p-6 shadow-card"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-button bg-contrast text-accent">
              <feature.icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-contrast">{feature.title}</h2>
              <p className="mt-1 text-muted">{feature.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-panel border-t-8 border-t-contrast bg-surface p-6 shadow-card sm:p-12">
        <div className="space-y-12 text-text">
          <section>
            <h2 className="mb-6 border-b-2 border-border pb-3 text-2xl font-bold text-contrast">
              Verzendkosten
            </h2>
            <ul className="space-y-4">
              {["Nederland", "België"].flatMap((country) => [
                <li
                  key={`${country}-paid`}
                  className="flex flex-col gap-1 rounded-card border border-border bg-background/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium">Bestellingen onder {freeFrom} ({country})</span>
                  <span className="font-bold text-contrast">{shippingRate}</span>
                </li>,
                <li
                  key={`${country}-free`}
                  className="flex flex-col gap-1 rounded-card border border-border bg-background/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium">Bestellingen vanaf {freeFrom} ({country})</span>
                  <span className="font-bold text-accent">Gratis</span>
                </li>,
              ])}
            </ul>
          </section>

          <section>
            <h2 className="mb-6 border-b-2 border-border pb-3 text-2xl font-bold text-contrast">
              Levertijden
            </h2>
            <p className="leading-relaxed">
              We verwerken bestellingen op werkdagen. De gebruikelijke verwerking en bezorging
              samen duren ongeveer {deliveryMinimum}–{deliveryMaximum} werkdagen. Rond feestdagen
              of bij drukte bij de pakketdienst kan de levering langer duren.
            </p>
          </section>

          <section>
            <h2 className="mb-6 border-b-2 border-border pb-3 text-2xl font-bold text-contrast">
              Retourneren
            </h2>
            <p className="leading-relaxed">
              Vanwege hygiëne en voedselveiligheid kunnen alleen ongeopende en verzegelde
              verpakkingen binnen {RETURN_WINDOW_DAYS} dagen worden geretourneerd.
            </p>
            <p className="mt-4 leading-relaxed">
              De kosten van retourzending zijn voor eigen rekening. Neem vóór het terugsturen
              contact op via info@denotenman.com, zodat je de juiste retourinstructies ontvangt.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
