import { IdentityDetails, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_IDENTITY } from "@/lib/legal";
export function Withdrawal({ locale: _locale }: { locale: string }) {
  return (
    <LegalPage
      title="Herroepingsrecht en modelformulier"
      intro="Gebruik dit formulier als u een consumentenkoop binnen de wettelijke bedenktijd wilt herroepen. Een duidelijke e-mail is ook geldig."
    >
      <LegalSection title="Uw recht in het kort">
        <p>
          U heeft in beginsel 14 dagen vanaf ontvangst om zonder reden te melden dat u de overeenkomst
          herroept. Na die melding heeft u nog 14 dagen om het product terug te sturen. Voor snel
          bederfelijke, geopende hygiëneverzegelde of duidelijk gepersonaliseerde producten kan een
          wettelijke uitzondering gelden. Lees het volledige verzend- en retourbeleid.
        </p>
      </LegalSection>

      <LegalSection title="Modelformulier voor herroeping">
        <div className="rounded-card border-2 border-contrast p-6 leading-loose">
          <p>Aan: De Notenman, {LEGAL_IDENTITY.returnAddress}</p>
          <p>E-mail: {LEGAL_IDENTITY.email}</p>
          <p className="mt-6">Ik deel u hierbij mee dat ik onze overeenkomst betreffende de verkoop van de volgende producten herroep:</p>
          <p className="mt-6">Product(en) en aantal: ______________________________________________</p>
          <p>Bestelnummer: _______________________________________________________</p>
          <p>Besteld op: ____________________ &nbsp; Ontvangen op: ____________________</p>
          <p>Naam consument: ____________________________________________________</p>
          <p>Adres consument: ____________________________________________________</p>
          <p>E-mailadres gebruikt bij bestelling: ____________________________________</p>
          <p className="mt-6">Datum: ________________________</p>
          <p>Handtekening (alleen als dit formulier op papier wordt ingediend):</p>
          <p className="mt-8">_______________________________________________________________</p>
        </div>
        <p>
          Verstuur het ingevulde formulier per e-mail naar {LEGAL_IDENTITY.email} of per post naar het
          gecontroleerde retouradres. Stuur geen betaalkaartgegevens, kopie identiteitsbewijs of andere
          onnodige persoonsgegevens mee.
        </p>
      </LegalSection>

      <LegalSection title="Contactgegevens De Notenman">
        <IdentityDetails />
      </LegalSection>
    </LegalPage>
  );
}
