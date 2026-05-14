"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { AdminNav } from "./admin-nav";

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sluit sidebar bij resize naar desktop breedte
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) {
        setSidebarOpen(false);
      }
    }
    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Vergrendel body scroll als sidebar overlay actief is op mobile
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <>
      {/* Mobile overlay-achtergrond */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={() => {
            setSidebarOpen(false);
          }}
        />
      )}

      {/* Desktop sidebar — altijd zichtbaar op md+ */}
      <aside className="admin-sidebar" aria-label="Navigatie" id="admin-sidebar">
        <AdminNav />
      </aside>

      {/* Mobile sidebar — overlay */}
      {sidebarOpen && (
        <aside className="admin-sidebar--open" aria-label="Navigatie" id="admin-sidebar-mobile">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <span className="text-sm font-bold text-neutral-900">Menu</span>
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
              }}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              aria-label="Navigatie sluiten"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <AdminNav
            onNavigate={() => {
              setSidebarOpen(false);
            }}
          />
        </aside>
      )}

      {/* Hoofd-content wrapper */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile topbalk met hamburger */}
        <header className="flex h-14 items-center gap-3 border-b border-neutral-200 bg-white px-4 md:hidden">
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(true);
            }}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            aria-label="Menu openen"
            aria-expanded={sidebarOpen}
            aria-controls="admin-sidebar-mobile"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <span className="text-sm font-bold text-neutral-900">DeNotenman Beheer</span>
        </header>

        <main className="admin-main" id="main-content">
          {children}
        </main>
      </div>
    </>
  );
}
