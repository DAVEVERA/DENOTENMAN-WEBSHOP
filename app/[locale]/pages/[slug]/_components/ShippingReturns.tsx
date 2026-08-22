import { IdentityDetails, LegalList, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_IDENTITY } from "@/lib/legal";
import {
  FLAT_SHIPPING_CENTS,
  FREE_SHIPPING_THRESHOLD_CENTS,
  RETURN_WINDOW_DAYS,
  STANDARD_HANDLING_DAYS,
  STANDARD_TRANSIT_DAYS,
} from "@/lib/shipping";

function euro(cents: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}
export function ShippingReturns({ locale: _locale }: { locale: string }) {
  const minimum = STANDARD_HANDLING_DAYS.min + STANDARD_TRANSIT_DAYS.min;
  const maximum = STANDARD_HANDLING_DAYS.max + STANDARD_TRANSIT_DAYS.max;

  return (
    <LegalPage
      title="Verzend- en retourbeleid"
      intro="Praktische en juridische informatie over bezorging, afhalen, bedenktijd, retouren, klachten en terugbetaling."
    >
      <LegalSection title="1. Verzending en afhalen">
        <LegalList>
          <li>Levering is beschikbaar in Nederland en België.</li>
          <li>Standaardverzending kost {euro(FLAT_SHIPPING_CENTS)} en is gratis vanaf {euro(FREE_SHIPPING_THRESHOLD_CENTS)}.</li>
          <li>De gebruikelijke verwerking en bezorging samen duren ongeveer {minimum}–{maximum} werkdagen.</li>
          <li>Afhalen kan op de in de checkout aangeboden marktlocatie en marktdag.</li>
          <li>De bestelbevestiging en track & trace bevatten de meest actuele informatie.</li>
        </LegalList>
        <p>
          Levertijden zijn verwachtingen. Rond feestdagen, bij extreem weer of drukte kan bezorging
          langer duren. De Notenman blijft tot ontvangst verantwoordelijk voor het pakket. Meld een
          vermiste zending; de klant hoeft niet zelf met de vervoerder te procederen.
        </p>
      </LegalSection>

      <LegalSection title={`2. ${RETURN_WINDOW_DAYS} dagen bedenktijd`}>
        <p>
          Voor producten waarop geen uitzondering geldt, mag een consument de koop binnen
          {" "}{RETURN_WINDOW_DAYS} dagen na ontvangst zonder reden herroepen. Een melding binnen die
          termijn is voldoende. Daarna heeft u nog 14 dagen om het product terug te sturen. U kunt het
          modelformulier gebruiken, maar een duidelijke e-mail met de benodigde gegevens is ook geldig.
        </p>
      </LegalSection>

      <LegalSection title="3. Welke voedingsmiddelen kunnen retour?">
        <p>Een product kan binnen de bedenktijd retour als het:</p>
        <LegalList>
          <li>niet snel bederft en geen zeer beperkte houdbaarheid heeft;</li>
          <li>ongeopend is en een aanwezige hygiëne- of voedselveiligheidsverzegeling intact is;</li>
          <li>niet volgens uw persoonlijke specificaties is gemaakt;</li>
          <li>zorgvuldig en, voor zover redelijk, in de originele verpakking wordt teruggestuurd.</li>
        </LegalList>
        <p>
          U mag de verpakking bekijken zoals dat in een winkel mogelijk zou zijn, maar verbreek geen
          verzegeling die het product om gezondheidsbescherming of hygiëne ongeschikt maakt voor
          wederverkoop. Voedingsmiddelen zijn niet automatisch uitgesloten van herroeping. Een
          uitsluiting wordt alleen toegepast wanneer de wet dat toestaat.
        </p>
      </LegalSection>

      <LegalSection title="4. Geen gewoon retour, wel altijd recht bij een probleem">
        <p>
          Een uitzondering op bedenktijd geldt nooit als excuus voor een verkeerd, beschadigd,
          onveilig of niet-conform product. Stuur in dat geval zo snel mogelijk een foto, bestelnummer,
          productnaam, houdbaarheids- of batchinformatie en korte omschrijving. Bewaar product en
          verpakking totdat instructies zijn ontvangen. De Notenman draagt de noodzakelijke retourkosten
          bij een gegronde klacht en biedt kosteloos herstel, vervanging of terugbetaling volgens de wet.
        </p>
      </LegalSection>

      <LegalSection title="5. Retour aanmelden en versturen">
        <ol className="list-decimal space-y-3 pl-6">
          <li>Mail binnen de bedenktijd naar <a className="underline underline-offset-4" href={`mailto:${LEGAL_IDENTITY.email}`}>{LEGAL_IDENTITY.email}</a> met naam, e-mailadres, bestelnummer, producten en aantallen.</li>
          <li>U ontvangt de actuele retourinstructies en het gecontroleerde retouradres.</li>
          <li>Verpak producten stevig. Voeg geen vertrouwelijke betaalgegevens toe.</li>
          <li>Verstuur uiterlijk 14 dagen na uw melding en bewaar het verzendbewijs.</li>
        </ol>
        <div className="rounded-card border border-border bg-background/40 p-5">
          <p className="font-bold">Retouradres na bevestiging</p>
          <p>{LEGAL_IDENTITY.returnAddress}</p>
          <p className="mt-2 text-sm text-muted">
            Stuur niets naar een marktkraam. Het definitieve retouradres moet vóór publicatie worden ingevuld.
          </p>
        </div>
      </LegalSection>

      <LegalSection title="6. Retourkosten en risico">
        <p>
          Bij een gewone herroeping betaalt u de rechtstreekse retourkosten. U bent verantwoordelijk
          voor de zending totdat die is ontvangen; kies daarom een passende, traceerbare verzendmethode.
          De Notenman betaalt retourkosten bij een verkeerd, beschadigd of gebrekkig product, mits u de
          verstrekte instructies volgt. Ongefrankeerde of rembourszendingen worden alleen na voorafgaande
          schriftelijke afspraak geaccepteerd.
        </p>
      </LegalSection>

      <LegalSection title="7. Terugbetaling">
        <p>
          Na geldige herroeping worden koopprijs en de kosten van de goedkoopste aangeboden
          standaardlevering binnen 14 dagen na de melding terugbetaald. De Notenman mag wachten totdat
          het product is ontvangen of u bewijs van verzending verstrekt. Extra kosten van een gekozen
          premiumlevering worden niet terugbetaald. Dezelfde betaalmethode wordt gebruikt, tenzij u
          uitdrukkelijk kosteloos met een andere methode instemt.
        </p>
        <p>
          Alleen waardevermindering door gebruik dat verder gaat dan nodig om aard, kenmerken en werking
          vast te stellen, mag worden verrekend. Er wordt geen waardevermindering gerekend als De Notenman
          niet correct over het herroepingsrecht heeft geïnformeerd.
        </p>
      </LegalSection>

      <LegalSection title="8. Ruilen en annuleren vóór verzending">
        <p>
          Rechtstreeks ruilen is niet gegarandeerd. Na ontvangst en goedkeuring van een retour kunt u een
          nieuwe bestelling plaatsen. Wilt u vóór verzending annuleren of een adres corrigeren, neem dan
          direct contact op. De Notenman probeert de wijziging uit te voeren, maar kan dat na verwerking of
          overdracht aan de vervoerder niet garanderen. Uw wettelijke rechten blijven gelden.
        </p>
      </LegalSection>

      <LegalSection title="9. Bedrijfs- en contactgegevens">
        <IdentityDetails />
      </LegalSection>
    </LegalPage>
  );
}
