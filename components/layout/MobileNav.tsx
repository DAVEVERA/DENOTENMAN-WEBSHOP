"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import type nl from "@/dictionaries/nl.json";
import type { MainCategoryDto } from "@/lib/queries";
import type { Locale } from "@/lib/i18n";
import { account, articles, cart, category as categoryPath, categories as categoriesPath, home } from "@/lib/routes";
import { cn } from "@/lib/cn";

const focusableSelector =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileNav({
  categories,
  locale,
  dictionary,
}: {
  categories: MainCategoryDto[];
  locale: Locale;
  dictionary: typeof nl;
}) {
  const [open, setOpen] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (!open) return;
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
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
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={dictionary.nav.openMenu}
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center text-text lg:hidden"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-contrast/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={dictionary.nav.mainMenu}
            className="absolute right-0 top-0 h-full w-[min(85vw,20rem)] overflow-y-auto bg-surface p-panel shadow-card-hover"
          >
            <button
              ref={closeButtonRef}
              type="button"
              aria-label={dictionary.nav.closeMenu}
              onClick={() => setOpen(false)}
              className="ml-auto flex h-10 w-10 items-center justify-center text-text"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
            <nav className="mt-gap-md flex flex-col gap-gap-md">
              <a href={home(locale)} onClick={() => setOpen(false)}>
                {dictionary.nav.home}
              </a>
              <div>
                <button
                  type="button"
                  aria-expanded={categoriesExpanded}
                  onClick={() => setCategoriesExpanded((value) => !value)}
                  className="flex w-full items-center justify-between"
                >
                  {dictionary.nav.categories}
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform duration-hover-fast", categoriesExpanded && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
                {categoriesExpanded ? (
                  <ul className="mt-gap-sm flex flex-col gap-gap-sm pl-gap-md">
                    <li>
                      <a href={categoriesPath(locale)} onClick={() => setOpen(false)}>
                        {dictionary.nav.categories}
                      </a>
                    </li>
                    {categories.map((item) => (
                      <li key={item.id}>
                        <a href={categoryPath(locale, item.slug)} onClick={() => setOpen(false)}>
                          {item.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <a href={articles(locale)} onClick={() => setOpen(false)}>
                {dictionary.nav.articles}
              </a>
              <a href={cart(locale)} onClick={() => setOpen(false)}>
                {dictionary.nav.cart}
              </a>
              <a href={account(locale)} onClick={() => setOpen(false)}>
                {dictionary.nav.account}
              </a>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
