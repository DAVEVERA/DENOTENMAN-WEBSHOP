import { IdentityDetails, LegalList, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_IDENTITY } from "@/lib/legal";
export function AdditionalTerms({ locale: _locale }: { locale: string }) {
  return (
    <LegalPage
      title="Aanvullende voorwaarden"
      intro="Aanvullende afspraken voor voedingsmiddelen, afhalen, acties, maatwerk en zakelijke bestellingen bij De Notenman."
    >
      <LegalSection title="1. Verhouding tot de algemene voorwaarden">
        <p>
          Deze aanvullende voorwaarden gelden naast de algemene voorwaarden. Bij strijd gaat de
          specifiekere bepaling voor. Dwingend consumentenrecht gaat altijd voor beide documenten.
          Voor zakelijke kopers gelden de bepalingen in hoofdstuk 7 aanvullend en zijn bepalingen die
          uitsluitend consumenten beschermen niet van toepassing.
        </p>
      </LegalSection>

      <LegalSection title="2. Voedingsmiddelen, allergenen en bewaren">
        <LegalList>
          <li>Ingrediënten, voedingswaarden, herkomst en allergenen worden per product of verpakking vermeld voor zover wettelijk vereist.</li>
          <li>Producten kunnen worden verwerkt in een omgeving met noten, pinda's, gluten, melk, soja, sesam en andere allergenen. De concrete waarschuwing bij het product is leidend.</li>
          <li>Een klant met een ernstige allergie controleert vóór consumptie altijd het actuele etiket en neemt bij twijfel contact op.</li>
          <li>De klant volgt de bewaar- en houdbaarheidsinstructies en meldt een afwijking vóór consumptie.</li>
          <li>Natuurlijke variatie in kleur, formaat, vochtgehalte, kristallisatie van honing of breuk bij noten en gedroogd fruit is geen gebrek als kwaliteit en voedselveiligheid intact zijn.</li>
        </LegalList>
        <p>
          De Notenman doet geen individuele medische of dieetkundige toezegging. Algemene
          productinformatie vervangt geen advies van arts of diëtist.
        </p>
      </LegalSection>

      <LegalSection title="3. Versheid, gewicht en beschikbaarheid">
        <p>
          Het op het product vermelde nettogewicht is leidend. Kleine gewichtsafwijkingen mogen alleen
          binnen de wettelijke toleranties voorkomen. Voorraad en actiedata kunnen per webshop en
          marktkraam verschillen. Een artikel in het winkelmandje is nog niet gereserveerd. Als na
          bestelling blijkt dat een product niet beschikbaar is, biedt De Notenman een gelijkwaardig
          alternatief aan; de klant beslist zelf of hij dat accepteert. Anders volgt terugbetaling.
        </p>
      </LegalSection>

      <LegalSection title="4. Afhalen op de markt">
        <LegalList>
          <li>De bestelbevestiging vermeldt de gekozen locatie en eerst beschikbare marktdag.</li>
          <li>De klant toont het bestelnummer en zo nodig een passende controle van naam of e-mailadres.</li>
          <li>Kan de klant niet komen, dan meldt hij dit zo snel mogelijk via {LEGAL_IDENTITY.email}.</li>
          <li>Bij uitval van een markt door weer, vergunning, ziekte of overheidsmaatregel wordt een nieuwe afhaalmogelijkheid of terugbetaling aangeboden.</li>
          <li>Niet-afgehaalde bederfelijke of speciaal samengestelde producten kunnen niet onbeperkt worden bewaard. De Notenman neemt eerst contact op en handelt daarna redelijk, rekening houdend met voedselveiligheid en wettelijke rechten.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Acties, kortingen en promoties">
        <p>
          De actievoorwaarden bij een aanbieding bepalen looptijd, assortiment, minimumaankoop en
          eventuele doelgroep. Kortingen gelden zolang de voorraad strekt, zijn niet inwisselbaar voor
          geld en gelden niet met terugwerkende kracht. Misbruik, geautomatiseerde bulkclaims en gebruik
          in strijd met de actievoorwaarden mogen worden geweigerd. Bij retour wordt de uiteindelijke
          korting opnieuw berekend; vervalt een drempel, dan mag het terug te betalen bedrag evenredig
          worden aangepast, voor zover dat vooraf duidelijk was.
        </p>
      </LegalSection>

      <LegalSection title="6. Maatwerk, cadeaupakketten en samengestelde producten">
        <p>
          Voor een persoonlijk samengesteld, bedrukt of volgens klantspecificatie gemaakt product legt
          De Notenman samenstelling, aantallen, prijs en leverdatum vooraf vast. De klant controleert en
          accordeert aangeleverde namen, teksten, logo's en adressen. Na start van de uitvoering kan een
          wijziging extra kosten of vertraging veroorzaken. Het wettelijke herroepingsrecht kan voor
          duidelijk gepersonaliseerde producten zijn uitgesloten; rechten bij een fout of gebrek blijven gelden.
        </p>
      </LegalSection>

      <LegalSection title="7. Zakelijke bestellingen">
        <IdentityDetails />
        <LegalList>
          <li>Een offerte is vrijblijvend en geldig tot de daarin genoemde datum. Prijzen zijn exclusief btw, tenzij anders vermeld.</li>
          <li>Een overeenkomst ontstaat na schriftelijke aanvaarding of zodra De Notenman met instemming van de klant uitvoert.</li>
          <li>Betaling vooraf is de hoofdregel. Betaling op rekening geldt alleen na schriftelijke goedkeuring en binnen de afgesproken termijn.</li>
          <li>Bij te late zakelijke betaling is zonder ingebrekestelling wettelijke handelsrente verschuldigd, plus redelijke buitengerechtelijke incassokosten volgens de wet.</li>
          <li>Eigendom gaat pas over na volledige betaling; risico gaat over bij levering of afgesproken overdracht.</li>
          <li>De zakelijke klant controleert aantallen en zichtbare schade bij ontvangst en meldt die zo snel mogelijk. Verborgen gebreken worden direct na ontdekking gemeld.</li>
          <li>Doorverkoop gebeurt met behoud van etiketten, traceerbaarheid, allergeneninformatie, houdbaarheid en wettelijk vereiste productinformatie.</li>
          <li>Een zakelijke klant werkt direct mee aan blokkade, terugroepactie of veiligheidswaarschuwing en houdt afnemersgegevens beschikbaar voor zover wettelijk toegestaan.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="8. Zakelijke aansprakelijkheid">
        <p>
          Voor zakelijke klanten is aansprakelijkheid, voor zover wettelijk toegestaan, beperkt tot
          directe schade en tot het factuurbedrag van de betreffende levering, met als maximum het bedrag
          dat de aansprakelijkheidsverzekering uitkeert plus het eigen risico. De Notenman is niet
          aansprakelijk voor indirecte schade, gemiste winst of bedrijfsstagnatie. Deze beperking geldt
          niet bij opzet of bewuste roekeloosheid van de leiding, letsel, productaansprakelijkheid of voor
          zover beperking wettelijk verboden is.
        </p>
      </LegalSection>

      <LegalSection title="9. Productveiligheid en terugroepacties">
        <p>
          Bij een mogelijk onveilig product kan De Notenman verkoop en levering direct blokkeren,
          klanten waarschuwen en terugzending of vernietiging vragen. De klant gebruikt of verkoopt het
          product dan niet verder en volgt de instructies. Een veiligheidsmelding kan worden gedaan via
          {" "}{LEGAL_IDENTITY.email}, met productnaam, batch- of houdbaarheidsinformatie, aankoopdatum en foto's.
        </p>
      </LegalSection>

      <LegalSection title="10. Slotbepalingen">
        <p>
          Nederlands recht is van toepassing en de volgens de wet bevoegde rechter behandelt geschillen.
          De Notenman mag deze aanvullende voorwaarden wijzigen voor toekomstige overeenkomsten. Op een
          bestaande overeenkomst blijft de bij het sluiten verstrekte versie van toepassing, tenzij een
          wettelijke wijziging onmiddellijke aanpassing vereist of de klant uitdrukkelijk instemt.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
