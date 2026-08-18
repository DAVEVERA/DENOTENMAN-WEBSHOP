"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import Link from "next/link";
import type nl from "@/dictionaries/nl.json";
import type { MainCategoryDto } from "@/lib/queries";
import type { NavigationCategoryDto } from "@/lib/categoryGroups";
import type { Locale } from "@/lib/i18n";
import { account, cart, category as categoryPath, categories as categoriesPath, home } from "@/lib/routes";
import { cn } from "@/lib/cn";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { PromotionalCategoryLink } from "@/components/layout/PromotionalCategoryLink";

const focusableSelector =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileNav({
  categories,
  promotional,
  locale,
  dictionary,
  languages,
}: {
  categories: NavigationCategoryDto[];
  promotional?: MainCategoryDto;
  locale: Locale;
  dictionary: typeof nl;
  languages: Partial<Record<Locale, string>>;
}) {
  const [open, setOpen] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => {
    setOpen(false);
    setExpandedCategoryId(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
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
            <nav aria-label={dictionary.nav.mainMenu} className="mt-2 flex flex-col gap-1">
              <Link
                href={home(locale)}
                onClick={closeMenu}
                className="min-h-11 rounded-button px-3 py-3 font-heading font-bold hover:bg-background"
              >
                {dictionary.nav.home}
              </Link>
              <section className="mt-2 border-y border-border py-2" aria-labelledby="mobile-categories-heading">
                <div className="flex min-h-11 items-center justify-between px-3">
                  <h2 id="mobile-categories-heading" className="text-heading-sm font-bold">
                    {dictionary.nav.categories}
                  </h2>
                  <Link
                    href={categoriesPath(locale)}
                    onClick={closeMenu}
                    className="inline-flex min-h-11 items-center rounded-button px-2 py-2 text-body-sm font-semibold text-muted hover:bg-background hover:text-text"
                  >
                    {dictionary.nav.viewAll}
                  </Link>
                </div>
                <ul className="mt-1 flex flex-col">
                  {categories.map((category) => {
                    const expanded = expandedCategoryId === category.id;

                    return (
                      <li key={category.id}>
                        {category.children.length > 0 ? (
                          <>
                            <button
                              type="button"
                              aria-expanded={expanded}
                              aria-controls={`mobile-category-${category.id}`}
                              onClick={() =>
                                setExpandedCategoryId((current) =>
                                  current === category.id ? null : category.id
                                )
                              }
                              className="flex min-h-12 w-full items-center justify-between rounded-button px-3 py-3 text-left font-heading font-bold hover:bg-background"
                            >
                              {category.name}
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 shrink-0 transition-transform duration-hover-fast",
                                  expanded && "rotate-180"
                                )}
                                aria-hidden="true"
                              />
                            </button>
                            {expanded ? (
                              <ul
                                id={`mobile-category-${category.id}`}
                                className="mb-2 ml-3 flex flex-col border-l border-border pl-3"
                              >
                                <li>
                                  <Link
                                    href={categoryPath(locale, category.slug)}
                                    onClick={closeMenu}
                                    className="block min-h-11 rounded-button px-3 py-3 font-heading font-bold text-accent-hover hover:bg-background"
                                  >
                                    {dictionary.nav.viewAllCategory.replace("{category}", category.name)}
                                  </Link>
                                </li>
                                {category.children.map((child) => (
                                  <li key={child.id}>
                                    <Link
                                      href={categoryPath(locale, child.slug)}
                                      onClick={closeMenu}
                                      className="block min-h-11 rounded-button px-3 py-3 font-heading font-semibold hover:bg-background"
                                    >
                                      {child.name}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </>
                        ) : (
                          <Link
                            href={categoryPath(locale, category.slug)}
                            onClick={closeMenu}
                            className="flex min-h-12 items-center rounded-button px-3 py-3 font-heading font-bold hover:bg-background"
                          >
                            {category.name}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {promotional ? (
                  <div className="mt-3 px-2">
                    <PromotionalCategoryLink
                      category={promotional}
                      locale={locale}
                      mobile
                      onClick={closeMenu}
                    />
                  </div>
                ) : null}
              </section>
              <Link
                href={cart(locale)}
                onClick={closeMenu}
                className="min-h-11 rounded-button px-3 py-3 font-heading font-bold hover:bg-background"
              >
                {dictionary.nav.cart}
              </Link>
              <Link
                href={account(locale)}
                onClick={closeMenu}
                className="min-h-11 rounded-button px-3 py-3 font-heading font-bold hover:bg-background"
              >
                {dictionary.nav.account}
              </Link>
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
