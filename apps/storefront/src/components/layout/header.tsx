"use client";

import Link from "next/link";
import { useState } from "react";
import { ShoppingBag, Menu, X, Search, User } from "lucide-react";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
      <div className="container-shop">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold tracking-tight text-brand-green-700"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-green text-white text-sm font-black">
              DN
            </span>
            <span className="hidden sm:inline">DeNotenman</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-700">
            <Link href="/categorie/noten" className="transition-colors hover:text-brand-green-600">
              Noten
            </Link>
            <Link
              href="/categorie/gedroogd-fruit-zuidvruchten"
              className="transition-colors hover:text-brand-green-600"
            >
              Zuidvruchten
            </Link>
            <Link
              href="/categorie/pitten-zaden"
              className="transition-colors hover:text-brand-green-600"
            >
              Pitten &amp; Zaden
            </Link>
            <Link
              href="/categorie/natuurvoeding"
              className="transition-colors hover:text-brand-green-600"
            >
              Natuurvoeding
            </Link>
            <Link href="/categorie/snacks" className="transition-colors hover:text-brand-green-600">
              Snacks
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/zoeken"
              className="rounded-full p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-brand-green-600"
              aria-label="Zoeken"
            >
              <Search className="h-5 w-5" />
            </Link>
            <Link
              href="/account/login"
              className="hidden sm:flex rounded-full p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-brand-green-600"
              aria-label="Account"
            >
              <User className="h-5 w-5" />
            </Link>
            <Link
              href="/winkelwagen"
              className="relative rounded-full p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-brand-green-600"
              aria-label="Winkelwagen"
            >
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-green text-[10px] font-bold text-white">
                0
              </span>
            </Link>

            {/* Mobile toggle */}
            <button
              onClick={() => {
                setMobileOpen(!mobileOpen);
              }}
              className="md:hidden rounded-full p-2 text-neutral-600 transition-colors hover:bg-neutral-100"
              aria-label={mobileOpen ? "Menu sluiten" : "Menu openen"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className="border-t border-neutral-100 pb-4 pt-2 md:hidden">
            <ul className="space-y-1">
              {[
                { href: "/categorie/noten", label: "Noten" },
                { href: "/categorie/gedroogd-fruit-zuidvruchten", label: "Zuidvruchten" },
                { href: "/categorie/pitten-zaden", label: "Pitten & Zaden" },
                { href: "/categorie/natuurvoeding", label: "Natuurvoeding" },
                { href: "/categorie/snacks", label: "Snacks" },
                { href: "/account/login", label: "Account" },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      setMobileOpen(false);
                    }}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-brand-green-50 hover:text-brand-green-700"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}
