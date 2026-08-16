import React, { useState } from 'react';
import { UserPreferences, Allergen, DietaryTag } from '../types';
import { ALLERGENS_LIST, DIETARY_LIST, DE_NOTENMAN_PRODUCTS } from '../data/products';

interface AiWizardProps {
  onSubmitPreferences: (preferences: UserPreferences) => void;
  isLoading: boolean;
}

const MIX_OPTIONS = [
  {
    id: 'vers-gebrand-gezouten',
    title: 'Vers Gebrand & Licht Gezouten',
    desc: 'Klassieke warm gebrande pinda’s en noten met zeezout',
  },
  {
    id: 'luxe-ongebrand',
    title: 'Rauw, Puur & Ongebrand',
    desc: 'Ongebrande notenselectie boordevol natuurlijke gezonde vetten',
  },
  {
    id: 'luxe-borrelplank',
    title: 'Luxe Borrelplank Special',
    desc: 'Exclusieve macadamia’s, smokehouse amandelen & pecannoten',
  },
  {
    id: 'zoet-en-hartig',
    title: 'Zoet & Hartig',
    desc: 'Gebrande noten gecombineerd met malse Medjoul dadels & berries',
  },
];

const OCCASIONS = [
  { id: 'borrel', label: 'Borrel & Vrijmibo' },
  { id: 'gezond', label: 'Gezond & Dagelijks' },
  { id: 'feest', label: 'Feestje & Groep' },
  { id: 'cadeau', label: 'Luxe Cadeau' },
];

