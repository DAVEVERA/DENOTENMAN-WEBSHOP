"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { categories } from "@/lib/routes";
import {
  CATALOG_SEARCH_EVENT,
  type CatalogSearchEventDetail,
} from "@/lib/catalogSearch";
import { cn } from "@/lib/cn";

type CatalogSearchEvent = CustomEvent<CatalogSearchEventDetail>;

export function NavbarSearch({
  locale,
  label,
  placeholder = label,
  mobile = false,
  autoFocus = false,
  onSubmitted,
}: {
  locale: Locale;
  label: string;
  placeholder?: string;
  mobile?: boolean;
  autoFocus?: boolean;
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

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
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const destination = categories(locale);
    const normalizedQuery = query.trim();
    const params =
      pathname === destination
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
      new CustomEvent(CATALOG_SEARCH_EVENT, {
        detail: { query: normalizedQuery },
      })
    );
    onSubmitted?.();

    if (pathname === destination) {
      router.push(href, { scroll: false });
      requestAnimationFrame(() => {
        document.getElementById("product-search")?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        });
      });
      return;
    }

    router.push(href);
  }

  const fieldId = mobile ? "mobile-header-search" : "desktop-header-search";

  return (
    <form
      role="search"
      aria-label={label}
      onSubmit={submitSearch}
      className={cn(
        "flex w-full items-center bg-surface transition-colors focus-within:border-accent",
        mobile
          ? "h-13 rounded-button border-2 border-contrast"
          : "h-12 border-[3px] border-contrast"
      )}
    >
      <label htmlFor={fieldId} className="sr-only">
        {label}
      </label>
      <input
        ref={inputRef}
        id={fieldId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent px-4 font-heading text-body-md text-text placeholder:text-muted focus:outline-none"
      />
      <button
        type="submit"
        aria-label={label}
        className="inline-flex h-11 w-12 shrink-0 items-center justify-center text-text transition-colors duration-hover-fast hover:text-accent-hover"
      >
        <Search className="h-5 w-5" aria-hidden="true" />
      </button>
    </form>
  );
}
