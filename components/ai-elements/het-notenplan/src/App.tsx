import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { AiWizard } from './components/AiWizard';
import { RecommendationResult } from './components/RecommendationResult';
import { CatalogView } from './components/CatalogView';
import { SavedMixesView } from './components/SavedMixesView';
import { AvgPrivacyView } from './components/AvgPrivacyView';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { EmailModal } from './components/EmailModal';

import { 
  UserPreferences, 
  NutRecommendation, 
  CartItem, 
  SavedConfiguration 
} from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'wizard' | 'catalog' | 'saved' | 'privacy'>('wizard');
  const [currentRecommendation, setCurrentRecommendation] = useState<NutRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Cart & Saved State persisted in localStorage
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('denotenman_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [savedConfigurations, setSavedConfigurations] = useState<SavedConfiguration[]>(() => {
    try {
      const saved = localStorage.getItem('denotenman_saved_mixes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modal states
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [emailModalRec, setEmailModalRec] = useState<NutRecommendation | null>(null);

  // Save to localStorage when state changes
  useEffect(() => {
    try {
      localStorage.setItem('denotenman_cart', JSON.stringify(cartItems));
    } catch (e) {
      console.error(e);
    }
  }, [cartItems]);

  useEffect(() => {
    try {
      localStorage.setItem('denotenman_saved_mixes', JSON.stringify(savedConfigurations));
    } catch (e) {
      console.error(e);
    }
  }, [savedConfigurations]);

  // Handle AI Recommendation submit
  const handleGenerateProposal = async (preferences: UserPreferences) => {
    setIsLoading(true);
    setCurrentRecommendation(null);

    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Fout bij het genereren van uw notenvoorstel.');
      }

      setCurrentRecommendation(data.recommendation);
    } catch (error: any) {
      console.error('Error generating recommendation:', error);
      alert(error.message || 'Er is een onverwachte fout opgetreden. Probeer het opnieuw.');
    } finally {
      setIsLoading(false);
    }
  };

  // Add items to cart
  const handleAddToCart = (newItems: CartItem[]) => {
    setCartItems((prev) => {
      const updated = [...prev];
      newItems.forEach((newItem) => {
        const existingIndex = updated.findIndex(
          (item) =>
            item.product.id === newItem.product.id &&
            item.packageSizeGrams === newItem.packageSizeGrams
        );

        if (existingIndex > -1) {
          updated[existingIndex].quantity += newItem.quantity;
        } else {
          updated.push(newItem);
        }
      });
      return updated;
    });

    setIsCartOpen(true);
  };

  const handleUpdateCartQuantity = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  // Save Configuration
  const handleSaveConfiguration = (rec: NutRecommendation) => {
    const newConfig: SavedConfiguration = {
      id: rec.id,
      name: rec.title,
      savedAt: new Date().toISOString(),
      recommendation: rec,
    };

    setSavedConfigurations((prev) => [
      newConfig,
      ...prev.filter((c) => c.id !== rec.id),
    ]);
  };

  const handleDeleteSaved = (id: string) => {
    setSavedConfigurations((prev) => prev.filter((c) => c.id !== id));
  };

  const handleClearAllUserData = () => {
    setCartItems([]);
    setSavedConfigurations([]);
    setCurrentRecommendation(null);
    localStorage.removeItem('denotenman_cart');
    localStorage.removeItem('denotenman_saved_mixes');
  };

  return (
    <div className="min-h-screen bg-[#F6F3EE] text-[#333333] font-montserrat flex flex-col justify-between selection:bg-[#E0B200]/30">
      
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        cartItems={cartItems}
        savedConfigurations={savedConfigurations}
        setIsCartOpen={setIsCartOpen}
      />

      {/* Main App View Area */}
      <main className="flex-1 pb-16">
        
        {activeTab === 'wizard' && (
          <div>
            {!currentRecommendation ? (
              <AiWizard
                onSubmitPreferences={handleGenerateProposal}
                isLoading={isLoading}
              />
            ) : (
              <RecommendationResult
                recommendation={currentRecommendation}
                onSaveConfiguration={handleSaveConfiguration}
                onStartOver={() => setCurrentRecommendation(null)}
                onAddToCart={handleAddToCart}
                onOpenEmailModal={(rec) => setEmailModalRec(rec)}
              />
            )}
          </div>
        )}

        {activeTab === 'catalog' && (
          <CatalogView
            onAddToCart={handleAddToCart}
            onOpenAdvisor={() => setActiveTab('wizard')}
          />
        )}

        {activeTab === 'saved' && (
          <SavedMixesView
            savedConfigurations={savedConfigurations}
            onSelectSaved={(rec) => {
              setCurrentRecommendation(rec);
              setActiveTab('wizard');
            }}
            onDeleteSaved={handleDeleteSaved}
            onOpenEmailModal={(rec) => setEmailModalRec(rec)}
            onAddToCart={handleAddToCart}
          />
        )}

        {activeTab === 'privacy' && (
          <AvgPrivacyView onClearAllUserData={handleClearAllUserData} />
        )}

      </main>

      {/* Slide-over Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cartItems}
        onOrderSuccess={() => {
          setCartItems([]);
        }}
      />

      {/* Email Export Modal */}
      {emailModalRec && (
        <EmailModal
          isOpen={!!emailModalRec}
          onClose={() => setEmailModalRec(null)}
          recommendation={emailModalRec}
        />
      )}

    </div>
  );
}
