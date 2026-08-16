import React, { useState } from 'react';
import { Search, ShoppingBag, Sparkles, Store } from 'lucide-react';
import { DE_NOTENMAN_PRODUCTS, ALLERGENS_LIST, DIETARY_LIST } from '../data/products';
import { NutProduct, Allergen, DietaryTag, CartItem } from '../types';

interface CatalogViewProps {
  onAddToCart: (items: CartItem[]) => void;
  onOpenAdvisor: () => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({ onAddToCart, onOpenAdvisor }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAllergenFilter, setSelectedAllergenFilter] = useState<string>('none');
  const [selectedDietaryFilter, setSelectedDietaryFilter] = useState<string>('none');
  const [selectedSizes, setSelectedSizes] = useState<Record<string, number>>({});

  const handleSizeChange = (productId: string, size: number) => {
    setSelectedSizes((prev) => ({ ...prev, [productId]: size }));
  };

  const handleAddSingleToCart = (product: NutProduct) => {
    const size = selectedSizes[product.id] || 250;
    let unitPrice = product.pricePer250g;
    if (size === 500) unitPrice = product.pricePer500g;
    if (size === 1000) unitPrice = product.pricePer1000g;

    const cartItem: CartItem = {
      id: `${product.id}-${size}-${Date.now()}`,
      product,
      packageSizeGrams: size,
      quantity: 1,
      unitPrice,
      totalPrice: unitPrice,
    };

    onAddToCart([cartItem]);
  };

  const filteredProducts = DE_NOTENMAN_PRODUCTS.filter((product) => {
    // Search text
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = product.name.toLowerCase().includes(q);
      const matchDesc = product.description.toLowerCase().includes(q);
      const matchCat = product.dutchCategoryName.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchCat) return false;
    }

    // Category
    if (selectedCategory !== 'all' && product.category !== selectedCategory) {
      return false;
    }

    // Allergen to avoid
    if (selectedAllergenFilter !== 'none') {
      if (product.allergens.includes(selectedAllergenFilter as Allergen)) {
        return false;
      }
    }

