import React from 'react';
import { Bookmark, Trash2, ArrowRight, Calendar, Mail, ShoppingBag } from 'lucide-react';
import { SavedConfiguration, NutRecommendation, CartItem } from '../types';
import { DE_NOTENMAN_PRODUCTS } from '../data/products';

interface SavedMixesViewProps {
  savedConfigurations: SavedConfiguration[];
  onSelectSaved: (rec: NutRecommendation) => void;
  onDeleteSaved: (id: string) => void;
  onOpenEmailModal: (rec: NutRecommendation) => void;
  onAddToCart: (items: CartItem[]) => void;
}

export const SavedMixesView: React.FC<SavedMixesViewProps> = ({
  savedConfigurations,
  onSelectSaved,
  onDeleteSaved,
  onOpenEmailModal,
  onAddToCart,
}) => {
  const handleAddToCartAll = (rec: NutRecommendation) => {
    const cartItemsToInsert: CartItem[] = rec.items.map((item) => {
      const prod = item.product || DE_NOTENMAN_PRODUCTS.find((p) => p.id === item.productId)!;
      return {
        id: `${item.productId}-${item.packageSizeGrams}-${Date.now()}`,
        product: prod,
        packageSizeGrams: item.packageSizeGrams,
        quantity: item.packageCount,
        unitPrice: item.pricePerUnit,
        totalPrice: item.subtotalPrice,
        isCustomMix: true,
        mixTitle: rec.title,
      };
    });

    onAddToCart(cartItemsToInsert);
    alert(`Alle ${rec.items.length} artikelen van '${rec.title}' zijn toegevoegd aan uw winkelmandje!`);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6 font-montserrat">
      <div className="flex items-center justify-between pb-4 border-b-2 border-[#333333]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold uppercase text-[#333333] font-dosis flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-[#E0B200]" />
            Mijn Opgeslagen Notenplannen ({savedConfigurations.length})
          </h1>
          <p className="text-xs font-medium text-stone-600 mt-1">
            Bekijk, bewerk, herbestel of exporteer uw eerder opgeslagen notenmixen.
          </p>
        </div>
      </div>

      {savedConfigurations.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border-2 border-[#333333] shadow-[8px_8px_0px_0px_#E0B200] space-y-3">
          <Bookmark className="w-12 h-12 text-[#E0B200] mx-auto" />
          <h3 className="font-bold uppercase text-lg text-[#333333] font-dosis">
            U heeft nog geen opgeslagen notenmixen
          </h3>
          <p className="text-xs font-medium text-stone-600 max-w-md mx-auto">
            Gebruik Het Notenplan AI module om een voorstel op maat te genereren en klik vervolgens op 'Mix Opslaan'.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {savedConfigurations.map((config) => {
            const rec = config.recommendation;

            return (
              <div
                key={config.id}
                className="bg-white rounded-3xl border-2 border-[#333333] shadow-[8px_8px_0px_0px_#E0B200] p-6 space-y-4 transition-all"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b-2 border-[#F6F3EE]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-[#333333] text-[#E0B200] text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full font-dosis">
                        Opgeslagen Notenplan
                      </span>
                      <span className="text-xs font-medium text-stone-500 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#E0B200]" />
                        {new Date(config.savedAt).toLocaleDateString('nl-NL')}
                      </span>
                    </div>
                    <h3 className="font-bold uppercase text-xl text-[#333333] font-dosis mt-1">
                      {rec.title}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-2xl text-[#333333] font-dosis">
                      €{rec.totalPrice.toFixed(2)}
                    </span>
                    <span className="text-xs font-medium text-stone-600 block">
                      {rec.totalWeightGrams}g totaal voor {rec.originalPreferences.peopleCount} pers.
                    </span>
                  </div>
                </div>

                {/* Items summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {rec.items.map((item, idx) => (
                    <div 
                      key={idx}
                      className="bg-[#F6F3EE] p-2.5 rounded-xl border border-[#333333] text-xs flex items-center justify-between"
                    >
                      <span className="font-bold text-[#333333] font-dosis truncate pr-2 uppercase">
                        {item.packageCount}x {item.productName} ({item.packageSizeGrams}g)
                      </span>
                      <span className="font-bold text-[#333333] font-dosis">
                        €{item.subtotalPrice.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Action Toolbar */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#F6F3EE]">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => onSelectSaved(rec)}
                      className="flex items-center gap-1.5 bg-[#333333] hover:bg-[#222222] text-[#E0B200] border border-[#E0B200] px-4 py-2.5 rounded-2xl text-xs font-bold uppercase transition-all shadow-xs cursor-pointer hover:scale-105 font-dosis"
                    >
                      <span>Bekijken & Bewerken</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#E0B200]" />
                    </button>

                    <button
                      onClick={() => handleAddToCartAll(rec)}
                      className="flex items-center gap-1.5 bg-[#E0B200] hover:bg-[#c99f00] text-[#333333] px-4 py-2.5 rounded-2xl text-xs font-bold uppercase transition-all shadow-xs cursor-pointer hover:scale-105 font-dosis"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-[#333333]" />
                      <span>Bestel Alle Artikelen</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenEmailModal(rec)}
                      className="p-2.5 rounded-2xl border-2 border-[#333333] bg-[#F6F3EE] hover:bg-white text-[#333333] text-xs font-bold uppercase flex items-center gap-1 cursor-pointer font-dosis"
                      title="Verstuur e-mail"
                    >
                      <Mail className="w-4 h-4 text-[#E0B200]" />
                      <span className="hidden sm:inline">E-mail</span>
                    </button>

                    <button
                      onClick={() => onDeleteSaved(config.id)}
                      className="p-2.5 rounded-2xl border-2 border-[#333333] bg-stone-100 hover:bg-stone-200 text-[#333333] text-xs font-bold uppercase flex items-center gap-1 cursor-pointer font-dosis"
                      title="Verwijder opgeslagen mix"
                    >
                      <Trash2 className="w-4 h-4 text-stone-600" />
                      <span className="hidden sm:inline">Verwijderen</span>
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
