import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Download, 
  Mail, 
  Bookmark, 
  RotateCcw, 
  Trash2, 
  Edit3, 
  Plus, 
  Minus, 
  ShieldCheck, 
  CheckCircle2, 
  Scale, 
  ChefHat, 
  Store
} from 'lucide-react';
import { NutRecommendation, RecommendationItem, NutProduct, CartItem } from '../types';
import { DE_NOTENMAN_PRODUCTS } from '../data/products';
import { generateRecommendationPdf } from '../utils/pdfGenerator';

interface RecommendationResultProps {
  recommendation: NutRecommendation;
  onSaveConfiguration: (rec: NutRecommendation) => void;
  onStartOver: () => void;
  onAddToCart: (items: CartItem[]) => void;
  onOpenEmailModal: (rec: NutRecommendation) => void;
}

export const RecommendationResult: React.FC<RecommendationResultProps> = ({
  recommendation,
  onSaveConfiguration,
  onStartOver,
  onAddToCart,
  onOpenEmailModal,
}) => {
  const [activeRec, setActiveRec] = useState<NutRecommendation>(recommendation);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [addedToCartSuccess, setAddedToCartSuccess] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Recalculate totals helper
  const recalculateRecommendation = (items: RecommendationItem[]): NutRecommendation => {
    let totalPrice = 0;
    let totalWeightGrams = 0;

    const updatedItems = items.map((item) => {
      const dbProd = item.product || DE_NOTENMAN_PRODUCTS.find((p) => p.id === item.productId);
      let unitPrice = item.pricePerUnit;
      if (dbProd) {
        if (item.packageSizeGrams === 250) unitPrice = dbProd.pricePer250g;
        if (item.packageSizeGrams === 500) unitPrice = dbProd.pricePer500g;
        if (item.packageSizeGrams === 1000) unitPrice = dbProd.pricePer1000g;
      }

      const subtotal = Number((unitPrice * item.packageCount).toFixed(2));
      const weight = item.packageSizeGrams * item.packageCount;

      totalPrice += subtotal;
      totalWeightGrams += weight;

      return {
        ...item,
        pricePerUnit: unitPrice,
        subtotalPrice: subtotal,
      };
    });

    totalPrice = Number(totalPrice.toFixed(2));
    const budget = activeRec.originalPreferences.budget || 30;
    let budgetStatus: 'within' | 'slightly-over' | 'under' = 'within';
    if (totalPrice > budget + 3) budgetStatus = 'slightly-over';
    else if (totalPrice < budget - 5) budgetStatus = 'under';

    return {
      ...activeRec,
      items: updatedItems,
      totalPrice,
      totalWeightGrams,
      budgetStatus,
    };
  };

  // Item quantity controls
  const handleUpdateQuantity = (productId: string, size: number, delta: number) => {
    const updatedItems = activeRec.items
      .map((item) => {
        if (item.productId === productId && item.packageSizeGrams === size) {
          const newCount = item.packageCount + delta;
          if (newCount <= 0) return null;
          return { ...item, packageCount: newCount };
        }
        return item;
      })
      .filter(Boolean) as RecommendationItem[];

    if (updatedItems.length === 0) {
      alert('Een advies moet minimaal 1 product bevatten.');
      return;
    }

    setActiveRec(recalculateRecommendation(updatedItems));
  };

  const handleRemoveItem = (productId: string, size: number) => {
    const updatedItems = activeRec.items.filter(
      (i) => !(i.productId === productId && i.packageSizeGrams === size)
    );
    if (updatedItems.length === 0) {
      alert('Een advies moet minimaal 1 product bevatten.');
      return;
    }
    setActiveRec(recalculateRecommendation(updatedItems));
  };

  const handleAddProductToRec = (product: NutProduct) => {
    const newItem: RecommendationItem = {
      productId: product.id,
      productName: product.name,
      packageSizeGrams: 250,
      packageCount: 1,
      pricePerUnit: product.pricePer250g,
      subtotalPrice: product.pricePer250g,
      reasoning: 'Door u handmatig toegevoegd aan de selectie.',
      product: product,
    };

    setActiveRec(recalculateRecommendation([...activeRec.items, newItem]));
    setShowAddModal(false);
  };

  const handlePdfExport = async () => {
    setIsPdfGenerating(true);
    try {
      await generateRecommendationPdf('pdf-proposal-container', activeRec);
    } catch (err) {
      console.error(err);
      alert('Er is een probleem opgetreden bij het exporteren van de PDF.');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const handleAddToCartAll = () => {
    const cartItemsToInsert: CartItem[] = activeRec.items.map((item) => {
      const prod = item.product || DE_NOTENMAN_PRODUCTS.find((p) => p.id === item.productId)!;
      return {
        id: `${item.productId}-${item.packageSizeGrams}-${Date.now()}`,
        product: prod,
        packageSizeGrams: item.packageSizeGrams,
        quantity: item.packageCount,
        unitPrice: item.pricePerUnit,
        totalPrice: item.subtotalPrice,
        isCustomMix: true,
        mixTitle: activeRec.title,
      };
    });

    onAddToCart(cartItemsToInsert);
    setAddedToCartSuccess(true);
    setTimeout(() => setAddedToCartSuccess(false), 3500);
  };

  const handleSaveConfig = () => {
    onSaveConfiguration(activeRec);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const budget = activeRec.originalPreferences.budget || 30;
  const budgetPercent = Math.min(100, Math.round((activeRec.totalPrice / budget) * 100));

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6 font-montserrat">
      
      {/* Top Banner Actions & Success Alerts */}
      {savedSuccess && (
        <div className="p-4 bg-[#E0B200]/20 border border-[#333333] text-[#333333] rounded-2xl text-sm font-bold flex items-center justify-between shadow-xs animate-fadeIn">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#E0B200]" />
            Notenplan succesvol opgeslagen in 'Mijn Mixen'!
          </span>
        </div>
      )}

      {addedToCartSuccess && (
        <div className="p-4 bg-[#333333] text-[#F6F3EE] rounded-2xl text-sm font-bold flex items-center justify-between shadow-xs animate-fadeIn">
          <span className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#E0B200]" />
            Alle {activeRec.items.length} notenartikelen uit Het Notenplan toegevoegd aan uw winkelmand!
          </span>
        </div>
      )}

      {/* Main Exportable Container for PDF & Screen */}
      <div 
        id="pdf-proposal-container" 
        className="bg-white rounded-3xl border-2 border-[#E0B200] shadow-[6px_6px_0px_0px_#333333] p-6 sm:p-10 space-y-8"
      >
        
        {/* Brand Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b-2 border-[#E0B200]/30">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-[#333333] text-[#E0B200] text-[11px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider font-dosis">
                100% Het Notenplan Garantiestempel
              </span>
              <span className="text-xs text-stone-500 font-medium">
                {new Date(activeRec.createdAt).toLocaleDateString('nl-NL')}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold uppercase text-[#333333] font-dosis">
              {activeRec.title}
            </h1>
            <p className="text-xs text-[#333333]/80 font-medium mt-0.5">
              Samengesteld voor {activeRec.originalPreferences.peopleCount} personen • Gelegenheid: {activeRec.originalPreferences.occasion}
            </p>
          </div>

          <div className="flex flex-col items-end bg-[#F6F3EE] p-4 rounded-2xl border-2 border-[#333333] w-full sm:w-auto">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#333333] font-dosis">
              Totaalbedrag
            </span>
            <span className="text-3xl font-extrabold text-[#333333] font-dosis">
              €{activeRec.totalPrice.toFixed(2)}
            </span>
            <span className="text-[11px] text-stone-600 font-medium">
              Budget: €{budget.toFixed(2)} ({budgetPercent}% gebruikt)
            </span>
          </div>
        </div>

        {/* Master Roaster Introduction */}
        <div className="bg-[#F6F3EE] text-[#333333] p-6 rounded-2xl border-2 border-[#E0B200] relative overflow-hidden">
          <div className="flex items-start gap-4 z-10 relative">
            <div className="w-12 h-12 rounded-2xl bg-[#E0B200] p-0.5 flex-shrink-0 border border-[#333333]">
              <div className="w-full h-full rounded-xl bg-[#333333] flex items-center justify-center text-[#E0B200]">
                <ChefHat className="w-6 h-6" />
              </div>
            </div>
            <div>
              <h3 className="font-bold uppercase text-lg text-[#333333] font-dosis">
                Het Notenplan AI Advies
              </h3>
              <p className="text-sm font-medium text-[#333333] mt-1 leading-relaxed">
                "{activeRec.introduction}"
              </p>
              <div className="mt-3 pt-2 border-t border-[#333333]/20 text-xs text-[#333333]/90 font-medium flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#E0B200]" />
                <span><b>Portie-Advies:</b> {activeRec.portionAdvice}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dietary & Allergen Safety Guarantees */}
        {activeRec.dietaryGuarantees && activeRec.dietaryGuarantees.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold font-dosis uppercase text-[#333333] mr-1">Veiligheidsgaranties:</span>
            {activeRec.dietaryGuarantees.map((guarantee, idx) => (
              <span 
                key={idx}
                className="bg-[#F6F3EE] text-[#333333] border border-[#333333] font-bold px-3 py-1 rounded-full flex items-center gap-1 uppercase tracking-tight text-[11px]"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#E0B200]" />
                {guarantee}
              </span>
            ))}
          </div>
        )}

        {/* Recommended Items List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold font-dosis text-[#333333] flex items-center gap-2 uppercase">
              <Store className="w-5 h-5 text-[#E0B200]" />
              Aanbevolen Samenstelling ({activeRec.items.length} Artikelen)
            </h3>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#333333] bg-white text-[#333333] text-xs font-bold hover:bg-[#F6F3EE] transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#E0B200]" />
              <span>{isEditing ? 'Aanpassen Voltooien' : 'Mix Bewerken / Aantallen'}</span>
            </button>
          </div>

          <div className="space-y-4">
            {activeRec.items.map((item, idx) => {
              const product = item.product || DE_NOTENMAN_PRODUCTS.find((p) => p.id === item.productId)!;

              return (
                <div 
                  key={`${item.productId}-${item.packageSizeGrams}-${idx}`}
                  className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-[#E0B200] transition-all"
                >
                  <div className="flex items-center gap-4">
                    {product?.imageUrl && (
                      <img 
                        src={product.imageUrl} 
                        alt={item.productName} 
                        className="w-16 h-16 rounded-xl object-cover border border-stone-200 flex-shrink-0"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-[#333333]">
                          {item.productName}
                        </h4>
                        <span className="bg-[#E0B200] text-[#333333] text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {item.packageSizeGrams}g per zak
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1 italic">
                        "{item.reasoning}"
                      </p>
                      
                      {/* Taste Profile badge */}
                      {product?.tasteProfile && (
                        <div className="text-[11px] text-[#333333]/80 font-medium mt-1">
                          <b>Smaak:</b> {product.tasteProfile}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                    
                    {/* Quantity Adjustment Controls if Editing */}
                    {isEditing ? (
                      <div className="flex items-center gap-2 bg-[#F6F3EE] p-1.5 rounded-xl border border-stone-300">
                        <button
                          onClick={() => handleUpdateQuantity(item.productId, item.packageSizeGrams, -1)}
                          className="w-7 h-7 rounded-lg bg-white text-[#333333] font-bold flex items-center justify-center hover:bg-[#E0B200]"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold text-[#333333] px-2">
                          {item.packageCount}x
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.productId, item.packageSizeGrams, 1)}
                          className="w-7 h-7 rounded-lg bg-white text-[#333333] font-bold flex items-center justify-center hover:bg-[#E0B200]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveItem(item.productId, item.packageSizeGrams)}
                          className="w-7 h-7 rounded-lg bg-stone-200 text-[#333333] font-bold flex items-center justify-center hover:bg-stone-300 ml-1"
                          title="Verwijder dit artikel"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs font-medium text-stone-700">
                        {item.packageCount} verpakking(en) × €{item.pricePerUnit.toFixed(2)}
                      </div>
                    )}

                    <div className="text-right">
                      <div className="font-bold font-dosis text-lg text-[#333333]">
                        €{item.subtotalPrice.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-stone-500">
                        ({item.packageSizeGrams * item.packageCount}g totaal)
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* If Editing, show Add Extra Product Button */}
          {isEditing && (
            <div className="mt-4">
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-[#333333] text-[#333333] text-xs font-bold hover:bg-[#F6F3EE] transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4 text-[#E0B200]" />
                <span>Extra Noten of Zuidvrucht toevoegen uit ons Assortiment</span>
              </button>
            </div>
          )}
        </div>

        {/* Summary Footer */}
        <div className="bg-[#F6F3EE] p-5 rounded-2xl border-2 border-[#E0B200] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-[11px] text-[#333333] font-bold uppercase block font-dosis">Totale Grammage</span>
              <span className="font-bold text-lg text-[#333333] font-dosis">
                {activeRec.totalWeightGrams} gram ({(activeRec.totalWeightGrams / 1000).toFixed(2)} kg)
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[#333333] font-bold uppercase block font-dosis">Per Gast (~{activeRec.originalPreferences.peopleCount} pers.)</span>
              <span className="font-bold text-lg text-[#333333] font-dosis">
                ~{(activeRec.totalWeightGrams / activeRec.originalPreferences.peopleCount).toFixed(0)} gram
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-[#333333] font-bold uppercase block font-dosis">Eindbedrag Excl. Verzending</span>
            <span className="font-extrabold text-3xl text-[#333333] font-dosis">
              €{activeRec.totalPrice.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Presentation & Storage Tips Accordion */}
        {activeRec.presentationTips && activeRec.presentationTips.length > 0 && (
          <div className="border-t-2 border-[#E0B200]/30 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#333333] font-dosis mb-2 flex items-center gap-1.5">
              <ChefHat className="w-4 h-4 text-[#E0B200]" />
              Bewaar- & Serveertips:
            </h4>
            <ul className="text-xs text-[#333333] font-medium space-y-1 list-disc list-inside">
              {activeRec.presentationTips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

      </div>

      {/* Action Buttons Toolbar */}
      <div className="bg-[#333333] p-5 rounded-3xl shadow-md border-2 border-[#E0B200] flex flex-wrap items-center justify-between gap-3 text-[#F6F3EE]">
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Add to Cart Primary Button */}
          <button
            id="add-all-to-cart-btn"
            onClick={handleAddToCartAll}
            className="flex items-center gap-2 bg-[#E0B200] hover:bg-[#d0a500] text-[#333333] px-6 py-3.5 rounded-2xl font-extrabold text-sm uppercase transition-all shadow-sm cursor-pointer hover:scale-105 border border-[#333333]"
          >
            <ShoppingBag className="w-5 h-5 text-[#333333]" />
            <span>Voeg Alles Toe aan Winkelmand (€{activeRec.totalPrice.toFixed(2)})</span>
          </button>

          {/* Save Config */}
          <button
            onClick={handleSaveConfig}
            className="flex items-center gap-1.5 bg-[#F6F3EE] text-[#333333] hover:bg-white px-4 py-3.5 rounded-2xl font-bold text-xs uppercase transition-all cursor-pointer"
          >
            <Bookmark className="w-4 h-4 text-[#E0B200]" />
            <span>Mix Opslaan</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* PDF Export */}
          <button
            id="export-pdf-btn"
            onClick={handlePdfExport}
            disabled={isPdfGenerating}
            className="flex items-center gap-1.5 bg-[#F6F3EE] text-[#333333] hover:bg-white px-4 py-3.5 rounded-2xl font-bold text-xs uppercase transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#E0B200]" />
            <span>{isPdfGenerating ? 'PDF Maken...' : 'Exporteer PDF'}</span>
          </button>

          {/* Send Email */}
          <button
            onClick={() => onOpenEmailModal(activeRec)}
            className="flex items-center gap-1.5 bg-[#F6F3EE] text-[#333333] hover:bg-white px-4 py-3.5 rounded-2xl font-bold text-xs uppercase transition-all cursor-pointer"
          >
            <Mail className="w-4 h-4 text-[#E0B200]" />
            <span>Naar E-mail</span>
          </button>

          {/* Start Over */}
          <button
            onClick={onStartOver}
            className="flex items-center gap-1.5 bg-stone-700 hover:bg-stone-600 text-white px-3.5 py-3.5 rounded-2xl font-bold text-xs uppercase transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-[#E0B200]" />
            <span>Opnieuw</span>
          </button>
        </div>

      </div>

      {/* Modal to Add Extra Products from Catalog */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl border-2 border-[#333333]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b">
              <h3 className="font-dosis font-bold text-xl uppercase text-[#333333]">
                Selecteer extra artikel uit het assortiment
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DE_NOTENMAN_PRODUCTS.map((prod) => (
                <div
                  key={prod.id}
                  className="p-3 border rounded-2xl hover:border-[#E0B200] transition-all flex items-center justify-between gap-3 bg-[#F6F3EE]"
                >
                  <div>
                    <div className="font-bold text-xs text-[#333333]">{prod.name}</div>
                    <div className="text-[11px] text-stone-600">€{prod.pricePer250g.toFixed(2)} per 250g</div>
                  </div>
                  <button
                    onClick={() => handleAddProductToRec(prod)}
                    className="bg-[#333333] hover:bg-[#222222] text-[#E0B200] text-xs font-bold px-3 py-1.5 rounded-xl whitespace-nowrap"
                  >
                    + Toevoegen
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
