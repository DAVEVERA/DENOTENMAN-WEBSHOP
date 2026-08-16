import React, { useState } from 'react';
import { 
  CreditCard, 
  CheckCircle2, 
  Lock, 
  Printer
} from 'lucide-react';
import { CartItem, CheckoutFormData } from '../types';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onOrderSuccess: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  onOrderSuccess,
}) => {
  const [formData, setFormData] = useState<CheckoutFormData>({
    fullName: 'Jan van der Meer',
    email: 'jan.vandermeer@example.nl',
    phone: '0612345678',
    address: 'Kerkstraat 42',
    postalCode: '1012 JS',
    city: 'Amsterdam',
    paymentMethod: 'ideal',
    notes: 'Graag bij de buren afleveren als ik er niet ben.',
    agreeTerms: true,
  });

  const [idealBank, setIdealBank] = useState<string>('ing');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderPlaced, setOrderPlaced] = useState<boolean>(false);
  const [orderNumber, setOrderNumber] = useState<string>('');

  if (!isOpen) return null;

  const rawSubtotal = cartItems.reduce((sum, item) => sum + item.totalPrice * item.quantity, 0);
  const shippingCost = rawSubtotal >= 35 ? 0 : 4.95;
  const grandTotal = rawSubtotal + shippingCost;

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agreeTerms) {
      alert('Ga a.u.b. akkoord met de algemene voorwaarden.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const generatedNo = 'NP-' + Math.floor(100000 + Math.random() * 900000);
      setOrderNumber(generatedNo);
      setIsSubmitting(false);
      setOrderPlaced(true);
      onOrderSuccess();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-montserrat">
      <div className="bg-white rounded-3xl max-w-3xl w-full border-2 border-[#333333] shadow-[8px_8px_0px_0px_#E0B200] overflow-hidden my-8">
        
        {/* Header */}
        <div className="bg-[#333333] text-[#F6F3EE] p-5 flex items-center justify-between border-b-2 border-[#E0B200]">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-[#E0B200]" />
            <h2 className="font-bold uppercase text-xl font-dosis">Veilig Afrekenen bij Het Notenplan</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#F6F3EE] hover:text-[#E0B200] font-bold text-xl p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {orderPlaced ? (
          /* Order Placed Success Confirmation Screen */
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-[#F6F3EE] text-[#333333] rounded-full flex items-center justify-center mx-auto text-2xl border-2 border-[#333333]">
              <CheckCircle2 className="w-10 h-10 text-[#E0B200]" />
            </div>

            <div>
              <span className="bg-[#333333] text-[#E0B200] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider font-dosis">
                Bestelling Ontvangen
              </span>
              <h3 className="text-3xl font-extrabold uppercase text-[#333333] mt-2 font-dosis">
                Bedankt voor uw bestelling, {formData.fullName}!
              </h3>
              <p className="text-sm text-[#333333] mt-1 font-medium">
                Bestelnummer: <b className="text-[#333333] font-dosis">{orderNumber}</b>
              </p>
            </div>

            <div className="bg-[#F6F3EE] p-5 rounded-2xl border-2 border-[#333333] text-left text-xs space-y-2 max-w-lg mx-auto text-[#333333] font-medium">
              <div className="font-bold uppercase text-[#333333] border-b-2 border-[#333333]/20 pb-1 font-dosis">
                📦 Bezorginformatie:
              </div>
              <div><b>Adres:</b> {formData.address}, {formData.postalCode} {formData.city}</div>
              <div><b>E-mail:</b> Bevestiging verzonden naar {formData.email}</div>
              <div><b>Verwachte Levering:</b> Morgen vers gebrand thuisbezorgd door PostNL!</div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-4 border-t-2 border-[#F6F3EE]">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-[#F6F3EE] hover:bg-white border-2 border-[#333333] text-[#333333] px-4 py-2.5 rounded-2xl font-bold text-xs uppercase cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[#E0B200]" />
                <span>Print Kwitantie</span>
              </button>

              <button
                onClick={onClose}
                className="flex items-center gap-2 bg-[#333333] hover:bg-[#222222] text-[#E0B200] border border-[#E0B200] px-6 py-2.5 rounded-2xl font-bold text-xs uppercase cursor-pointer hover:scale-105 transition-all font-dosis"
              >
                <span>Terug naar de Webshop</span>
              </button>
            </div>
          </div>
        ) : (
          /* Checkout Form */
          <form onSubmit={handleSubmitOrder} className="p-6 sm:p-8 space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Left Column: Customer Form */}
              <div className="space-y-4">
                <h3 className="font-bold uppercase text-lg text-[#333333] font-dosis pb-2 border-b-2 border-[#F6F3EE]">
                  1. Uw Bezorggegevens
                </h3>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#333333] mb-1 font-dosis">Volledige Naam *</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full p-2.5 rounded-2xl border-2 border-[#333333] bg-[#F6F3EE] text-xs font-medium text-[#333333] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#333333] mb-1 font-dosis">E-mailadres *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full p-2.5 rounded-2xl border-2 border-[#333333] bg-[#F6F3EE] text-xs font-medium text-[#333333] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#333333] mb-1 font-dosis">Telefoonnummer</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full p-2.5 rounded-2xl border-2 border-[#333333] bg-[#F6F3EE] text-xs font-medium text-[#333333] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#333333] mb-1 font-dosis">Straat en Huisnummer *</label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full p-2.5 rounded-2xl border-2 border-[#333333] bg-[#F6F3EE] text-xs font-medium text-[#333333] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#333333] mb-1 font-dosis">Postcode *</label>
                    <input
                      type="text"
                      required
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      className="w-full p-2.5 rounded-2xl border-2 border-[#333333] bg-[#F6F3EE] text-xs font-medium text-[#333333] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#333333] mb-1 font-dosis">Plaats *</label>
                    <input
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full p-2.5 rounded-2xl border-2 border-[#333333] bg-[#F6F3EE] text-xs font-medium text-[#333333] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Payment Method & Order Summary */}
              <div className="space-y-6">
                <h3 className="font-bold uppercase text-lg text-[#333333] font-dosis pb-2 border-b-2 border-[#F6F3EE]">
                  2. Betaalmethode
                </h3>

                <div className="space-y-2.5">
                  <label className={`p-3 rounded-2xl border-2 flex items-center justify-between cursor-pointer text-xs font-bold uppercase transition-all font-dosis ${
                    formData.paymentMethod === 'ideal' ? 'border-[#333333] bg-[#F6F3EE] text-[#333333]' : 'border-stone-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="ideal"
                        checked={formData.paymentMethod === 'ideal'}
                        onChange={() => setFormData({ ...formData, paymentMethod: 'ideal' })}
                        className="accent-[#333333] cursor-pointer"
                      />
                      <span>iDEAL (Nederlands)</span>
                    </div>
                    <span className="text-[10px] bg-[#E0B200] text-[#333333] font-bold px-2 py-0.5 rounded-full">iDEAL</span>
                  </label>

                  {formData.paymentMethod === 'ideal' && (
                    <div className="pl-6">
                      <select
                        value={idealBank}
                        onChange={(e) => setIdealBank(e.target.value)}
                        className="w-full p-2.5 rounded-xl border-2 border-[#333333] bg-[#F6F3EE] text-xs font-bold text-[#333333] outline-none"
                      >
                        <option value="ing">ING Bank</option>
                        <option value="rabobank">Rabobank</option>
                        <option value="abnamro">ABN AMRO</option>
                        <option value="sns">SNS Bank</option>
                        <option value="revolut">Revolut</option>
                        <option value="bunq">Bunq</option>
                      </select>
                    </div>
                  )}

                  <label className={`p-3 rounded-2xl border-2 flex items-center justify-between cursor-pointer text-xs font-bold uppercase transition-all font-dosis ${
                    formData.paymentMethod === 'bancontact' ? 'border-[#333333] bg-[#F6F3EE] text-[#333333]' : 'border-stone-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="bancontact"
                        checked={formData.paymentMethod === 'bancontact'}
                        onChange={() => setFormData({ ...formData, paymentMethod: 'bancontact' })}
                        className="accent-[#333333] cursor-pointer"
                      />
                      <span>Bancontact (België)</span>
                    </div>
                    <span className="text-[10px] bg-[#E0B200] text-[#333333] font-bold px-2 py-0.5 rounded-full">BC</span>
                  </label>

                  <label className={`p-3 rounded-2xl border-2 flex items-center justify-between cursor-pointer text-xs font-bold uppercase transition-all font-dosis ${
                    formData.paymentMethod === 'creditcard' ? 'border-[#333333] bg-[#F6F3EE] text-[#333333]' : 'border-stone-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="creditcard"
                        checked={formData.paymentMethod === 'creditcard'}
                        onChange={() => setFormData({ ...formData, paymentMethod: 'creditcard' })}
                        className="accent-[#333333] cursor-pointer"
                      />
                      <span>Creditcard (Visa / Mastercard)</span>
                    </div>
                    <CreditCard className="w-4 h-4 text-[#E0B200]" />
                  </label>
                </div>

                {/* Order Totals Box */}
                <div className="bg-[#F6F3EE] p-4 rounded-2xl space-y-2 border-2 border-[#333333] text-xs text-[#333333]">
                  <div className="font-bold uppercase border-b-2 border-[#333333]/20 pb-1 text-[#333333] font-dosis">
                    3. Overzicht Bestelling ({cartItems.length} artikelen)
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Artikelen Totaal:</span>
                    <span className="font-bold">€{rawSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Verzendkosten PostNL:</span>
                    <span className="font-bold text-[#333333]">
                      {shippingCost === 0 ? 'GRATIS' : '€4.95'}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-extrabold text-[#333333] pt-2 border-t-2 border-[#333333]/30 font-dosis">
                    <span>Te Betalen Totaal:</span>
                    <span>€{grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="checkout-terms"
                    checked={formData.agreeTerms}
                    onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                    className="mt-1 accent-[#333333] cursor-pointer"
                  />
                  <label htmlFor="checkout-terms" className="text-[11px] text-[#333333] font-medium cursor-pointer">
                    Ik ga akkoord met de algemene leveringsvoorwaarden en herroepingsrecht.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-[#333333] hover:bg-[#222222] text-[#E0B200] border border-[#E0B200] font-bold text-sm uppercase shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-105 font-dosis"
                >
                  {isSubmitting ? (
                    <span>Bestelling Verwerken...</span>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-[#E0B200]" />
                      <span>Bestelling Plaatsen & Betalen (€{grandTotal.toFixed(2)})</span>
                    </>
                  )}
                </button>

              </div>

            </div>

          </form>
        )}

      </div>
    </div>
  );
};
