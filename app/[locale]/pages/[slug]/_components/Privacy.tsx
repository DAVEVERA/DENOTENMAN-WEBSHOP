import { IdentityDetails, LegalList, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_IDENTITY } from "@/lib/legal";

export function Privacy({ locale: _locale }: { locale: string }) {
  return (
    <LegalPage
      title="Privacyverklaring"
      intro="Hier leest u welke persoonsgegevens De Notenman verwerkt, waarom dat gebeurt en welke rechten u heeft."
    >
      <LegalSection title="1. Wie is verantwoordelijk?">
        <p>
          De Notenman is verwerkingsverantwoordelijke voor de persoonsgegevens die via de webshop,
          klantenservice, marktkraam en zakelijke dienstverlening worden verwerkt.
        </p>
        <IdentityDetails />
        <p>
          Privacyvragen kunt u sturen naar{" "}
          <a className="underline underline-offset-4" href={`mailto:${LEGAL_IDENTITY.email}`}>
            {LEGAL_IDENTITY.email}
          </a>
          . Er is geen functionaris voor gegevensbescherming aangesteld. Als dat verandert, wordt
          deze verklaring aangepast.
        </p>
      </LegalSection>

      <LegalSection title="2. Welke gegevens verwerken wij?">
        <LegalList>
          <li>naam, e-mailadres en eventueel telefoonnummer;</li>
          <li>factuur-, aflever- en afhaalgegevens;</li>
          <li>bestelregels, bedragen, kortingen, betaalstatus, retouren en terugbetalingen;</li>
          <li>account- en bestelreferenties waarmee u zonder wachtwoord een bestelling kunt opzoeken;</li>
          <li>nieuwsbriefkeuze, aan- en afmelddatum, toestemmingsbron en technisch bewijs van toestemming;</li>
          <li>aanmeldingen voor eenmalige voorraadmeldingen;</li>
          <li>berichten aan de klantenservice, klachten en bijbehorende correspondentie;</li>
          <li>bedrijfsnaam, contactpersoon en btw-gegevens bij zakelijke aanvragen;</li>
          <li>IP-adres, apparaat-, browser-, beveiligings- en loggegevens;</li>
          <li>cookievoorkeuren en, na toestemming, gebruiks- en marketinggegevens.</li>
        </LegalList>
        <p>
          De Notenman ontvangt geen volledige betaalkaart- of bankgegevens. Betalingen worden in
          de beveiligde betaalomgeving van Mollie uitgevoerd. Wij ontvangen een betaalreferentie,
          bedrag en betaalstatus voor de uitvoering en administratie van de bestelling.
        </p>
      </LegalSection>

      <LegalSection title="3. Doelen en grondslagen">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="p-3">Doel</th>
                <th className="p-3">Gegevens</th>
                <th className="p-3">Grondslag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr><td className="p-3">Bestelling, betaling, bezorging of afhalen</td><td className="p-3">Contact-, adres-, bestel- en betaalstatusgegevens</td><td className="p-3">Uitvoering overeenkomst</td></tr>
              <tr><td className="p-3">Facturatie en boekhouding</td><td className="p-3">Bestel-, betaal- en factuurgegevens</td><td className="p-3">Wettelijke verplichting</td></tr>
              <tr><td className="p-3">Klantenservice, klachten, fraude- en misbruikpreventie</td><td className="p-3">Contact, bestelling, correspondentie en beperkte logs</td><td className="p-3">Overeenkomst en gerechtvaardigd belang</td></tr>
              <tr><td className="p-3">Nieuwsbrief en gerichte marketing</td><td className="p-3">E-mail, naam, voorkeuren en interacties</td><td className="p-3">Toestemming</td></tr>
              <tr><td className="p-3">Eenmalige voorraadmelding</td><td className="p-3">E-mail, product en taal</td><td className="p-3">Toestemming/verzoek</td></tr>
              <tr><td className="p-3">Webshop verbeteren en bereik meten</td><td className="p-3">Geanonimiseerde of gepseudonimiseerde gebruiksgegevens</td><td className="p-3">Toestemming als cookies of vergelijkbare technieken nodig zijn</td></tr>
              <tr><td className="p-3">Rechtsvorderingen en beveiliging</td><td className="p-3">Noodzakelijke dossier- en loggegevens</td><td className="p-3">Gerechtvaardigd belang en wettelijke verplichting</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Bij een beroep op gerechtvaardigd belang weegt De Notenman het bedrijfsbelang af tegen
          uw privacybelang. U kunt daartegen bezwaar maken. Gegevens die noodzakelijk zijn voor
          bestelling, betaling of verzending moeten worden verstrekt; zonder die gegevens kan de
          bestelling niet worden uitgevoerd. Een telefoonnummer is in de checkout optioneel.
        </p>
      </LegalSection>

      <LegalSection title="4. Ontvangers en dienstverleners">
        <p>Alleen gegevens die voor de betreffende taak nodig zijn worden gedeeld met:</p>
        <LegalList>
          <li><strong>Mollie</strong>, voor betalingen, betaalcontrole en terugbetalingen;</li>
          <li><strong>PostNL</strong>, voor verzendlabels, bezorging en track & trace;</li>
          <li><strong>Mailchimp Marketing en Transactional</strong>, voor nieuwsbrieven, toestemmingsbeheer en bestel-/aftersalesmail;</li>
          <li><strong>Resend</strong>, uitsluitend wanneer deze e-maildienst als technische verzendroute is geconfigureerd;</li>
          <li><strong>Google Cloud</strong>, voor hosting, opslag, beveiliging en technische infrastructuur;</li>
          <li><strong>Neon</strong>, voor de beheerde PostgreSQL-database;</li>
          <li><strong>Google Analytics en Google Ads</strong>, alleen na de vereiste cookietoestemming;</li>
          <li>boekhouder, accountant, verzekeraar, juridisch adviseur of bevoegde overheid wanneer dit noodzakelijk of wettelijk verplicht is.</li>
        </LegalList>
        <p>
          Mollie en PostNL kunnen voor hun eigen wettelijk bepaalde taken zelfstandig
          verwerkingsverantwoordelijke zijn. Met partijen die uitsluitend in opdracht verwerken
          sluit De Notenman een verwerkersovereenkomst. Gegevens worden niet verkocht.
        </p>
      </LegalSection>

      <LegalSection title="5. Doorgifte buiten de Europese Economische Ruimte">
        <p>
          Sommige leveranciers, waaronder Google en Mailchimp, kunnen gegevens vanuit of buiten
          de EER ondersteunen. De Notenman staat zo'n doorgifte alleen toe als een adequaatheidsbesluit,
          de EU-modelcontractbepalingen of een andere geldige AVG-waarborg geldt. Waar nodig worden
          aanvullende beveiligingsmaatregelen en een doorgifterisicobeoordeling toegepast.
        </p>
      </LegalSection>

      <LegalSection title="6. Bewaartermijnen">
        <LegalList>
          <li>bestel-, betaal- en factuurgegevens: in beginsel 7 jaar na afloop van het boekjaar;</li>
          <li>geannuleerde of onvoltooide bestellingen zonder fiscale bewaarplicht: maximaal 2 jaar;</li>
          <li>klantenservice en klachten: maximaal 2 jaar na afhandeling, langer als een geschil loopt;</li>
          <li>nieuwsbriefprofiel: tot afmelding; noodzakelijk bewijs van toestemming maximaal 5 jaar daarna;</li>
          <li>voorraadmelding: tot verzending of intrekking en uiterlijk 3 maanden daarna verwijderd of geanonimiseerd;</li>
          <li>beveiligings- en foutlogs: normaal maximaal 90 dagen, tenzij onderzoek naar misbruik langer bewaren vereist;</li>
          <li>analyticsgegevens: maximaal 14 maanden, tenzij de ingestelde termijn aantoonbaar korter is;</li>
          <li>cookievoorkeur: 6 maanden, waarna opnieuw om een keuze kan worden gevraagd.</li>
        </LegalList>
        <p>
          Een langere termijn geldt alleen wanneer een wettelijke bewaarplicht, lopende klacht,
          fraudeonderzoek of rechtsvordering dat vereist. Back-ups worden volgens hun vaste cyclus
          overschreven; verwijderd materiaal is daarin niet opnieuw actief beschikbaar.
        </p>
      </LegalSection>

      <LegalSection title="7. Cookies en lokale opslag">
        <p>
          Het winkelmandje en favorieten worden functioneel op uw apparaat bewaard. Analytics- en
          marketingtechnieken worden pas geactiveerd nadat u daarvoor toestemming geeft. U kunt
          uw keuze altijd opnieuw openen via “Cookie-instellingen” in de voettekst. Meer informatie
          staat in het cookiebeleid.
        </p>
      </LegalSection>

      <LegalSection title="8. Beveiliging en datalekken">
        <p>
          De Notenman gebruikt onder meer versleutelde verbindingen, beperkte beheerrechten,
          afgeschermde secrets, authenticatie, logging, updates, back-ups en leverancierscontrole.
          Geen beveiliging is absoluut. Een vermoedelijk datalek kan worden gemeld via{" "}
          <a className="underline underline-offset-4" href={`mailto:${LEGAL_IDENTITY.email}`}>
            {LEGAL_IDENTITY.email}
          </a>
          . Meldingen aan de Autoriteit Persoonsgegevens en betrokkenen gebeuren wanneer de AVG dat vereist.
        </p>
      </LegalSection>

      <LegalSection title="9. Uw privacyrechten">
        <p>U kunt, voor zover de AVG dat toestaat, verzoeken om:</p>
        <LegalList>
          <li>inzage, correctie of verwijdering van uw gegevens;</li>
          <li>beperking van verwerking of overdracht van door u verstrekte gegevens;</li>
          <li>bezwaar tegen verwerking op basis van gerechtvaardigd belang of direct marketing;</li>
          <li>intrekking van toestemming, zonder gevolgen voor eerdere rechtmatige verwerking;</li>
          <li>informatie over eventuele geautomatiseerde besluitvorming.</li>
        </LegalList>
        <p>
          Stuur uw verzoek naar {LEGAL_IDENTITY.email}. Om misbruik te voorkomen kan aanvullende
          identificatie worden gevraagd. Verstrek nooit ongevraagd een volledige kopie van uw
          identiteitsbewijs. In beginsel ontvangt u binnen één maand antwoord. Bij complexe of veel
          verzoeken kan die termijn volgens de AVG met twee maanden worden verlengd.
        </p>
      </LegalSection>

      <LegalSection title="10. Minderjarigen en geautomatiseerde besluiten">
        <p>
          De webshop is niet specifiek gericht op kinderen. Laat een ouder of wettelijke
          vertegenwoordiger contact opnemen als zonder geldige toestemming gegevens van een kind
          zijn verstrekt. De Notenman neemt geen uitsluitend geautomatiseerde besluiten met
          rechtsgevolgen voor klanten. Betaaldienstverleners kunnen wel eigen geautomatiseerde
          fraude- en betaalcontroles uitvoeren.
        </p>
      </LegalSection>

      <LegalSection title="11. Klacht en wijzigingen">
        <p>
          U kunt eerst contact opnemen met De Notenman. Daarnaast kunt u een klacht indienen bij de
          Autoriteit Persoonsgegevens via autoriteitpersoonsgegevens.nl. Deze verklaring kan worden
          aangepast bij wijzigingen in de webshop, leveranciers of wetgeving. De actuele versie
          staat op deze pagina; wezenlijke wijzigingen worden waar passend extra gemeld.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
