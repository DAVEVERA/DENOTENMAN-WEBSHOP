import { CookieSettingsButtonInline } from "./CookieSettingsButtonInline";
import { LegalList, LegalPage, LegalSection } from "@/components/legal/LegalPage";
export function CookiePolicy({ locale: _locale }: { locale: string }) {
  return (
    <LegalPage
      title="Cookiebeleid"
      intro="Overzicht van cookies en vergelijkbare lokale opslag op denotenman.com, inclusief doelen, partijen en bewaartermijnen."
    >
      <LegalSection title="1. Wat zijn cookies en vergelijkbare technieken?">
        <p>
          Cookies zijn kleine tekstbestanden die een website op uw apparaat kan plaatsen. Lokale
          opslag werkt vergelijkbaar, maar wordt door de browser bewaard zonder automatisch met elk
          webverzoek te worden meegestuurd. Ook pixels en scripts kunnen informatie over websitegebruik
          verzamelen. In dit beleid noemen we deze technieken samen “cookies”.
        </p>
      </LegalSection>

      <LegalSection title="2. Uw keuze">
        <p>
          Noodzakelijke opslag wordt gebruikt zonder toestemming omdat de webshop anders niet goed
          functioneert. Analytics en marketing worden standaard geblokkeerd en pas geladen na uw actieve
          toestemming. Weigeren is even eenvoudig als accepteren. U kunt uw keuze op ieder moment wijzigen;
          intrekken heeft geen terugwerkende kracht.
        </p>
        <CookieSettingsButtonInline />
      </LegalSection>

      <LegalSection title="3. Noodzakelijke opslag">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
            <thead><tr className="border-b-2 border-border"><th className="p-3">Naam</th><th className="p-3">Techniek/partij</th><th className="p-3">Doel</th><th className="p-3">Termijn</th></tr></thead>
            <tbody className="divide-y divide-border">
              <tr><td className="p-3">denotenman-storefront-v1</td><td className="p-3">Lokale opslag, De Notenman</td><td className="p-3">Winkelwagen en favorieten op dit apparaat</td><td className="p-3">Tot u browsergegevens wist</td></tr>
              <tr><td className="p-3">denotenman-cookie-consent-v1</td><td className="p-3">Lokale opslag, De Notenman</td><td className="p-3">Bewaren en aantonen van uw cookiekeuze</td><td className="p-3">6 maanden</td></tr>
              <tr><td className="p-3">Beveiligde sessie- of previewcookie</td><td className="p-3">De Notenman</td><td className="p-3">Afgeschermde beheer- of previewtoegang; niet voor gewone bezoekers</td><td className="p-3">Sessie of maximaal ingestelde beveiligingstermijn</td></tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="4. Analytics – alleen na toestemming">
        <p>
          Google Analytics meet onder meer bezochte pagina's, globale herkomst, apparaatcategorie en
          interacties. IP-anonimisering wordt aangevraagd. Gegevens worden gebruikt om prestaties en
          gebruiksvriendelijkheid te verbeteren, niet om noodzakelijke webshopfuncties aan te bieden.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
            <thead><tr className="border-b-2 border-border"><th className="p-3">Naam</th><th className="p-3">Partij</th><th className="p-3">Doel</th><th className="p-3">Gebruikelijke maximumtermijn</th></tr></thead>
            <tbody className="divide-y divide-border">
              <tr><td className="p-3">denotenman-product-view-v1:*</td><td className="p-3">Sessieopslag, De Notenman</td><td className="p-3">Voorkomen dat hetzelfde product binnen één browsersessie dubbel wordt geteld; de database bewaart alleen het totaalaantal per product</td><td className="p-3">Browsersessie</td></tr>
              <tr><td className="p-3">_ga en _ga_*</td><td className="p-3">Google Analytics</td><td className="p-3">Bezoeker en sessies onderscheiden</td><td className="p-3">2 jaar</td></tr>
              <tr><td className="p-3">_gid</td><td className="p-3">Google Analytics</td><td className="p-3">Bezoekers onderscheiden</td><td className="p-3">24 uur</td></tr>
              <tr><td className="p-3">_gat*</td><td className="p-3">Google Analytics</td><td className="p-3">Aantal meetverzoeken begrenzen</td><td className="p-3">1 minuut</td></tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="5. Marketing – alleen na toestemming">
        <p>
          Mailchimp Connected Sites en, wanneer actief, Google Ads kunnen campagnebezoek, conversies en
          nieuwsbriefinteracties meten. De exacte namen kunnen door de leverancier veranderen. Typische
          namen zijn <code>_gcl_*</code>, <code>mc_*</code> en <code>MCPopupClosed</code>; opslag kan variëren
          van een sessie tot maximaal 2 jaar. De actuele browseropslag en leveranciersdocumentatie zijn leidend.
        </p>
        <p>
          De cookiebanner geeft analytics en marketing afzonderlijk weer. Toestemming voor de ene categorie
          activeert de andere niet automatisch wanneer u via “Zelf kiezen” uw voorkeuren opslaat.
        </p>
      </LegalSection>

      <LegalSection title="6. Intrekken en verwijderen">
        <LegalList>
          <li>Open “Cookie-instellingen” in de voettekst of op deze pagina.</li>
          <li>Zet analytics en/of marketing uit en sla de keuze op, of kies “Alles weigeren”.</li>
          <li>De webshop verwijdert bekende eigen analytics- en marketingcookies en herlaadt de pagina om scripts te stoppen.</li>
          <li>U kunt daarnaast alle sitegegevens verwijderen via de privacyinstellingen van uw browser.</li>
        </LegalList>
        <p>
          Blokkeren of verwijderen van noodzakelijke lokale opslag kan het winkelmandje, favorieten of een
          beveiligde sessie wissen. De webshop blijft zonder analytics en marketing normaal bruikbaar.
        </p>
      </LegalSection>

      <LegalSection title="7. Leveranciers, doorgifte en wijzigingen">
        <p>
          Google en Mailchimp kunnen gegevens buiten de EER verwerken. De privacyverklaring beschrijft de
          gebruikte doorgiftewaarborgen. Cookiegebruik wordt bij nieuwe scripts of leveranciers opnieuw beoordeeld.
          Dit overzicht wordt bijgewerkt als doelen, namen of termijnen wijzigen. Omdat leveranciers technisch
          wijzigingen kunnen doorvoeren, wordt vóór publicatie en periodiek daarna een cookiescan uitgevoerd.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
