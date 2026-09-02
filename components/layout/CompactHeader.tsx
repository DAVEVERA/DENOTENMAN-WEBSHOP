"use client";

import {
  ChevronDown,
  Heart,
  Menu,
  Search,
  ShoppingCart,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type nl from "@/dictionaries/nl.json";
import type { NavigationCategoryDto } from "@/lib/categoryGroups";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/i18n";
import { categoryStoryPageKeyByCanonicalSlug, pagePath } from "@/lib/pages";
import {
  account,
  cart as cartPath,
  categories as categoriesPath,
  category as categoryPath,
  home,
} from "@/lib/routes";
import { useStorefrontState } from "@/lib/storefront-state";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { NavbarSearch } from "@/components/layout/NavbarSearch";
import { Logo } from "@/components/ui/Logo";
import styles from "./CompactHeader.module.css";

const moreLabel: Record<Locale, string> = {
  nl: "Meer",
  en: "More",
  fr: "Plus",
};

const serviceLabel: Record<Locale, string> = {
  nl: "Service",
  en: "Service",
  fr: "Services",
};

const categoryColumnLabels: Record<Locale, [string, string]> = {
  nl: ["Soorten", "Meer soorten"],
  en: ["Varieties", "More varieties"],
  fr: ["Variétés", "Plus de variétés"],
};

const nutButterLabel: Record<Locale, string> = {
  nl: "Notenpasta",
  en: "Nut butter",
  fr: "Beurre de noix",
};

type PreviewCategory = Omit<NavigationCategoryDto, "children"> & {
  children: PreviewCategory[];
  previewHref?: string;
};

type SearchSubcategory = {
  key: string;
  label: Record<Locale, string>;
  query?: Record<Locale, string>;
};

const driedFruitSubcategories: SearchSubcategory[] = [
  { key: "dates", label: { nl: "Dadels", en: "Dates", fr: "Dattes" }, query: { nl: "dadels", en: "dates", fr: "dattes" } },
  { key: "figs", label: { nl: "Vijgen", en: "Figs", fr: "Figues" }, query: { nl: "vijgen", en: "figs", fr: "figues" } },
  { key: "raisins", label: { nl: "Rozijnen", en: "Raisins", fr: "Raisins secs" }, query: { nl: "rozijnen", en: "raisins", fr: "raisins" } },
  { key: "apricots", label: { nl: "Abrikozen", en: "Apricots", fr: "Abricots" }, query: { nl: "abrikozen", en: "apricots", fr: "abricots" } },
  { key: "tropical", label: { nl: "Mango & tropisch fruit", en: "Mango & tropical fruit", fr: "Mangue & fruits tropicaux" }, query: { nl: "mango", en: "mango", fr: "mangue" } },
  { key: "all-fruit", label: { nl: "Alle gedroogde vruchten", en: "All dried fruit", fr: "Tous les fruits secs" } },
];

const honeySubcategories: SearchSubcategory[] = [
  { key: "flower-honey", label: { nl: "Bloemenhoning", en: "Flower honey", fr: "Miel de fleurs" }, query: { nl: "bloemenhoning", en: "flower honey", fr: "miel de fleurs" } },
  { key: "liquid-honey", label: { nl: "Vloeibare honing", en: "Liquid honey", fr: "Miel liquide" }, query: { nl: "vloeibaar", en: "liquid", fr: "liquide" } },
  { key: "organic-honey", label: { nl: "Biologische honing", en: "Organic honey", fr: "Miel biologique" }, query: { nl: "biologische", en: "organic", fr: "biologique" } },
  { key: "comb-honey", label: { nl: "Raathoning", en: "Comb honey", fr: "Miel en rayon" }, query: { nl: "raathoning", en: "comb honey", fr: "miel en rayon" } },
  { key: "syrup", label: { nl: "Stroop & siroop", en: "Syrups", fr: "Sirops" }, query: { nl: "siroop", en: "syrup", fr: "sirop" } },
  { key: "all-honey", label: { nl: "Alle honing", en: "All honey", fr: "Tous les miels" } },
];

const nutButterSubcategories: SearchSubcategory[] = [
  { key: "peanut", label: { nl: "Pindakaas", en: "Peanut butter", fr: "Beurre de cacahuète" }, query: { nl: "pindakaas", en: "peanut butter", fr: "beurre de cacahuète" } },
  { key: "almond", label: { nl: "Amandelpasta", en: "Almond butter", fr: "Beurre d’amande" }, query: { nl: "amandelpasta", en: "almond butter", fr: "beurre d’amande" } },
  { key: "hazelnut", label: { nl: "Hazelnootpasta", en: "Hazelnut butter", fr: "Beurre de noisette" }, query: { nl: "hazelnootpasta", en: "hazelnut butter", fr: "beurre de noisette" } },
  { key: "pistachio", label: { nl: "Pistachepasta", en: "Pistachio butter", fr: "Beurre de pistache" }, query: { nl: "pistachepasta", en: "pistachio butter", fr: "beurre de pistache" } },
  { key: "mixed-nut", label: { nl: "Gemengde notenpasta", en: "Mixed nut butter", fr: "Beurre de noix mélangées" }, query: { nl: "gemengde notenpasta", en: "mixed nut butter", fr: "beurre de noix mélangées" } },
  { key: "pecan", label: { nl: "Pecannotenpasta", en: "Pecan butter", fr: "Beurre de noix de pécan" }, query: { nl: "pecannotenpasta", en: "pecan butter", fr: "beurre de noix de pécan" } },
];

const menuItemClass =
  "inline-flex min-h-11 items-center whitespace-nowrap font-heading text-[0.82rem] font-bold text-text transition-colors duration-hover-fast hover:text-accent-ink 2xl:text-[0.88rem]";

const panelLinkClass =
  "flex min-h-11 items-center rounded-lg px-3 py-2 font-body text-body-sm font-semibold text-text transition-colors duration-hover-fast hover:bg-background hover:text-accent-ink focus-visible:bg-background";

function splitColumns<T>(items: T[], columnCount: number): T[][] {
  const safeColumnCount = Math.min(columnCount, items.length);
  if (safeColumnCount === 0) return [];
  const columnSize = Math.ceil(items.length / safeColumnCount);
  return Array.from({ length: safeColumnCount }, (_, index) =>
    items.slice(index * columnSize, (index + 1) * columnSize),
  );
}

function categoryHref(locale: Locale, category: PreviewCategory): string {
  return category.previewHref ?? categoryPath(locale, category.slug);
}

/**
 * Six top-level categories (Noten, Gedroogd fruit, Muesli & Granen,
 * Snacks & Zoutjes, Honing, Notenpasta's) have a dedicated editorial story
 * page. For those, the category NAME link in the header should land on the
 * story page instead of the plain product grid. The chevron dropdown
 * (subcategory links and "view all" links) must keep pointing at the product
 * grid via categoryHref, unchanged.
 */
function categoryPrimaryHref(locale: Locale, category: PreviewCategory): string {
  const storyPageKey = categoryStoryPageKeyByCanonicalSlug[category.canonicalSlug];
  return storyPageKey ? pagePath(storyPageKey, locale) : categoryHref(locale, category);
}

function catalogSearchHref(locale: Locale, categorySlug: string, query: string): string {
  const params = new URLSearchParams({ f: categorySlug, q: query });
  return `${categoriesPath(locale)}?${params.toString()}#product-search`;
}

function withSearchSubcategories(
  category: NavigationCategoryDto,
  definitions: SearchSubcategory[],
  locale: Locale,
): PreviewCategory {
  return {
    ...category,
    children: definitions.map((definition) => ({
      id: `header-filter-${category.canonicalSlug}-${definition.key}`,
      canonicalSlug: `header-filter-${category.canonicalSlug}-${definition.key}`,
      slug: category.slug,
      name: definition.label[locale],
      description: null,
      type: category.type,
      parentId: category.id,
      children: [],
      previewHref: definition.query
        ? catalogSearchHref(locale, category.slug, definition.query[locale])
        : categoryPath(locale, category.slug),
    })),
  };
}

function buildPreviewNavigation(categories: NavigationCategoryDto[], locale: Locale): {
  primary: PreviewCategory[];
  overflow: PreviewCategory[];
} {
  const rootBySlug = new Map(categories.map((category) => [category.canonicalSlug, category]));
  const nature = rootBySlug.get("honing-natuurvoeding");
  const honey = nature?.children.find((category) => category.canonicalSlug === "honing");
  const nutButter = nature?.children.find((category) => category.canonicalSlug === "notenpasta-s");
  const superfood = nature?.children.find((category) => category.canonicalSlug === "superfood");
  const driedFruit = rootBySlug.get("gedroogd-fruit");

  const primary = [
    rootBySlug.get("noten"),
    driedFruit ? withSearchSubcategories(driedFruit, driedFruitSubcategories, locale) : undefined,
    rootBySlug.get("muesli-granen"),
    rootBySlug.get("snacks-zoutjes"),
    honey ? withSearchSubcategories(honey, honeySubcategories, locale) : undefined,
    nutButter
      ? withSearchSubcategories({ ...nutButter, name: nutButterLabel[locale] }, nutButterSubcategories, locale)
      : undefined,
  ].filter((category): category is PreviewCategory => category !== undefined);

  const overflow = [
    rootBySlug.get("chocolade-zoet"),
    rootBySlug.get("pitten-zaden"),
    rootBySlug.get("bakproducten"),
    superfood,
  ].filter((category): category is PreviewCategory => category !== undefined);

  return { primary, overflow };
}

function CountBadge({ count }: { count: number }) {
  if (count < 1) return null;

  return (
    <span
      aria-hidden="true"
      className="absolute right-0 top-0 grid min-h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[0.65rem] font-extrabold leading-none text-contrast"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function CategoryLinks({
  categories,
  locale,
  close,
}: {
  categories: PreviewCategory[];
  locale: Locale;
  close: () => void;
}) {
  return (
    <ul className="space-y-0.5">
      {categories.map((category) => (
        <li key={category.id}>
          <Link
            href={categoryHref(locale, category)}
            onClick={close}
            className={panelLinkClass}
          >
            {category.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CompactHeader({
  categories,
  promotional,
  locale,
  dictionary,
  languages,
}: {
  categories: NavigationCategoryDto[];
  promotional?: NavigationCategoryDto;
  locale: Locale;
  dictionary: typeof nl;
  languages: Partial<Record<Locale, string>>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<string | null>(categories[0]?.id ?? null);
  const headerRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { favorites, cart } = useStorefrontState();
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const { primary: primaryCategories, overflow: overflowCategories } = buildPreviewNavigation(
    categories,
    locale,
  );
  const firstCategory = primaryCategories[0];
  const firstColumns = splitColumns(firstCategory?.children ?? [], 2);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const closePanels = useCallback(() => {
    cancelClose();
    setOpenId(null);
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setOpenId(null), 220);
  }, [cancelClose]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  useEffect(() => {
    if (!openId) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) closePanels();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanels();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closePanels, openId]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLElement>("[data-close-menu]")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <header ref={headerRef} className={styles.header}>
      <div className="mx-auto flex min-h-16 w-full max-w-[96rem] items-center px-4 sm:px-6 xl:grid xl:grid-cols-[10rem_minmax(0,1fr)_minmax(10rem,13rem)_auto] xl:gap-2 xl:px-6">
        <div className="flex w-full items-center justify-between xl:contents">
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={dictionary.nav.openMenu}
            aria-expanded={mobileOpen}
            aria-controls="site-header-mobile-menu"
            onClick={() => setMobileOpen(true)}
            className="-ml-2 inline-grid size-11 place-items-center rounded-lg text-text transition-colors hover:bg-surface hover:text-accent-ink xl:hidden"
          >
            <Menu className="size-6" strokeWidth={1.75} aria-hidden="true" />
          </button>

          <Link
            href={home(locale)}
            aria-label={dictionary.brand.logoWordmarkAlt}
            className="inline-flex min-h-11 min-w-0 items-center"
          >
            <Logo
              alt={{
                mark: dictionary.brand.logoMarkAlt,
                wordmark: dictionary.brand.logoWordmarkAlt,
              }}
              parts="wordmark"
              size="sm"
              className="xl:hidden"
            />
            <Logo
              alt={{
                mark: dictionary.brand.logoMarkAlt,
                wordmark: dictionary.brand.logoWordmarkAlt,
              }}
              parts="wordmark"
              size="lg"
              className="hidden xl:inline-flex [&_[role=img]]:h-10"
            />
          </Link>

          <div className="flex items-center xl:hidden">
            <button
              type="button"
              aria-label={dictionary.nav.search}
              onClick={() => setMobileOpen(true)}
              className="inline-grid size-11 place-items-center rounded-lg text-text transition-colors hover:bg-surface hover:text-accent-ink"
            >
              <Search className="size-[1.3rem]" strokeWidth={1.8} aria-hidden="true" />
            </button>
            <Link
              href={cartPath(locale)}
              aria-label={dictionary.nav.cartWithCount.replace("{count}", String(cartCount))}
              className="relative inline-grid size-11 place-items-center rounded-lg text-text transition-colors hover:bg-surface hover:text-accent-ink"
            >
              <ShoppingCart className="size-[1.3rem]" strokeWidth={1.8} aria-hidden="true" />
              <CountBadge count={cartCount} />
            </Link>
          </div>
        </div>

        <nav aria-label={dictionary.nav.mainMenu} className="hidden min-w-0 xl:block">
          <ul className="flex min-w-0 items-center justify-center gap-0.5">
            {primaryCategories.map((category) => {
              const hasChildren = category.children.length > 0;
              const isOpen = openId === category.id;

              return (
                <li
                  key={category.id}
                    className="relative flex h-16 min-w-0 items-center"
                  onPointerEnter={(event) => {
                    if (!hasChildren || event.pointerType === "touch") return;
                    cancelClose();
                    setOpenId(category.id);
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType !== "touch") scheduleClose();
                  }}
                >
                  <Link
                    id={`site-header-category-${category.id}`}
                    href={categoryPrimaryHref(locale, category)}
                    onClick={closePanels}
                    className={cn(menuItemClass, hasChildren ? "pl-1.5 pr-0" : "px-1.5")}
                  >
                    {category.name}
                  </Link>
                  {hasChildren ? (
                    <button
                      type="button"
                      aria-label={dictionary.nav.categoryMenu.replace("{category}", category.name)}
                      aria-expanded={isOpen}
                      aria-controls={`site-header-panel-${category.id}`}
                      onClick={() => setOpenId(isOpen ? null : category.id)}
                      className="inline-grid size-9 shrink-0 place-items-center rounded-lg text-text transition-colors hover:bg-surface hover:text-accent-ink"
                    >
                      <ChevronDown
                        className={cn("size-3.5 transition-transform", isOpen && "rotate-180")}
                        aria-hidden="true"
                      />
                    </button>
                  ) : null}

                  {hasChildren && isOpen ? (
                    <div
                      id={`site-header-panel-${category.id}`}
                      role="region"
                      aria-labelledby={`site-header-category-${category.id}`}
                      className={cn(styles.panel, category.children.length > 6 ? styles.megaPanel : styles.dropdownPanel)}
                      onPointerEnter={cancelClose}
                      onPointerLeave={scheduleClose}
                    >
                      <div className={cn("p-2.5", category.children.length > 6 && "grid grid-cols-2 gap-x-2")}>
                        {category.children.length > 6
                          ? firstColumns.map((column, columnIndex) => (
                            <div key={columnIndex}>
                              <p className="mb-1 px-3 pt-1 font-heading text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted">
                                {categoryColumnLabels[locale][columnIndex]}
                              </p>
                              <CategoryLinks categories={column} locale={locale} close={closePanels} />
                            </div>
                          ))
                          : <CategoryLinks categories={category.children} locale={locale} close={closePanels} />}
                        <div className={cn("mt-1 border-t border-border pt-1", category.children.length > 6 && "col-span-2")}>
                          <Link
                            href={categoryHref(locale, category)}
                            onClick={closePanels}
                            className={panelLinkClass}
                          >
                            {dictionary.nav.viewAllCategory.replace("{category}", category.name)}
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}

            {overflowCategories.length > 0 ? (
              <li
                className="relative flex h-16 items-center"
                onPointerEnter={(event) => {
                  if (event.pointerType === "touch") return;
                  cancelClose();
                  setOpenId("more");
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType !== "touch") scheduleClose();
                }}
              >
                <Link href={categoriesPath(locale)} className={cn(menuItemClass, "pl-1.5 pr-0") }>
                  {moreLabel[locale]}
                </Link>
                <button
                  type="button"
                  aria-label={`${moreLabel[locale]} ${dictionary.nav.categories}`}
                  aria-expanded={openId === "more"}
                  aria-controls="site-header-panel-more"
                  onClick={() => setOpenId(openId === "more" ? null : "more")}
                  className="inline-grid size-9 place-items-center rounded-lg text-text transition-colors hover:bg-surface hover:text-accent-ink"
                >
                  <ChevronDown
                    className={cn("size-3.5 transition-transform", openId === "more" && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
                {openId === "more" ? (
                  <div
                    id="site-header-panel-more"
                    role="region"
                    className={cn(styles.panel, styles.morePanel)}
                    onPointerEnter={cancelClose}
                    onPointerLeave={scheduleClose}
                  >
                    <div className="grid grid-cols-2 gap-x-5 gap-y-2 p-4">
                      {overflowCategories.map((category) => (
                        <div key={category.id} className="min-w-0">
                          <Link
                            href={categoryHref(locale, category)}
                            onClick={closePanels}
                            className="inline-flex min-h-11 items-center font-heading font-bold text-text hover:text-accent-ink"
                          >
                            {category.name}
                          </Link>
                          {category.canonicalSlug !== "bakproducten" && category.children.length > 0 ? (
                            <CategoryLinks
                              categories={category.children}
                              locale={locale}
                              close={closePanels}
                            />
                          ) : null}
                        </div>
                      ))}
                      <div className="rounded-xl bg-background p-3">
                        <p className="font-heading text-xs font-bold uppercase tracking-[0.12em] text-muted">
                          {serviceLabel[locale]}
                        </p>
                        <ul className="mt-2 space-y-0.5">
                          <li>
                            <Link href={pagePath("faq", locale)} className={panelLinkClass}>
                              {dictionary.nav.customerService}
                            </Link>
                          </li>
                          <li>
                            <Link href={pagePath("markets", locale)} className={panelLinkClass}>
                              {dictionary.nav.whereIsNotenman}
                            </Link>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            ) : null}

            {promotional ? (
              <li className="ml-0.5">
                <Link
                  href={categoryPath(locale, promotional.slug)}
                  className="inline-flex min-h-10 items-center rounded-full bg-accent px-3 font-heading text-[0.8rem] font-extrabold text-contrast shadow-button transition-transform hover:-translate-y-0.5"
                >
                  {promotional.name}
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>

        <div className="hidden min-w-0 xl:block">
          <NavbarSearch
            locale={locale}
            label={dictionary.nav.search}
            placeholder={dictionary.nav.search}
          />
        </div>

        <div className="hidden items-center justify-end gap-0.5 xl:flex">
          <LocaleSwitcher currentLocale={locale} languages={languages} />
          <Link
            href={`${account(locale)}#favorites-title`}
            aria-label={dictionary.nav.favoritesWithCount.replace("{count}", String(favorites.length))}
            className="relative inline-grid size-11 place-items-center rounded-lg text-text transition-colors hover:bg-surface hover:text-accent-ink"
          >
            <Heart className="size-5" strokeWidth={1.8} aria-hidden="true" />
            <CountBadge count={favorites.length} />
          </Link>
          <Link
            href={cartPath(locale)}
            aria-label={dictionary.nav.cartWithCount.replace("{count}", String(cartCount))}
            className="relative inline-grid size-11 place-items-center rounded-lg text-text transition-colors hover:bg-surface hover:text-accent-ink"
          >
            <ShoppingCart className="size-5" strokeWidth={1.8} aria-hidden="true" />
            <CountBadge count={cartCount} />
          </Link>
        </div>
      </div>

      {mobileOpen && typeof document !== "undefined"
        ? createPortal(
          <div
          ref={sheetRef}
            id="site-header-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label={dictionary.nav.mainMenu}
          className={cn(styles.sheet, "xl:hidden")}
        >
          <div className="flex min-h-16 items-center justify-between border-b border-border px-4">
            <Logo
              alt={{
                mark: dictionary.brand.logoMarkAlt,
                wordmark: dictionary.brand.logoWordmarkAlt,
              }}
              parts="wordmark"
              size="sm"
            />
            <button
              data-close-menu
              type="button"
              aria-label={dictionary.nav.closeMenu}
              onClick={closeMobile}
              className="-mr-2 inline-grid size-11 place-items-center rounded-lg text-text hover:bg-surface"
            >
              <X className="size-6" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>

          <div className="border-b border-border px-4 py-3">
            <NavbarSearch
              locale={locale}
              label={dictionary.nav.search}
              placeholder={dictionary.nav.searchPlaceholder}
              mobile
              onSubmitted={closeMobile}
            />
          </div>

          <nav className="flex-1 overflow-y-auto px-4 pb-8" aria-label={dictionary.nav.categories}>
            <ul className="divide-y divide-border">
              {primaryCategories.map((category) => {
                const hasChildren = category.children.length > 0;
                const expanded = mobileSection === category.id;

                return (
                  <li key={category.id}>
                    <div className="flex min-h-14 items-center">
                      <Link
                        href={categoryPrimaryHref(locale, category)}
                        onClick={closeMobile}
                        className="flex min-h-14 min-w-0 flex-1 items-center font-heading text-[1.05rem] font-bold text-text"
                      >
                        {category.name}
                      </Link>
                      {hasChildren ? (
                        <button
                          type="button"
                          aria-label={dictionary.nav.categoryMenu.replace("{category}", category.name)}
                          aria-expanded={expanded}
                          aria-controls={`site-header-mobile-${category.id}`}
                          onClick={() => setMobileSection(expanded ? null : category.id)}
                          className="inline-grid size-12 place-items-center rounded-lg text-muted hover:bg-surface hover:text-text"
                        >
                          <ChevronDown
                            className={cn("size-5 transition-transform", expanded && "rotate-180")}
                            aria-hidden="true"
                          />
                        </button>
                      ) : null}
                    </div>
                    {hasChildren && expanded ? (
                      <div id={`site-header-mobile-${category.id}`} className="pb-3 pl-2">
                        <CategoryLinks
                          categories={category.children}
                          locale={locale}
                          close={closeMobile}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
              <li>
                <div className="flex min-h-14 items-center">
                  <Link
                    href={categoriesPath(locale)}
                    onClick={closeMobile}
                    className="flex min-h-14 min-w-0 flex-1 items-center font-heading text-[1.05rem] font-bold text-text"
                  >
                    {moreLabel[locale]}
                  </Link>
                  <button
                    type="button"
                    aria-label={`${moreLabel[locale]} ${dictionary.nav.categories}`}
                    aria-expanded={mobileSection === "more"}
                    aria-controls="site-header-mobile-more"
                    onClick={() => setMobileSection(mobileSection === "more" ? null : "more")}
                    className="inline-grid size-12 place-items-center rounded-lg text-muted hover:bg-surface hover:text-text"
                  >
                    <ChevronDown
                      className={cn("size-5 transition-transform", mobileSection === "more" && "rotate-180")}
                      aria-hidden="true"
                    />
                  </button>
                </div>
                {mobileSection === "more" ? (
                  <div id="site-header-mobile-more" className="pb-3 pl-2">
                    <CategoryLinks categories={overflowCategories} locale={locale} close={closeMobile} />
                  </div>
                ) : null}
              </li>
            </ul>

            {promotional ? (
              <Link
                href={categoryPath(locale, promotional.slug)}
                onClick={closeMobile}
                className="mt-5 flex min-h-12 items-center justify-center rounded-full bg-accent px-5 font-heading font-extrabold text-contrast shadow-button"
              >
                {promotional.name}
              </Link>
            ) : null}

            <div className="mt-6 grid gap-1 border-t border-border pt-4">
              <Link href={pagePath("faq", locale)} onClick={closeMobile} className={panelLinkClass}>
                {dictionary.nav.customerService}
              </Link>
              <Link href={pagePath("markets", locale)} onClick={closeMobile} className={panelLinkClass}>
                {dictionary.nav.whereIsNotenman}
              </Link>
              <div className="mt-2 px-3">
                <LocaleSwitcher currentLocale={locale} languages={languages} />
              </div>
            </div>
          </nav>
          </div>,
          document.body,
        )
        : null}
    </header>
  );
}
