import React from 'react';
import { CartItem, SavedConfiguration } from '../types';

interface NavbarProps {
  activeTab: 'wizard' | 'catalog' | 'saved' | 'privacy';
  setActiveTab: (tab: 'wizard' | 'catalog' | 'saved' | 'privacy') => void;
  cartItems: CartItem[];
  savedConfigurations: SavedConfiguration[];
  setIsCartOpen: (open: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  cartItems,
  savedConfigurations,
  setIsCartOpen,
}) => {
  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <header className="sticky top-0 z-40 bg-white text-[#333333] shadow-sm border-b-2 border-[#E0B200]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-2">
          
          {/* Brand Logo & Name */}
          <div 
            onClick={() => setActiveTab('wizard')} 
            className="flex items-center cursor-pointer group"
          >
            <div>
              <span className="font-dosis font-extrabold text-2xl sm:text-3xl tracking-tight uppercase text-[#333333]">
                HET NOTENPLAN
              </span>
            </div>
          </div>

          {/* Center Navigation Links (Removed per focus mode selection) */}

          {/* Right Actions (Cart) */}
          <div className="flex items-center gap-3">
            <button
              id="cart-trigger-btn"
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 bg-[#333333] hover:bg-[#222222] text-[#F6F3EE] px-4 sm:px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm hover:scale-105 transition-all shadow-sm cursor-pointer font-montserrat whitespace-nowrap"
            >
              <span>Winkelmand</span>
              {totalCartCount > 0 && (
                <span className="bg-[#E0B200] text-[#333333] text-xs font-black px-2 py-0.5 rounded-full">
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