export const AiWizard: React.FC<AiWizardProps> = ({ onSubmitPreferences, isLoading }) => {
  const [peopleCount, setPeopleCount] = useState<number>(4);
  const [budget, setBudget] = useState<number>(20);
  const [occasion, setOccasion] = useState<string>('borrel');
  const [mixPreference, setMixPreference] = useState<string>('vers-gebrand-gezouten');
  const [allergensToAvoid, setAllergensToAvoid] = useState<Allergen[]>([]);
  const [dietary, setDietary] = useState<DietaryTag[]>([]);
  const [avgConsented, setAvgConsented] = useState<boolean>(true);

  // Automatic budget suggestion when changing people count
  const handlePeopleChange = (newCount: number) => {
    const validCount = Math.max(1, newCount);
    setPeopleCount(validCount);
    // Smooth auto budget calculation ~ €4.50 p.p.
    setBudget(Math.max(12, Math.ceil(validCount * 4.5)));
  };

  const toggleAllergen = (allergen: Allergen) => {
    setAllergensToAvoid((prev) =>
      prev.includes(allergen) ? prev.filter((a) => a !== allergen) : [...prev, allergen]
    );
  };

  const toggleDietary = (tag: DietaryTag) => {
    setDietary((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!avgConsented) {
      alert('Vink a.u.b. het vakje aan voor akkoord met de privacyvoorwaarden.');
      return;
    }
    onSubmitPreferences({
      occasion,
      peopleCount,
      budget,
      mixPreference,
      dietary,
      allergensToAvoid,
      customNotes: '',
      avgConsented,
    });
  };

  // Safe products count check
  const safeProductsCount = DE_NOTENMAN_PRODUCTS.filter((product) => {
    if (allergensToAvoid.length > 0) {
      return !allergensToAvoid.some((a) => product.allergens.includes(a));
    }
    return true;
  }).length;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 font-montserrat">
      
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold uppercase text-[#333333] tracking-tight font-dosis">
          Stel Uw Notenplan Samen
        </h1>
      </div>

      {/* Main Configurator Card */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-10">
        
        {isLoading ? (
          <div className="py-16 text-center space-y-4">
            <div className="w-10 h-10 rounded-full border-3 border-[#333333] border-t-[#E0B200] animate-spin mx-auto"></div>
            <h3 className="text-xl font-bold uppercase text-[#333333] font-dosis">
              Notenplan wordt berekend...
            </h3>
            <p className="text-xs text-stone-500 max-w-xs mx-auto">
              Samenstellen uit dagvers assortiment voor {peopleCount} personen.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">

            {/* Step 1: Gezelschap & Budget */}
            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#333333] font-dosis">
                1. Voor wie is het notenplan?
              </label>

              {/* Occasion buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {OCCASIONS.map((occ) => (
                  <button
                    key={occ.id}
                    type="button"
                    onClick={() => setOccasion(occ.id)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer font-dosis uppercase tracking-wide border ${
                      occasion === occ.id
                        ? 'bg-[#333333] text-[#E0B200] border-[#333333]'
                        : 'bg-[#F9F8F5] text-stone-700 border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    {occ.label}
                  </button>
                ))}
              </div>

              {/* People Counter & Budget */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F9F8F5] p-4 rounded-2xl border border-stone-200">
                
                {/* People stepper */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700">Aantal personen:</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handlePeopleChange(peopleCount - 1)}
                      className="w-8 h-8 rounded-lg bg-white border border-stone-300 font-bold text-sm text-[#333333] hover:bg-stone-100 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-bold text-base text-[#333333] min-w-[20px] text-center">
                      {peopleCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePeopleChange(peopleCount + 1)}
                      className="w-8 h-8 rounded-lg bg-white border border-stone-300 font-bold text-sm text-[#333333] hover:bg-stone-100 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Budget slider */}
                <div>
                  <div className="flex justify-between items-center text-xs font-bold text-stone-700 mb-1">
                    <span>Budget:</span>
                    <span className="text-[#333333] font-extrabold">€{budget.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="2"
                    value={budget}
                    onChange={(e) => setBudget(parseFloat(e.target.value))}
                    className="w-full accent-[#E0B200] h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                  />
                </div>

              </div>
            </div>

            {/* Step 2: Smaakstijl */}
            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#333333] font-dosis">
                2. Welke smaak heeft uw voorkeur?
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MIX_OPTIONS.map((mix) => (
                  <button
                    key={mix.id}
                    type="button"
                    onClick={() => setMixPreference(mix.id)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                      mixPreference === mix.id
                        ? 'border-[#333333] bg-[#333333] text-[#F9F8F5]'
                        : 'border-stone-200 bg-[#F9F8F5] text-[#333333] hover:border-stone-400'
                    }`}
                  >
                    <div className={`font-bold text-xs uppercase font-dosis ${
                      mixPreference === mix.id ? 'text-[#E0B200]' : 'text-[#333333]'
                    }`}>
                      {mix.title}
                    </div>
                    <div className={`text-[11px] mt-1 ${
                      mixPreference === mix.id ? 'text-stone-300' : 'text-stone-500'
                    }`}>
                      {mix.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Allergieën (Discrete clean options) */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#333333] font-dosis">
                3. Allergieën of dieetwensen (optioneel)
              </label>

              {allergensToAvoid.length > 0 && (
                <p className="text-[11px] text-emerald-700 font-medium">
                  ✓ Veilig gefilterd: {safeProductsCount} geschikte noten en mixen beschikbaar.
                </p>
              )}
            </div>

            {/* Footer Submit Bar */}
            <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-xs text-stone-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={avgConsented}
                  onChange={(e) => setAvgConsented(e.target.checked)}
                  className="w-4 h-4 accent-[#E0B200] rounded cursor-pointer"
                />
                <span>Akkoord met privacyvoorwaarden</span>
              </label>

              <button
                id="generate-proposal-btn"
                type="submit"
                disabled={!avgConsented}
                className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl text-xs font-extrabold uppercase tracking-wider transition-all font-dosis cursor-pointer ${
                  avgConsented
                    ? 'bg-[#E0B200] hover:bg-[#d0a500] text-[#333333] hover:scale-102 shadow-sm'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                Stel Mijn Notenplan Samen
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
