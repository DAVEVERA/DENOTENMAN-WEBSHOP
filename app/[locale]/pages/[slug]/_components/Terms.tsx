import { IdentityDetails, LegalList, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_IDENTITY } from "@/lib/legal";
import { FREE_SHIPPING_THRESHOLD_CENTS, FLAT_SHIPPING_CENTS } from "@/lib/shipping";

function euro(cents: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}
export function Terms({ locale: _locale }: { locale: string }) {
  return (
    <LegalPage
      title="Algemene voorwaarden"
      intro="Deze voorwaarden gelden voor aankopen via denotenman.com door consumenten. Dwingend consumentenrecht blijft altijd gelden."
    >
      <LegalSection title="Artikel 1 – Definities">
        <LegalList>
          <li><strong>De Notenman:</strong> de ondernemer met als handelsactiviteit {LEGAL_IDENTITY.businessDescription.toLowerCase()}</li>
          <li><strong>Consument:</strong> een natuurlijke persoon die niet handelt voor bedrijfs- of beroepsdoeleinden.</li>
          <li><strong>Overeenkomst:</strong> de koop op afstand tussen De Notenman en de consument.</li>
          <li><strong>Dag:</strong> kalenderdag; <strong>werkdag:</strong> maandag tot en met vrijdag, met uitzondering van erkende feestdagen.</li>
          <li><strong>Duurzame gegevensdrager:</strong> een middel, zoals e-mail, waarmee informatie ongewijzigd kan worden bewaard en geraadpleegd.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Artikel 2 – Identiteit en contact">
        <IdentityDetails />
        <p>
          Vragen, klachten en retourmeldingen kunnen naar {LEGAL_IDENTITY.email}. Telefonisch en via
          WhatsApp is De Notenman bereikbaar op {LEGAL_IDENTITY.phoneDisplay}. De actuele bereikbaarheid
          wordt op de contactpagina vermeld.
        </p>
      </LegalSection>

      <LegalSection title="Artikel 3 – Toepasselijkheid en beschikbaarstelling">
        <p>
          Deze voorwaarden gelden voor ieder consumentenaanbod en iedere overeenkomst via de webshop.
          Voor zakelijke klanten gelden daarnaast de aanvullende voorwaarden. Afwijkingen zijn alleen
          geldig als zij schriftelijk zijn overeengekomen en mogen wettelijke consumentenrechten niet beperken.
        </p>
        <p>
          De voorwaarden worden vóór het plaatsen van de bestelling vindbaar aangeboden en kunnen
          worden opgeslagen of afgedrukt. De bestelbevestiging verwijst naar de geldende versie. Als
          een bepaling nietig of vernietigbaar is, blijven de overige bepalingen gelden en wordt de
          betreffende bepaling vervangen door een geldige bepaling die het doel zo dicht mogelijk benadert.
        </p>
      </LegalSection>

      <LegalSection title="Artikel 4 – Aanbod en productinformatie">
        <p>
          Het aanbod vermeldt de voornaamste kenmerken, prijs, hoeveelheid of gewicht, ingrediënten,
          allergenen, beschikbare varianten, bezorgopties en bijkomende kosten voor zover van toepassing.
          Kennelijke schrijf-, reken- of systeemfouten binden De Notenman niet wanneer de consument
          redelijkerwijs moest begrijpen dat sprake was van een fout.
        </p>
        <p>
          Noten, gedroogd fruit, honing en andere natuurproducten kunnen per oogst of batch verschillen
          in kleur, vorm, maat, textuur en smaak. Afbeeldingen zijn representatief; zo'n normale natuurlijke
          afwijking is geen gebrek. De op de verpakking en productpagina vermelde allergeneninformatie is
          leidend. Neem bij een ernstige allergie vóór bestelling contact op. Kruisbesmetting kan niet worden
          uitgesloten wanneer dit bij het product staat vermeld.
        </p>
      </LegalSection>

      <LegalSection title="Artikel 5 – Totstandkoming van de overeenkomst">
        <p>
          De consument controleert de inhoud van het winkelmandje, contact- en adresgegevens, bezorgkeuze,
          totaalprijs en deze voorwaarden. De overeenkomst komt tot stand wanneer de consument de
          bestelling met betalingsverplichting plaatst en De Notenman de bestelling elektronisch bevestigt.
          De Notenman kan een bestelling gemotiveerd weigeren bij onjuiste gegevens, vermoeden van fraude,
          onbeschikbaarheid of een kennelijke fout. Een ontvangen betaling wordt dan terugbetaald.
        </p>
      </LegalSection>

      <LegalSection title="Artikel 6 – Prijzen, kortingen en verzendkosten">
        <p>
          Consumentenprijzen zijn in euro en inclusief btw. De checkout toont vóór bestelling de volledige
          prijs. Standaardverzending naar Nederland en België kost momenteel {euro(FLAT_SHIPPING_CENTS)} en
          is gratis vanaf {euro(FREE_SHIPPING_THRESHOLD_CENTS)}. De checkout is leidend als tarieven of
          drempels later wijzigen.
        </p>
        <p>
          Kortingscodes zijn niet inwisselbaar voor geld, gelden eenmaal per bestelling en kunnen niet worden
          gecombineerd, tenzij anders vermeld. Een actie kan een looptijd, minimumaankoop, doelgroep of
          productuitsluiting hebben. Een korting wordt niet achteraf toegepast op een afgeronde bestelling.
        </p>
      </LegalSection>

      <LegalSection title="Artikel 7 – Betaling">
        <p>
          Betaling verloopt via de in de checkout aangeboden methoden van Mollie. De consument volgt de
          beveiligde betaalinstructies. De bestelling wordt pas verwerkt nadat de betaling of een uitdrukkelijk
          overeengekomen betaalafspraak is bevestigd. Bij een storing blijft een open betaling niet onbeperkt
          gereserveerd. Terugbetalingen gaan in beginsel naar dezelfde betaalmethode.
        </p>
      </LegalSection>

      <LegalSection title="Artikel 8 – Levering, afhalen en risico">
        <p>
          Levering vindt plaats op het opgegeven adres in Nederland of België, of op de gekozen marktdag en
          afhaallocatie. De opgegeven levertijd is een verwachting. Tenzij anders overeengekomen levert De
          Notenman uiterlijk binnen 30 dagen. Bij vertraging krijgt de consument een redelijke aanvullende
          termijn, behalve wanneer levering op een vast tijdstip essentieel was of De Notenman levering weigert.
        </p>
        <p>
          De Notenman blijft verantwoordelijk voor de zending totdat de consument of een door hem aangewezen
          derde het pakket ontvangt. Controleer adres en postcode zorgvuldig. Extra kosten door een aantoonbaar
          onjuist of onvolledig opgegeven adres kunnen, voor zover redelijk, worden doorberekend. Bij afhalen
          wordt de bestelling alleen meegegeven op basis van de bestelbevestiging en zo nodig een passende controle.
        </p>
      </LegalSection>

      <LegalSection title="Artikel 9 – Herroepingsrecht">
        <p>
          Voor producten waarop geen wettelijke uitzondering geldt, kan de consument de overeenkomst zonder
          reden ontbinden tot 14 dagen na de dag van ontvangst. Bij één bestelling met meerdere afzonderlijke
          leveringen begint de termijn na ontvangst van het laatste product. De melding kan via e-mail, het
          modelformulier of een andere ondubbelzinnige verklaring.
        </p>
        <p>
          Na de melding heeft de consument nog 14 dagen om het product terug te sturen. De consument mag het
          product alleen hanteren voor zover dat nodig is om aard, kenmerken en werking vast te stellen en is
          aansprakelijk voor verdere waardevermindering. De retourpagina bevat de praktische stappen.
        </p>
      </LegalSection>

      <LegalSection title="Artikel 10 – Uitzonderingen op herroeping">
        <p>Het herroepingsrecht bestaat onder meer niet voor:</p>
        <LegalList>
          <li>producten die snel bederven of een beperkte houdbaarheid hebben;</li>
          <li>verzegelde producten die om gezondheidsbescherming of hygiëne niet geschikt zijn om te worden teruggezonden nadat de verzegeling is verbroken;</li>
          <li>producten die volgens specificaties van de consument zijn gemaakt of duidelijk persoonlijk van aard zijn;</li>
          <li>producten die na levering door hun aard onherroepelijk met andere zaken zijn vermengd.</li>
        </LegalList>
        <p>
          Voedingsmiddelen zijn niet automatisch uitgesloten. Een ongeopende, verzegelde en niet-snel
          bederfelijke verpakking kan binnen de wettelijke termijn worden geretourneerd. Een uitsluiting tast
          de rechten bij een verkeerd, beschadigd, onveilig of niet-conform product nooit aan.
        </p>
      </LegalSection>

      <LegalSection title="Artikel 11 – Terugbetaling na herroeping">
        <p>
          De Notenman betaalt de ontvangen koopprijs en de kosten van de goedkoopste aangeboden standaardlevering
          binnen 14 dagen na de herroepingsmelding terug. Terugbetaling mag worden uitgesteld totdat het product
          is ontvangen of de consument aantoont dat het is teruggezonden, afhankelijk van wat eerder is. Extra
          kosten voor een duurdere levermethode worden niet terugbetaald. De rechtstreekse retourkosten zijn voor
          de consument, tenzij De Notenman vooraf anders aangeeft of niet correct over die kosten heeft geïnformeerd.
        </p>
      </LegalSection>

      <LegalSection title="Artikel 12 – Conformiteit, garantie en productveiligheid">
        <p>
          Een product moet voldoen aan wat de consument redelijkerwijs mocht verwachten. Wettelijke garantie
          kent geen vaste commerciële termijn: aard, prijs, informatie en normale levensduur zijn bepalend.
          Meld een gebrek zo snel mogelijk met bestelnummer en duidelijke omschrijving. De wettelijke melding
          binnen twee maanden na ontdekking is in ieder geval tijdig.
        </p>
        <p>
          Bij een gegronde klacht zorgt De Notenman kosteloos voor herstel of vervanging wanneer dat mogelijk en
          redelijk is. Zo niet, dan kan prijsvermindering of ontbinding volgen. Bij een veiligheidswaarschuwing
          of terugroepactie volgt de consument de gegeven instructies en gebruikt het product niet verder.
        </p>
      </LegalSection>

      <LegalSection title="Artikel 13 – Klachten">
        <p>
          Stuur een klacht volledig naar {LEGAL_IDENTITY.email}, met bestelnummer, datum, omschrijving en zo nodig
          foto's. De Notenman bevestigt de klacht en antwoordt inhoudelijk binnen 14 dagen. Als meer tijd nodig is,
          wordt binnen die termijn gemeld wanneer een antwoord volgt. Partijen proberen het geschil eerst samen
          op te lossen. Een consument behoudt altijd toegang tot de bevoegde toezichthouder of rechter.
        </p>
      </LegalSection>

      <LegalSection title="Artikel 14 – Aansprakelijkheid en overmacht">
        <p>
          De Notenman is aansprakelijk volgens het toepasselijke recht en beperkt geen aansprakelijkheid voor
          opzet, bewuste roekeloosheid, overlijden, letsel, productaansprakelijkheid of dwingende consumentenrechten.
          De consument is verantwoordelijk voor het volgen van bewaarinstructies en allergeneninformatie.
        </p>
        <p>
          Bij overmacht, waaronder ernstige vervoersstoring, overheidsmaatregel, stroom- of netwerkuitval,
          pandemie, brand of tekort bij een leverancier buiten redelijke controle, worden verplichtingen tijdelijk
          opgeschort. Duurt de verhindering onredelijk lang, dan mag iedere partij het niet-uitgevoerde deel beëindigen;
          reeds betaalde, niet-geleverde producten worden terugbetaald.
        </p>
      </LegalSection>

      <LegalSection title="Artikel 15 – Persoonsgegevens en intellectuele eigendom">
        <p>
          Persoonsgegevens worden verwerkt volgens de privacyverklaring en cookievoorkeuren. Teksten, foto's,
          ontwerpen, handelsnamen en overige webshopinhoud mogen zonder toestemming niet commercieel worden
          gekopieerd of hergebruikt, behoudens wettelijke uitzonderingen.
        </p>
      </LegalSection>

      <LegalSection title="Artikel 16 – Recht en geschillen">
        <p>
          Nederlands recht is van toepassing. Voor consumenten in een ander EU-land blijven dwingende
          beschermingsregels van hun woonland gelden. Geschillen worden voorgelegd aan de volgens de wet bevoegde
          rechter. Een forumkeuze ontneemt een consument nooit het recht om bij een andere wettelijk bevoegde
          rechter te procederen.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
