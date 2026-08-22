import { IdentityDetails, LegalList, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_IDENTITY } from "@/lib/legal";
export function ProcessingAgreement({ locale: _locale }: { locale: string }) {
  return (
    <LegalPage
      title="Model verwerkersovereenkomst"
      intro="Model voor leveranciers die namens De Notenman persoonsgegevens verwerken. Vul de bijlagen in en laat beide partijen ondertekenen."
    >
      <LegalSection title="Partijen en status van dit model">
        <p>
          <strong>Verwerkingsverantwoordelijke:</strong> De Notenman, met onderstaande gegevens.
          <br />
          <strong>Verwerker:</strong> [juridische naam, adres, registratienummer en contactpersoon invullen].
        </p>
        <IdentityDetails />
        <p>
          Dit model wordt pas een bindende overeenkomst nadat de ontbrekende partij- en bijlagegegevens
          zijn ingevuld en beide partijen hebben ondertekend. De hoofdovereenkomst, deze overeenkomst en
          de bijlagen vormen samen één geheel. Bij strijd over persoonsgegevens gaat deze overeenkomst voor.
        </p>
      </LegalSection>

      <LegalSection title="1. Onderwerp, duur, aard en doel">
        <p>
          Verwerker verwerkt uitsluitend de in Bijlage 1 beschreven persoonsgegevens voor de daarin
          vastgelegde dienstverlening en duur. Verwerkingsverantwoordelijke bepaalt doel en middelen,
          behalve voor onderdelen waarvoor de verwerker op grond van de wet zelfstandig verantwoordelijk is.
          De verwerking eindigt uiterlijk bij beëindiging van de hoofdovereenkomst, behoudens wettelijke bewaring.
        </p>
      </LegalSection>

      <LegalSection title="2. Instructies en vertrouwelijkheid">
        <LegalList>
          <li>Verwerker verwerkt gegevens alleen op gedocumenteerde instructie van De Notenman, inclusief doorgifte buiten de EER.</li>
          <li>Verwerker meldt het direct als een instructie volgens hem in strijd is met privacywetgeving en schort die instructie zo nodig op.</li>
          <li>Personen met toegang hebben die toegang nodig voor hun taak, zijn tot geheimhouding verplicht en krijgen passende privacy- en beveiligingsinstructie.</li>
          <li>Verwerker gebruikt gegevens niet voor eigen marketing, profilering, producttraining of andere eigen doelen zonder afzonderlijke geldige rechtsgrond en voorafgaande schriftelijke afspraak.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. Beveiliging">
        <p>
          Verwerker treft passende technische en organisatorische maatregelen volgens artikel 32 AVG,
          afgestemd op aard, omvang, context, doelen en risico's. Minimaal gelden, voor zover passend:
        </p>
        <LegalList>
          <li>versleuteling tijdens transport en bij opslag van gevoelige of identificerende gegevens;</li>
          <li>multifactorauthenticatie voor beheer, rollen met minimale rechten en periodieke toegangscontrole;</li>
          <li>logging van beheer- en beveiligingshandelingen, monitoring en bescherming van logbestanden;</li>
          <li>tijdig patch-, kwetsbaarheids-, malware- en configuratiebeheer;</li>
          <li>gescheiden omgevingen, veilige ontwikkel- en wijzigingsprocessen en geen productiegegevens in tests tenzij noodzakelijk en beschermd;</li>
          <li>geteste back-up-, herstel- en continuïteitsmaatregelen;</li>
          <li>periodieke risicoanalyse, penetratie- of beveiligingstests en opvolging van bevindingen;</li>
          <li>procedures voor personeel, apparatuur, fysieke toegang, verwijdering en incidentrespons.</li>
        </LegalList>
        <p>De concrete maatregelen, certificeringen en hersteltermijnen worden in Bijlage 2 opgenomen.</p>
      </LegalSection>

      <LegalSection title="4. Datalekken en beveiligingsincidenten">
        <p>
          Verwerker meldt ieder (vermoedelijk) datalek zonder onredelijke vertraging en uiterlijk binnen
          <strong> 24 uur na ontdekking</strong> via {LEGAL_IDENTITY.email}. De eerste melding bevat voor zover bekend:
          aard, datum en tijd, systemen, categorieën gegevens en betrokkenen, aantallen, vermoedelijke gevolgen,
          genomen maatregelen en contactpersoon. Ontbrekende informatie volgt zonder onnodige vertraging.
        </p>
        <p>
          Verwerker bewaart bewijs, beperkt schade, werkt mee aan onderzoek en verstrekt informatie die De
          Notenman nodig heeft voor de beoordeling en eventuele melding binnen 72 uur. Verwerker meldt niet
          zelfstandig aan betrokkenen of toezichthouder, tenzij wettelijk verplicht; in dat geval wordt De
          Notenman vooraf geïnformeerd voor zover de wet dat toestaat.
        </p>
      </LegalSection>

      <LegalSection title="5. Rechten van betrokkenen en AVG-bijstand">
        <p>
          Een rechtstreeks ontvangen privacyverzoek wordt onmiddellijk en uiterlijk binnen twee werkdagen
          doorgestuurd. Verwerker antwoordt niet zelfstandig, tenzij geïnstrueerd of wettelijk verplicht, en
          verleent tijdig bijstand bij inzage, correctie, verwijdering, beperking, overdraagbaarheid, bezwaar,
          intrekking, informatieplichten, DPIA's, voorafgaande raadpleging en beveiligingsverplichtingen.
        </p>
      </LegalSection>

      <LegalSection title="6. Subverwerkers">
        <p>
          De in Bijlage 3 genoemde subverwerkers zijn algemeen schriftelijk goedgekeurd. Verwerker meldt een
          voorgenomen toevoeging of vervanging minimaal 30 dagen vooraf met naam, locatie, taak en waarborgen.
          De Notenman kan op redelijke privacy- of beveiligingsgronden bezwaar maken. Verwerker legt iedere
          subverwerker minimaal dezelfde verplichtingen op en blijft volledig verantwoordelijk voor diens handelen.
        </p>
      </LegalSection>

      <LegalSection title="7. Internationale doorgifte">
        <p>
          Verwerking buiten de EER is alleen toegestaan na schriftelijke instructie en met een geldige grondslag,
          zoals een adequaatheidsbesluit of toepasselijke EU-modelcontractbepalingen. Verwerker werkt mee aan een
          doorgifterisicobeoordeling, verstrekt informatie over overheidsverzoeken en past waar nodig aanvullende
          maatregelen toe. Wettelijk toegestane betwisting van onevenredige verzoeken wordt benut.
        </p>
      </LegalSection>

      <LegalSection title="8. Informatie, audits en bewijs">
        <p>
          Verwerker houdt aantoonbare documentatie bij en verstrekt jaarlijks of op verzoek relevante onafhankelijke
          auditrapporten en certificaten. De Notenman mag maximaal eenmaal per jaar en daarnaast na een ernstig
          incident of concrete aanwijzing een audit uitvoeren of laten uitvoeren. Audits gebeuren met redelijke
          aankondiging, tijdens kantooruren en zonder onnodige verstoring. Redelijke kosten zijn voor De Notenman,
          behalve wanneer een wezenlijke tekortkoming wordt vastgesteld.
        </p>
      </LegalSection>

      <LegalSection title="9. Verwijdering en teruggave">
        <p>
          Op eerste verzoek en bij einde dienstverlening geeft verwerker gegevens in een gangbaar, bruikbaar formaat
          terug en verwijdert daarna alle kopieën, naar keuze van De Notenman. Verwijdering wordt schriftelijk bevestigd.
          Een wettelijke bewaarplicht wordt gemeld; de betreffende gegevens blijven afgeschermd en worden niet anders
          verwerkt. Back-ups worden bij de eerstvolgende reguliere overschrijving verwijderd en blijven tot die tijd beschermd.
        </p>
      </LegalSection>

      <LegalSection title="10. Aansprakelijkheid, looptijd en beëindiging">
        <p>
          Iedere partij is verantwoordelijk voor haar eigen AVG-verplichtingen. Onderlinge aansprakelijkheid volgt de
          hoofdovereenkomst, maar een beperking geldt niet voor opzet, bewuste roekeloosheid, ongeoorloofd eigen gebruik,
          schending van vertrouwelijkheid of voor zover artikel 82 AVG of ander dwingend recht zich daartegen verzet.
          De Notenman mag verwerking opschorten of de hoofdovereenkomst beëindigen bij een wezenlijke, niet tijdig herstelde
          privacy- of beveiligingstekortkoming.
        </p>
      </LegalSection>

      <LegalSection title="11. Recht en contact">
        <p>
          Nederlands recht is van toepassing. Geschillen worden eerst door de contactpersonen geëscaleerd en daarna
          voorgelegd aan de bevoegde Nederlandse rechter, tenzij dwingend recht anders bepaalt. Privacy- en
          incidentcontact De Notenman: {LEGAL_IDENTITY.email}. Contact verwerker: [invullen].
        </p>
      </LegalSection>

      <LegalSection title="Bijlage 1 – Verwerkingsinstructie">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
            <tbody className="divide-y divide-border">
              <tr><th className="w-1/3 p-3">Dienst en doel</th><td className="p-3">[invullen]</td></tr>
              <tr><th className="p-3">Duur en frequentie</th><td className="p-3">[invullen]</td></tr>
              <tr><th className="p-3">Categorieën betrokkenen</th><td className="p-3">Klanten, nieuwsbriefinschrijvers, leveranciers, medewerkers en/of [aanvullen]</td></tr>
              <tr><th className="p-3">Persoonsgegevens</th><td className="p-3">Contact-, bestel-, adres-, betaalstatus-, communicatie-, apparaat- en/of [aanvullen]</td></tr>
              <tr><th className="p-3">Bijzondere gegevens</th><td className="p-3">Niet beoogd / [indien van toepassing exact invullen]</td></tr>
              <tr><th className="p-3">Bewaar- en verwijdertermijn</th><td className="p-3">[invullen]</td></tr>
              <tr><th className="p-3">Verwerkingslocaties</th><td className="p-3">[land, regio en datacenter invullen]</td></tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="Bijlage 2 – Beveiligingsmaatregelen">
        <p>[Beschrijf concrete maatregelen, versleuteling, rollen, logging, back-up, RTO/RPO, tests, certificeringen en hersteltermijnen.]</p>
      </LegalSection>

      <LegalSection title="Bijlage 3 – Goedgekeurde subverwerkers">
        <p>[Naam, dienst, gegevenscategorieën, land/verwerkingslocatie en doorgiftewaarborg per subverwerker invullen.]</p>
      </LegalSection>

      <LegalSection title="Ondertekening">
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="rounded-card border border-border p-5"><p><strong>De Notenman</strong></p><p className="mt-8">Naam: ____________________</p><p>Functie: __________________</p><p>Datum: ___________________</p><p>Handtekening: _____________</p></div>
          <div className="rounded-card border border-border p-5"><p><strong>Verwerker</strong></p><p className="mt-8">Naam: ____________________</p><p>Functie: __________________</p><p>Datum: ___________________</p><p>Handtekening: _____________</p></div>
        </div>
      </LegalSection>
    </LegalPage>
  );
}
