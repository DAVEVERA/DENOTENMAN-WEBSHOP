import React, { useState } from 'react';
import { ShieldCheck, Lock, Trash2, CheckCircle2, FileText, UserCheck, Database } from 'lucide-react';

interface AvgPrivacyViewProps {
  onClearAllUserData: () => void;
}

export const AvgPrivacyView: React.FC<AvgPrivacyViewProps> = ({ onClearAllUserData }) => {
  const [clearedSuccess, setClearedSuccess] = useState<boolean>(false);

  const handleClear = () => {
    if (confirm('Weet u zeker dat u al uw opgeslagen notenmixen en voorkeuren wilt wissen?')) {
      onClearAllUserData();
      setClearedSuccess(true);
      setTimeout(() => setClearedSuccess(false), 3000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8 font-montserrat">
      
      {/* Header */}
      <div className="bg-[#333333] text-[#F6F3EE] p-8 rounded-3xl border-2 border-[#E0B200] shadow-[8px_8px_0px_0px_#E0B200] space-y-3">
        <div className="inline-flex items-center gap-2 bg-[#F6F3EE] text-[#333333] border-2 border-[#E0B200] text-xs font-bold px-3.5 py-1 rounded-full uppercase tracking-wider font-dosis">
          <ShieldCheck className="w-4 h-4 text-[#E0B200]" />
          <span>AVG & GDPR Compliance Gewaarborgd</span>
        </div>
        <h1 className="text-3xl font-bold uppercase text-[#F6F3EE] font-dosis">
          Privacy- & Klantdatabeleid Het Notenplan
        </h1>
        <p className="text-sm font-medium text-stone-200 leading-relaxed">
          Bij Het Notenplan hechten we de hoogste waarde aan de bescherming van uw persoonsgegevens en dieetvoorkeuren. Onze AI module is ontworpen conform de Algemene Verordening Gegevensbescherming (AVG / GDPR).
        </p>
      </div>

      {clearedSuccess && (
        <div className="p-4 bg-[#F6F3EE] border-2 border-[#333333] text-[#333333] rounded-2xl text-sm font-bold uppercase flex items-center gap-2 font-dosis">
          <CheckCircle2 className="w-5 h-5 text-[#E0B200]" />
          <span>Al uw opgeslagen lokaal bewaarde gegevens zijn definitief gewist.</span>
        </div>
      )}

      {/* AVG Guarantees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="bg-white p-6 rounded-3xl border-2 border-[#333333] shadow-[8px_8px_0px_0px_#E0B200] space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-[#F6F3EE] text-[#333333] border-2 border-[#333333] flex items-center justify-center font-bold mb-3">
            <Lock className="w-5 h-5 text-[#E0B200]" />
          </div>
          <h3 className="font-bold uppercase text-lg text-[#333333] font-dosis">
            1. Geen Onbevoegde Gegevensopslag
          </h3>
          <p className="text-xs font-medium text-stone-600 leading-relaxed">
            Uw geselecteerde allergieën, groepsgrootte en dieetwensen worden uitsluitend gebruikt voor het direct genereren van uw notenvoorstel. Wij verkopen of delen uw gegevens nooit met commerciële derden.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border-2 border-[#333333] shadow-[8px_8px_0px_0px_#E0B200] space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-[#F6F3EE] text-[#333333] border-2 border-[#333333] flex items-center justify-center font-bold mb-3">
            <Database className="w-5 h-5 text-[#E0B200]" />
          </div>
          <h3 className="font-bold uppercase text-lg text-[#333333] font-dosis">
            2. Lokale Verwerking op Uw Apparaat
          </h3>
          <p className="text-xs font-medium text-stone-600 leading-relaxed">
            Opgeslagen notenmixen worden veilig bewaard op uw eigen browser (Local Storage). Dit betekent dat u de volledige controle behoudt over uw eigen opgeslagen voorstellen.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border-2 border-[#333333] shadow-[8px_8px_0px_0px_#E0B200] space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-[#F6F3EE] text-[#333333] border-2 border-[#333333] flex items-center justify-center font-bold mb-3">
            <UserCheck className="w-5 h-5 text-[#E0B200]" />
          </div>
          <h3 className="font-bold uppercase text-lg text-[#333333] font-dosis">
            3. Recht op Inzage & Verwijdering
          </h3>
          <p className="text-xs font-medium text-stone-600 leading-relaxed">
            Overeenkomstig Artikel 17 AVG (Recht op gegevenswissing) heeft u op elk moment het recht om alle opgeslagen gegevens en voorkeuren met één klik te wissen.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border-2 border-[#333333] shadow-[8px_8px_0px_0px_#E0B200] space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-[#F6F3EE] text-[#333333] border-2 border-[#333333] flex items-center justify-center font-bold mb-3">
            <FileText className="w-5 h-5 text-[#E0B200]" />
          </div>
          <h3 className="font-bold uppercase text-lg text-[#333333] font-dosis">
            4. Beveiligde Server-Verbindingen
          </h3>
          <p className="text-xs font-medium text-stone-600 leading-relaxed">
            Verzoeken aan onze server-side AI worden verwerkt via versleutelde HTTPS-verbindingen met de hoogste beveiligingsstandaarden.
          </p>
        </div>

      </div>

      {/* Data Clear Action Box */}
      <div className="bg-[#F6F3EE] p-6 rounded-3xl border-2 border-[#333333] shadow-[8px_8px_0px_0px_#333333] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-bold uppercase text-base text-[#333333] font-dosis">
            Wilt u al uw lokale gegevens wissen?
          </h4>
          <p className="text-xs font-medium text-stone-600 mt-0.5">
            Dit verwijdert al uw opgeslagen notenmixen en opgeslagen instellingen definitief uit deze browser.
          </p>
        </div>

        <button
          onClick={handleClear}
          className="flex items-center gap-2 bg-[#333333] hover:bg-[#222222] text-[#E0B200] border border-[#E0B200] font-bold uppercase text-xs px-5 py-3 rounded-2xl shadow-md transition-all whitespace-nowrap cursor-pointer hover:scale-105 font-dosis"
        >
          <Trash2 className="w-4 h-4 text-[#E0B200]" />
          <span>Wis Al Mijn Opgeslagen Gegevens</span>
        </button>
      </div>

    </div>
  );
};