    // Dietary tag
    if (selectedDietaryFilter !== 'none') {
      if (!product.dietary.includes(selectedDietaryFilter as DietaryTag)) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8 font-montserrat">
      
      {/* Hero Banner for Catalog */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 relative overflow-hidden shadow-[6px_6px_0px_0px_#333333] border-2 border-[#E0B200]">
        <div className="max-w-2xl relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 bg-[#E0B200] text-[#333333] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider font-dosis">
            <Store className="w-3.5 h-3.5 text-[#333333]" />
            <span>Het Notenplan Assortiment</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold uppercase text-[#333333] font-dosis tracking-tight">
            Ambachtelijk Gebrand, Rauw & Luxe Borrelmixen
          </h1>
          <p className="text-sm font-medium text-[#333333]/80 leading-relaxed">
            Blader door ons assortiment. Liever een slimme selectie op maat voor uw borrel, feest of dieetwensen? Gebruik Het Notenplan AI module!
          </p>
          <button
            onClick={onOpenAdvisor}
            className="mt-2 inline-flex items-center gap-2 bg-[#333333] hover:bg-[#222222] text-[#E0B200] px-6 py-3 rounded-2xl text-xs font-bold uppercase transition-all shadow-md hover:scale-105 cursor-pointer font-dosis border border-[#E0B200]"
          >
            <Sparkles className="w-4 h-4 text-[#E0B200]" />
            <span>Open Het Notenplan voor Voorstel op Maat</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-white p-5 rounded-3xl border-2 border-[#333333] shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          
          {/* Search Bar */}
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 text-[#E0B200] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Zoeken op noten, cashews, dadel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-[#333333] bg-[#F6F3EE] text-xs font-medium text-[#333333] focus:ring-2 focus:ring-[#E0B200] outline-none"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full py-2.5 px-3 rounded-2xl border-2 border-[#333333] bg-[#F6F3EE] text-xs font-medium text-[#333333] outline-none"
          >
            <option value="all">Alle Categorieën ({DE_NOTENMAN_PRODUCTS.length})</option>
            <option value="vers-gebrand">Vers Gebrande Noten</option>
            <option value="rauw">Rauwe & Unroasted Noten</option>
            <option value="mixen">Luxe Notenmixen</option>
            <option value="zoutjes-pinda">Zoutjes & Pinda's</option>
            <option value="zuidvruchten">Zuidvruchten & Dadels</option>
            <option value="chocolade-cadeau">Chocolade & Cadeauboxen</option>
          </select>

          {/* Allergen Avoidance */}
          <select
            value={selectedAllergenFilter}
            onChange={(e) => setSelectedAllergenFilter(e.target.value)}
            className="w-full py-2.5 px-3 rounded-2xl border-2 border-[#333333] bg-[#F6F3EE] text-xs font-medium text-[#333333] outline-none"
          >
            <option value="none">Geen allergiefilter (Toon alles)</option>
            {ALLERGENS_LIST.map((a) => (
              <option key={a.id} value={a.id}>
                Vermijd {a.label}
              </option>
            ))}
          </select>

          {/* Dietary Filter */}
          <select
            value={selectedDietaryFilter}
            onChange={(e) => setSelectedDietaryFilter(e.target.value)}
            className="w-full py-2.5 px-3 rounded-2xl border-2 border-[#333333] bg-[#F6F3EE] text-xs font-medium text-[#333333] outline-none"
          >
            <option value="none">Geen dieetfilter</option>
            {DIETARY_LIST.map((d) => (
              <option key={d.id} value={d.id}>
                Uitsluitend {d.label}
              </option>
            ))}
          </select>

        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((product) => {
          const currentSize = selectedSizes[product.id] || 250;
          let currentPrice = product.pricePer250g;
          if (currentSize === 500) currentPrice = product.pricePer500g;
          if (currentSize === 1000) currentPrice = product.pricePer1000g;

          return (
            <div
              key={product.id}
              className="bg-white rounded-3xl border-2 border-[#333333] shadow-[4px_4px_0px_0px_#E0B200] hover:scale-[1.01] transition-all overflow-hidden flex flex-col justify-between group"
            >
              <div>
                {/* Product Image */}
                <div className="relative h-48 overflow-hidden bg-[#F6F3EE] border-b-2 border-[#333333]">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    <span className="bg-[#333333] text-[#F6F3EE] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-dosis">
                      {product.dutchCategoryName}
                    </span>
                    {product.isPopular && (
                      <span className="bg-[#E0B200] text-[#333333] border border-[#333333] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase font-dosis">
                        ★ Bestseller
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-2">
                  <h3 className="font-bold uppercase text-base text-[#333333] font-dosis line-clamp-1">
                    {product.name}
                  </h3>
                  <p className="text-xs text-stone-600 font-medium line-clamp-2 leading-relaxed">
                    {product.description}
                  </p>

                  <div className="text-[11px] text-[#333333]/80 font-medium pt-1">
                    <b>Smaak:</b> {product.tasteProfile}
                  </div>

                  {/* Allergen Badges */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {product.allergens.length === 0 ? (
                      <span className="text-[10px] text-[#333333] bg-[#F6F3EE] px-2 py-0.5 rounded-full border border-[#333333] font-bold">
                        Allergeenvrij
                      </span>
                    ) : (
                      product.allergens.map((alg) => (
                        <span
                          key={alg}
                          className="text-[10px] text-[#333333] bg-[#F6F3EE] border border-[#333333] px-1.5 py-0.5 rounded-md uppercase font-bold"
                        >
                          {alg}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Package Size Picker & Add to Cart */}
              <div className="p-4 pt-0 border-t-2 border-[#F6F3EE] mt-2 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#333333]">
                  <span className="font-dosis uppercase">Verpakking:</span>
                  <div className="flex items-center gap-1 bg-[#F6F3EE] p-1 rounded-xl border border-[#333333]">
                    {[250, 500, 1000].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => handleSizeChange(product.id, sz)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                          currentSize === sz
                            ? 'bg-[#333333] text-[#E0B200]'
                            : 'text-[#333333] hover:bg-stone-200'
                        }`}
                      >
                        {sz === 1000 ? '1kg' : `${sz}g`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-xs text-stone-500 font-medium">Prijs:</span>
                    <div className="text-xl font-extrabold text-[#333333] font-dosis">
                      €{currentPrice.toFixed(2)}
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddSingleToCart(product)}
                    className="flex items-center gap-1.5 bg-[#E0B200] hover:bg-[#d0a500] text-[#333333] border border-[#333333] px-4 py-2 rounded-2xl text-xs font-bold uppercase transition-all shadow-xs cursor-pointer hover:scale-105 font-dosis"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>In Mandje</span>
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="py-16 text-center bg-white rounded-3xl border border-[#333333]">
          <Store className="w-12 h-12 text-[#E0B200] mx-auto mb-3" />
          <h3 className="text-lg font-bold font-dosis text-[#333333] uppercase">
            Geen producten gevonden met de geselecteerde filters
          </h3>
          <p className="text-xs text-stone-600 mt-1">
            Probeer uw zoekopdracht of allergiefilters te versoepelen.
          </p>
        </div>
      )}

    </div>
  );
};
