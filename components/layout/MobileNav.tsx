"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import type nl from "@/dictionaries/nl.json";
import type { MainCategoryDto } from "@/lib/queries";
import type { Locale } from "@/lib/i18n";
import { account, articles, cart, category as categoryPath, categories as categoriesPath, home } from "@/lib/routes";
import { cn } from "@/lib/cn";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";

const focusableSelector =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileNav({
  categories,
  locale,
  dictionary,
  languages,
}: {
  categories: MainCategoryDto[];
  locale: Locale;
  dictionary: typeof nl;
  languages: Partial<Record<Locale, string>>;
}) {
  const [open, setOpen] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (!open) return;
      if (event.key === "Escape") {
        closeMenu();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeMenu, open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={dictionary.nav.openMenu}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 inline-flex h-14 min-w-14 -translate-x-1/2 items-center justify-center rounded-full border border-contrast bg-contrast px-4 text-surface shadow-card-hover lg:hidden"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-contrast/50"
            onClick={closeMenu}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={dictionary.nav.mainMenu}
            className="absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 right-4 max-h-[min(70dvh,36rem)] overflow-y-auto rounded-panel border border-border bg-surface p-5 shadow-card-hover"
          >
            <button
              ref={closeButtonRef}
              type="button"
              aria-label={dictionary.nav.closeMenu}
              onClick={closeMenu}
              className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-text hover:bg-background"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
            <nav className="mt-2 flex flex-col gap-1">
              <a
                href={home(locale)}
                onClick={closeMenu}
                className="min-h-11 rounded-button px-3 py-3 font-heading font-bold hover:bg-background"
              >
                {dictionary.nav.home}
              </a>
              <div>
                <button
                  type="button"
                  aria-expanded={categoriesExpanded}
                  onClick={() => setCategoriesExpanded((value) => !value)}
                  className="flex min-h-11 w-full items-center justify-between rounded-button px-3 py-3 font-heading font-bold hover:bg-background"
                >
                  {dictionary.nav.categories}
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform duration-hover-fast", categoriesExpanded && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
                {categoriesExpanded ? (
                  <ul className="mb-2 ml-3 flex flex-col border-l border-border pl-3">
                    <li>
                      <a
                        href={categoriesPath(locale)}
                        onClick={closeMenu}
                        className="block min-h-11 rounded-button px-3 py-3 font-heading font-semibold hover:bg-background"
                      >
                        {dictionary.nav.categories}
                      </a>
                    </li>
                    {categories.map((item) => (
                      <li key={item.id}>
                        <a
                          href={categoryPath(locale, item.slug)}
                          onClick={closeMenu}
                          className="block min-h-11 rounded-button px-3 py-3 font-heading font-semibold hover:bg-background"
                        >
                          {item.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <a
                href={articles(locale)}
                onClick={closeMenu}
                className="min-h-11 rounded-button px-3 py-3 font-heading font-bold hover:bg-background"
              >
                {dictionary.nav.articles}
              </a>
              <a
                href={cart(locale)}
                onClick={closeMenu}
                className="min-h-11 rounded-button px-3 py-3 font-heading font-bold hover:bg-background"
              >
                {dictionary.nav.cart}
              </a>
              <a
                href={account(locale)}
                onClick={closeMenu}
                className="min-h-11 rounded-button px-3 py-3 font-heading font-bold hover:bg-background"
              >
                {dictionary.nav.account}
              </a>
              <div className="mt-2 border-t border-border px-3 pt-4">
                <LocaleSwitcher currentLocale={locale} languages={languages} />
              </div>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
