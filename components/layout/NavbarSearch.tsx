"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { home } from "@/lib/routes";

export const CATALOG_SEARCH_EVENT = "notenman:catalog-search";

type CatalogSearchEvent = CustomEvent<{ query: string }>;

export function NavbarSearch({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const compactInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [compactOpen, setCompactOpen] = useState(false);

  useEffect(() => {
    const syncFromUrl = () => {
      setQuery(new URLSearchParams(window.location.search).get("q") ?? "");
    };

    const syncFromCatalog = (event: Event) => {
      setQuery((event as CatalogSearchEvent).detail.query);
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener(CATALOG_SEARCH_EVENT, syncFromCatalog);

    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener(CATALOG_SEARCH_EVENT, syncFromCatalog);
    };
  }, []);

  useEffect(() => {
    if (!compactOpen) return;

    compactInputRef.current?.focus();

    const dismissOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setCompactOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCompactOpen(false);
    };

    document.addEventListener("pointerdown", dismissOnOutsideClick);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOnOutsideClick);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [compactOpen]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const destination = home(locale);
    const normalizedQuery = query.trim();
    const params = pathname === destination
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    } else {
      params.delete("q");
    }

    const queryString = params.toString();
    const href = `${destination}${queryString ? `?${queryString}` : ""}#product-search`;

    window.dispatchEvent(
      new CustomEvent(CATALOG_SEARCH_EVENT, { detail: { query: normalizedQuery } })
    );
    setCompactOpen(false);

    if (pathname === destination) {
      router.push(href, { scroll: false });
      requestAnimationFrame(() => {
        document.getElementById("product-search")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      return;
    }

    router.push(href);
  }

  const inputClasses =
    "h-10 min-w-0 flex-1 bg-transparent pl-3 pr-1 font-heading text-body-sm text-text placeholder:text-muted focus:outline-none";
  const submitClasses =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-button bg-accent text-contrast transition-colors duration-hover-fast hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <div
      ref={rootRef}
      className="absolute right-8 top-1/2 z-20 hidden -translate-y-1/2 min-[1440px]:block"
    >
      <form
        role="search"
        aria-label={label}
        onSubmit={submitSearch}
        className="hidden h-10 w-60 items-center rounded-button border border-border bg-background shadow-card transition-colors focus-within:border-accent min-[1760px]:flex"
      >
        <label htmlFor="navbar-search-wide" className="sr-only">
          {label}
        </label>
        <input
          id="navbar-search-wide"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={label}
          className={inputClasses}
        />
        <button type="submit" aria-label={label} className={submitClasses}>
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>

      <div className="min-[1760px]:hidden">
        <button
          type="button"
          aria-label={label}
          aria-expanded={compactOpen}
          aria-controls="navbar-search-compact"
          onClick={() => setCompactOpen((open) => !open)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-button border border-border bg-background text-text shadow-card transition-colors duration-hover-fast hover:border-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {compactOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Search className="h-5 w-5" aria-hidden="true" />
          )}
        </button>

        {compactOpen ? (
          <form
            id="navbar-search-compact"
            role="search"
            aria-label={label}
            onSubmit={submitSearch}
            className="absolute right-0 top-[calc(100%+0.65rem)] flex h-12 w-72 items-center rounded-button border border-border bg-surface p-1 shadow-card-hover"
          >
            <label htmlFor="navbar-search-compact-input" className="sr-only">
              {label}
            </label>
            <input
              ref={compactInputRef}
              id="navbar-search-compact-input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={label}
              className={inputClasses}
            />
            <button type="submit" aria-label={label} className={submitClasses}>
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
