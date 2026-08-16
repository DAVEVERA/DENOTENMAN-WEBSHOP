import React, { useState } from 'react';
import { ShoppingBag, X, Trash2, Plus, Minus, ArrowRight, Truck, Tag } from 'lucide-react';
import { CartItem } from '../types';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout,
}) => {
  const [couponCode, setCouponCode] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [couponMessage, setCouponMessage] = useState<string>('');

  if (!isOpen) return null;

  const rawSubtotal = cartItems.reduce((sum, item) => sum + item.totalPrice * item.quantity, 0);
  const discountAmount = Number(((rawSubtotal * discountPercent) / 100).toFixed(2));
  const subtotal = Math.max(0, rawSubtotal - discountAmount);

  const freeShippingThreshold = 35;
  const missingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const shippingProgress = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (couponCode.toUpperCase() === 'NOTEN10' || couponCode.toUpperCase() === 'VERS10') {
      setDiscountPercent(10);
      setCouponMessage('10% Introductiekorting toegepast!');
    } else {
      setCouponMessage('Ongeldige kortingscode. Probeer NOTEN10');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-montserrat">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#F6F3EE] shadow-2xl flex flex-col justify-between border-l-4 border-[#333333]">
          
          {/* Header */}
          <div className="p-5 bg-[#333333] text-[#F6F3EE] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5 text-[#E0B200]" />
              <h2 className="font-bold uppercase text-lg font-dosis">Uw Winkelmand</h2>
              <span className="bg-[#E0B200] text-[#333333] text-xs font-bold px-2.5 py-0.5 rounded-full font-dosis">
                {cartItems.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#F6F3EE] hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Free Shipping Progress */}
          <div className="bg-white p-4 border-b-2 border-[#333333] text-xs text-[#333333]">
            <div className="flex items-center justify-between font-bold mb-1.5">
              <span className="flex items-center gap-1.5 text-[#333333]">
                <Truck className="w-4 h-4 text-[#E0B200]" />
                {missingForFreeShipping === 0
                  ? 'Gefeliciteerd! Gratis Verzending Behaald 🎉'
                  : `Nog €${missingForFreeShipping.toFixed(2)} voor Gratis Verzending`}
              </span>
              <span>{shippingProgress}%</span>
            </div>
            <div className="w-full h-2.5 bg-[#F6F3EE] rounded-full overflow-hidden border border-[#333333]">
              <div 
                className="h-full bg-[#E0B200] transition-all duration-300" 
                style={{ width: `${shippingProgress}%` }}
              />
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {cartItems.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <ShoppingBag className="w-12 h-12 text-[#E0B200] mx-auto" />
                <p className="font-bold uppercase text-[#333333] text-lg font-dosis">
                  Uw winkelmand is nog leeg
                </p>
                <p className="text-xs font-medium text-stone-600">
                  Stel uw mix samen met Het Notenplan AI module of kies artikelen uit onze webshop.
                </p>
              </div>
            ) : (
              cartItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-white rounded-2xl border-2 border-[#333333] shadow-xs flex items-center justify-between gap-3"
                >
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    className="w-14 h-14 rounded-xl object-cover border-2 border-[#333333] flex-shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold uppercase text-xs text-[#333333] font-dosis truncate">
                      {item.product.name}
                    </h4>
                    {item.isCustomMix && (
                      <span className="text-[10px] bg-[#E0B200] text-[#333333] border border-[#333333] font-bold px-1.5 py-0.5 rounded-md block w-fit mt-0.5 uppercase">
                        ✨ Het Notenplan
                      </span>
                    )}
                    <div className="text-[11px] text-stone-600 font-medium mt-0.5">
                      Verpakking: {item.packageSizeGrams}g (€{item.unitPrice.toFixed(2)})
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded-lg bg-[#F6F3EE] border border-[#333333] font-bold text-[#333333] hover:bg-[#E0B200] flex items-center justify-center text-xs cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-[#333333] px-1">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded-lg bg-[#F6F3EE] border border-[#333333] font-bold text-[#333333] hover:bg-[#E0B200] flex items-center justify-center text-xs cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end justify-between self-stretch">
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-stone-400 hover:text-stone-900 transition-colors p-1 cursor-pointer"
                      title="Verwijderen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="font-bold text-sm text-[#333333] font-dosis">
                      €{(item.totalPrice * item.quantity).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Subtotal & Checkout Button */}
          {cartItems.length > 0 && (
            <div className="p-5 bg-white border-t-2 border-[#333333] space-y-4">
              
              {/* Coupon input */}
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 text-[#E0B200] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Kortingscode (bijv. NOTEN10)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="w-full pl-8 pr-2 py-2 rounded-xl border-2 border-[#333333] bg-[#F6F3EE] text-xs uppercase font-bold text-[#333333] outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#333333] text-[#E0B200] font-bold text-xs uppercase rounded-xl hover:bg-[#222222] cursor-pointer"
                >
                  Toepassen
                </button>
              </form>
              {couponMessage && (
                <div className={`text-[11px] font-bold uppercase ${discountPercent > 0 ? 'text-[#333333]' : 'text-stone-600'}`}>
                  {couponMessage}
                </div>
              )}

              {/* Price summary */}
              <div className="space-y-1.5 text-xs text-stone-700 font-medium">
                <div className="flex justify-between">
                  <span>Subtotaal:</span>
                  <span className="font-bold text-[#333333]">€{rawSubtotal.toFixed(2)}</span>
                </div>
                {discountPercent > 0 && (
                  <div className="flex justify-between text-[#333333] font-bold">
                    <span>Korting (10%):</span>
                    <span>-€{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Geschatte Verzending:</span>
                  <span className="font-bold text-[#333333]">
                    {missingForFreeShipping === 0 ? 'GRATIS' : '€4.95'}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-extrabold text-[#333333] pt-2 border-t-2 border-[#F6F3EE] font-dosis">
                  <span>Totaal (incl. BTW):</span>
                  <span>€{(subtotal + (missingForFreeShipping === 0 ? 0 : 4.95)).toFixed(2)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <button
                id="proceed-to-checkout-btn"
                onClick={onProceedToCheckout}
                className="w-full py-3.5 rounded-2xl bg-[#333333] hover:bg-[#222222] text-[#E0B200] font-bold uppercase text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer hover:scale-105 border border-[#E0B200] font-dosis"
              >
                <span>Afrekenen & Bestelling Plaatsen</span>
                <ArrowRight className="w-4 h-4 text-[#E0B200]" />
              </button>

              <button
                onClick={onClearCart}
                className="w-full text-center text-xs text-stone-500 hover:text-stone-900 font-bold uppercase py-1 cursor-pointer"
              >
                Winkelmand Leegmaken
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
