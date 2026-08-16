import React, { useState } from 'react';
import { Mail, CheckCircle2, X, Send } from 'lucide-react';
import { NutRecommendation } from '../types';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendation: NutRecommendation;
}

export const EmailModal: React.FC<EmailModalProps> = ({
  isOpen,
  onClose,
  recommendation,
}) => {
  const [email, setEmail] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSent, setIsSent] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      alert('Vul een geldig e-mailadres in.');
      return;
    }

    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setIsSent(true);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-montserrat">
      <div className="bg-white rounded-3xl max-w-md w-full border-2 border-[#333333] shadow-[8px_8px_0px_0px_#E0B200] p-6 relative">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#333333] hover:text-[#E0B200] font-bold text-lg p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {isSent ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-14 h-14 bg-[#F6F3EE] text-[#333333] rounded-full flex items-center justify-center mx-auto border-2 border-[#333333]">
              <CheckCircle2 className="w-8 h-8 text-[#E0B200]" />
            </div>
            <h3 className="font-bold uppercase text-xl text-[#333333] font-dosis">
              Notenplan verzonden!
            </h3>
            <p className="text-xs font-medium text-stone-600">
              We hebben een kopie van uw advies <b>'{recommendation.title}'</b> verzonden naar <b>{email}</b>.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2.5 bg-[#333333] text-[#E0B200] font-bold uppercase text-xs rounded-2xl shadow-md cursor-pointer hover:scale-105 border border-[#E0B200] font-dosis"
            >
              Sluiten
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendEmail} className="space-y-4">
            <div className="flex items-center gap-2 text-[#333333]">
              <Mail className="w-5 h-5 text-[#E0B200]" />
              <h3 className="font-bold uppercase text-lg font-dosis">
                Notenplan Exporteren
              </h3>
            </div>

            <p className="text-xs font-medium text-stone-600">
              Vul uw e-mailadres in om het overzicht inclusief ingrediënten, allergiegaranties en serveertips direct te ontvangen.
            </p>

            <div className="bg-[#F6F3EE] p-3 rounded-2xl border-2 border-[#333333] text-xs font-bold text-[#333333]">
              <b>Notenplan:</b> {recommendation.title} (€{recommendation.totalPrice.toFixed(2)})
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#333333] mb-1 font-dosis">
                Uw E-mailadres *
              </label>
              <input
                type="email"
                required
                placeholder="naam@voorbeeld.nl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 rounded-2xl border-2 border-[#333333] bg-[#F6F3EE] text-xs font-medium text-[#333333] outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full py-3.5 rounded-2xl bg-[#333333] hover:bg-[#222222] text-[#E0B200] border border-[#E0B200] font-bold uppercase text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-105 font-dosis"
            >
              {isSending ? (
                <span>Verzenden...</span>
              ) : (
                <>
                  <Send className="w-4 h-4 text-[#E0B200]" />
                  <span>Verstuur Het Notenplan</span>
                </>
              )}
            </button>

            <p className="text-[10px] text-stone-500 text-center">
              Uw e-mailadres wordt uitsluitend gebruikt voor het eenmalig toezenden van deze configuratie conform AVG.
            </p>
          </form>
        )}

      </div>
    </div>
  );
};
