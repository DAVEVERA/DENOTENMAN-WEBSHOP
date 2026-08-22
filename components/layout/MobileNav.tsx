"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ChevronRight,
  Menu,
  Search,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";
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
import { NavbarSearch } from "@/components/layout/NavbarSearch";
import { cn } from "@/lib/cn";
import { useStorefrontState } from "@/lib/storefront-state";

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

const backLabel: Record<Locale, string> = {
  nl: "Terug",
  en: "Back",
  fr: "Retour",
};

const closeSearchLabel: Record<Locale, string> = {
  nl: "Sluit zoeken",
  en: "Close search",
  fr: "Fermer la recherche",
};

const mobileActionClass =
  "relative flex min-h-14 min-w-0 touch-manipulation flex-col items-center justify-center gap-1 px-1 font-heading text-[0.68rem] font-semibold leading-none text-text transition-colors duration-hover-fast hover:bg-background hover:text-accent-hover aria-[expanded=true]:bg-background aria-[expanded=true]:text-accent-hover";

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchPanelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const levelHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousPathnameRef = useRef(pathname);
  const activeCategory = resolveCategoryPath(categories, categoryIds);
  const visibleCategories = activeCategory?.children ?? categories;
  const { cart: cartItems } = useStorefrontState();
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const resetMenu = useCallback(() => {
    setOpen(false);
    setSearchOpen(false);
    setCategoryIds([]);
  }, []);

  const closeMenu = useCallback(() => {
    resetMenu();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [resetMenu]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    window.requestAnimationFrame(() => searchTriggerRef.current?.focus());
  }, []);

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
    if (!open && !searchOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, searchOpen]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && searchOpen) {
        event.preventDefault();
        closeSearch();
        return;
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        closeMenu();
        return;
      }
      const activePanel = searchOpen
        ? searchPanelRef.current
        : open
          ? panelRef.current
          : null;
      if (event.key !== "Tab" || !activePanel) return;
      const focusable = Array.from(
        activePanel.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((element) => {
        const closedDetails = element.closest("details:not([open])");
        return (
          element.getClientRects().length > 0 &&
          (!closedDetails || element.tagName === "SUMMARY")
        );
      });
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
  }, [closeMenu, closeSearch, open, searchOpen]);

  return (
    <>
      <nav
        aria-label={dictionary.nav.mainMenu}
        className="grid w-full grid-cols-4 divide-x divide-border bg-surface xl:hidden"
      >
        <button
          ref={triggerRef}
          type="button"
          aria-label={dictionary.nav.openMenu}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => {
            setSearchOpen(false);
            setOpen(true);
          }}
          className={mobileActionClass}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span>{dictionary.nav.mobileMenu}</span>
        </button>
        <button
          ref={searchTriggerRef}
          type="button"
          aria-label={dictionary.nav.search}
          aria-expanded={searchOpen}
          aria-haspopup="dialog"
          onClick={() => {
            setOpen(false);
            setSearchOpen(true);
          }}
          className={mobileActionClass}
        >
          <Search className="h-5 w-5" aria-hidden="true" />
          <span>{dictionary.nav.search}</span>
        </button>
        <Link href={account(locale)} className={mobileActionClass}>
          <UserRound className="h-5 w-5" aria-hidden="true" />
          <span>{dictionary.nav.account}</span>
        </Link>
        <Link
          href={cart(locale)}
          aria-label={dictionary.nav.cartWithCount.replace("{count}", String(cartCount))}
          className={mobileActionClass}
        >
          <ShoppingCart className="h-5 w-5" aria-hidden="true" />
          {cartCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute right-[calc(50%_-_1.35rem)] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.58rem] font-bold text-contrast"
            >
              {cartCount}
            </span>
          ) : null}
          <span>{dictionary.nav.cart}</span>
        </Link>
      </nav>
      {searchOpen ? createPortal(
        <div className="fixed inset-0 z-[60] xl:hidden">
          <div
            className="absolute inset-0 bg-contrast/50"
            onClick={closeSearch}
            aria-hidden="true"
          />
          <section
            ref={searchPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label={dictionary.nav.search}
            className="absolute left-4 right-4 top-[calc(1rem+env(safe-area-inset-top))] z-10 rounded-panel border border-border bg-surface p-4 shadow-card-hover"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-heading text-heading-sm font-bold">
                {dictionary.nav.search}
              </h2>
              <button
                type="button"
                onClick={closeSearch}
                aria-label={closeSearchLabel[locale]}
                className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full hover:bg-background"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <NavbarSearch
              locale={locale}
              label={dictionary.nav.search}
              placeholder={dictionary.nav.searchPlaceholder}
              mobile
              autoFocus
              onSubmitted={closeSearch}
            />
          </section>
        </div>,
        document.body
      ) : null}
      {open ? createPortal(
        <div className="fixed inset-0 z-[60] xl:hidden">
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
            className="absolute bottom-4 left-4 right-4 top-[calc(4.75rem+env(safe-area-inset-top))] z-10 flex flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-card-hover"
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
        </div>,
        document.body
      ) : null}
    </>
  );
}
