"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type nl from "@/dictionaries/nl.json";
import type { MainCategoryDto } from "@/lib/queries";
import type { NavigationCategoryDto } from "@/lib/categoryGroups";
import type { Locale } from "@/lib/i18n";
import {
  account,
  cart,
  category as categoryPath,
  categories as categoriesPath,
  home,
} from "@/lib/routes";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { PromotionalCategoryLink } from "@/components/layout/PromotionalCategoryLink";
import { NativeCategoryLink } from "@/components/layout/NativeCategoryLink";
import { cn } from "@/lib/cn";

const focusableSelector =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const backLabel: Record<Locale, string> = {
  nl: "Terug",
  en: "Back",
  fr: "Retour",
};

export function resolveCategoryPath(
  categories: NavigationCategoryDto[],
  categoryIds: string[]
): NavigationCategoryDto | null {
  let level = categories;
  let current: NavigationCategoryDto | null = null;

  for (const categoryId of categoryIds) {
    current = level.find((category) => category.id === categoryId) ?? null;
    if (!current) return null;
    level = current.children;
  }

  return current;
}

export function MobileCategoryRow({
  category,
  locale,
  submenuLabel,
  emphasized = false,
  onFollow,
  onOpen,
}: {
  category: NavigationCategoryDto;
  locale: Locale;
  submenuLabel: string;
  emphasized?: boolean;
  onFollow: () => void;
  onOpen: () => void;
}) {
  const hasChildren = category.children.length > 0;

  return (
    <li>
      <div className="flex min-h-12 items-stretch">
        <NativeCategoryLink
          href={categoryPath(locale, category.slug)}
          onClick={onFollow}
          className={cn(
            "flex min-h-12 min-w-0 flex-1 touch-manipulation items-center rounded-button px-3 py-3 hover:bg-background",
            emphasized ? "font-heading font-bold" : "font-heading font-semibold"
          )}
        >
          {category.name}
        </NativeCategoryLink>
        {hasChildren ? (
          <button
            type="button"
            aria-label={submenuLabel.replace("{category}", category.name)}
            onClick={onOpen}
            className="flex min-h-12 min-w-12 shrink-0 touch-manipulation items-center justify-center rounded-button hover:bg-background"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </li>
  );
}

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
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const levelHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousPathnameRef = useRef(pathname);
  const activeCategory = resolveCategoryPath(categories, categoryIds);
  const visibleCategories = activeCategory?.children ?? categories;

  const resetMenu = useCallback(() => {
    setOpen(false);
    setCategoryIds([]);
  }, []);

  const closeMenu = useCallback(() => {
    resetMenu();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [resetMenu]);

  const followLink = useCallback(() => {
    resetMenu();
  }, [resetMenu]);

  const setLevel = useCallback((nextCategoryIds: string[]) => {
    setCategoryIds(nextCategoryIds);
    window.requestAnimationFrame(() => levelHeadingRef.current?.focus());
  }, []);

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      resetMenu();
    }
  }, [pathname, resetMenu]);

  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
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
        event.preventDefault();
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
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 inline-flex h-14 min-w-14 -translate-x-1/2 touch-manipulation items-center justify-center rounded-full border border-contrast bg-contrast px-4 text-surface shadow-card-hover lg:hidden"
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
            className="absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 right-4 flex max-h-[min(74dvh,40rem)] flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-card-hover"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <p className="font-heading text-heading-sm font-bold">{dictionary.nav.mainMenu}</p>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label={dictionary.nav.closeMenu}
                onClick={closeMenu}
                className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full text-text hover:bg-background"
              >
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            <nav
              aria-label={dictionary.nav.mainMenu}
              className="min-h-0 flex-1 overflow-y-auto p-4"
            >
              {activeCategory ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setLevel(categoryIds.slice(0, -1))}
                    className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-button px-3 py-2 font-heading text-body-sm font-semibold text-muted hover:bg-background hover:text-text"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    {backLabel[locale]}
                  </button>
                  <h2
                    ref={levelHeadingRef}
                    tabIndex={-1}
                    className="mt-2 px-3 font-heading text-heading-md font-bold outline-none"
                  >
                    {activeCategory.name}
                  </h2>
                  <NativeCategoryLink
                    href={categoryPath(locale, activeCategory.slug)}
                    onClick={followLink}
                    className="mt-2 flex min-h-12 touch-manipulation items-center justify-between rounded-button bg-background px-3 py-3 font-heading font-bold text-accent-hover"
                  >
                    {dictionary.nav.viewAllCategory.replace("{category}", activeCategory.name)}
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </NativeCategoryLink>
                  <ul className="mt-2 flex flex-col">
                    {visibleCategories.map((category) => (
                      <MobileCategoryRow
                        key={category.id}
                        category={category}
                        locale={locale}
                        submenuLabel={dictionary.nav.categoryMenu}
                        onFollow={followLink}
                        onOpen={() => setLevel([...categoryIds, category.id])}
                      />
                    ))}
                  </ul>
                </div>
              ) : (
                <div>
                  <Link
                    href={home(locale)}
                    onClick={followLink}
                    className="flex min-h-12 touch-manipulation items-center rounded-button px-3 py-3 font-heading font-bold hover:bg-background"
                  >
                    {dictionary.nav.home}
                  </Link>
                  <section
                    className="mt-2 border-y border-border py-2"
                    aria-labelledby="mobile-categories-heading"
                  >
                    <div className="flex min-h-12 items-center justify-between gap-3 px-3">
                      <h2
                        ref={levelHeadingRef}
                        id="mobile-categories-heading"
                        tabIndex={-1}
                        className="font-heading text-heading-sm font-bold outline-none"
                      >
                        {dictionary.nav.categories}
                      </h2>
                      <NativeCategoryLink
                        href={categoriesPath(locale)}
                        onClick={followLink}
                        className="inline-flex min-h-11 touch-manipulation items-center rounded-button px-2 py-2 text-body-sm font-semibold text-muted hover:bg-background hover:text-text"
                      >
                        {dictionary.nav.viewAll}
                      </NativeCategoryLink>
                    </div>
                    <ul className="mt-1 flex flex-col">
                      {visibleCategories.map((category) => (
                        <MobileCategoryRow
                          key={category.id}
                          category={category}
                          locale={locale}
                          submenuLabel={dictionary.nav.categoryMenu}
                          emphasized
                          onFollow={followLink}
                          onOpen={() => setLevel([category.id])}
                        />
                      ))}
                    </ul>
                    {promotional ? (
                      <div className="mt-3 px-2">
                        <PromotionalCategoryLink
                          category={promotional}
                          locale={locale}
                          mobile
                          onClick={followLink}
                        />
                      </div>
                    ) : null}
                  </section>
                  <Link
                    href={cart(locale)}
                    onClick={followLink}
                    className="mt-1 flex min-h-12 touch-manipulation items-center rounded-button px-3 py-3 font-heading font-bold hover:bg-background"
                  >
                    {dictionary.nav.cart}
                  </Link>
                  <Link
                    href={account(locale)}
                    onClick={followLink}
                    className="flex min-h-12 touch-manipulation items-center rounded-button px-3 py-3 font-heading font-bold hover:bg-background"
                  >
                    {dictionary.nav.account}
                  </Link>
                  <div className="mt-2 border-t border-border px-3 pt-4">
                    <LocaleSwitcher currentLocale={locale} languages={languages} />
                  </div>
                </div>
              )}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
