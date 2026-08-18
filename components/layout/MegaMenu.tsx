"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import type { NavigationCategoryDto } from "@/lib/categoryGroups";
import type { Locale } from "@/lib/i18n";
import { category as categoryPath } from "@/lib/routes";
import { cn } from "@/lib/cn";
import { PromotionalCategoryLink } from "@/components/layout/PromotionalCategoryLink";

type MegaMenuLabels = {
  submenu: string;
  viewAll: string;
};

type TopLevelNavigationKey = "ArrowLeft" | "ArrowRight" | "Home" | "End";

export function nextTopLevelIndex(
  itemCount: number,
  currentIndex: number,
  key: TopLevelNavigationKey
): number {
  if (itemCount < 1) return -1;
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
  const offset = key === "ArrowRight" ? 1 : -1;
  return (currentIndex + offset + itemCount) % itemCount;
}

function formatLabel(template: string, category: string): string {
  return template.replace("{category}", category);
}

function containsPath(
  category: NavigationCategoryDto,
  pathname: string,
  locale: Locale
): boolean {
  if (pathname === categoryPath(locale, category.slug)) return true;
  return category.children.some((child) => containsPath(child, pathname, locale));
}

function DescendantLinks({
  categories,
  locale,
  close,
  depth = 0,
}: {
  categories: NavigationCategoryDto[];
  locale: Locale;
  close: () => void;
  depth?: number;
}) {
  return (
    <ul className={cn(depth === 0 ? "mt-1 space-y-0.5" : "ml-3 border-l border-border pl-3")}>
      {categories.map((category) => (
        <li key={category.id}>
          <Link
            data-mega-link
            href={categoryPath(locale, category.slug)}
            onClick={close}
            className={cn(
              "flex min-h-11 items-center rounded-button px-2 py-2 text-body-sm text-muted transition-colors duration-hover-fast hover:bg-background hover:text-text focus-visible:bg-background",
              depth === 0 ? "font-semibold" : "font-medium"
            )}
          >
            {category.name}
          </Link>
          {category.children.length > 0 ? (
            <DescendantLinks
              categories={category.children}
              locale={locale}
              close={close}
              depth={depth + 1}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function CategoryColumn({
  category,
  locale,
  close,
}: {
  category: NavigationCategoryDto;
  locale: Locale;
  close: () => void;
}) {
  return (
    <section className="min-w-0 border-t border-border pt-4 first:border-t-0 lg:border-l lg:border-t-0 lg:pl-6 lg:first:border-l-0 lg:first:pl-0">
      <Link
        data-mega-link
        href={categoryPath(locale, category.slug)}
        onClick={close}
        className="inline-flex min-h-11 items-center font-heading text-heading-sm font-bold text-text transition-colors duration-hover-fast hover:text-accent-hover"
      >
        {category.name}
      </Link>
      {category.children.length > 0 ? (
        <DescendantLinks categories={category.children} locale={locale} close={close} />
      ) : null}
    </section>
  );
}

export function MegaMenu({
  categories,
  promotional,
  locale,
  labels,
}: {
  categories: NavigationCategoryDto[];
  promotional?: NavigationCategoryDto;
  locale: Locale;
  labels: MegaMenuLabels;
}) {
  const pathname = usePathname();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimeout = useCallback(() => {
    if (!closeTimeoutRef.current) return;
    clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = null;
  }, []);

  const close = useCallback(() => {
    clearCloseTimeout();
    setOpenId(null);
    setPinnedId(null);
  }, [clearCloseTimeout]);

  const scheduleClose = useCallback(() => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => setOpenId(pinnedId), 240);
  }, [clearCloseTimeout, pinnedId]);

  const open = useCallback(
    (id: string) => {
      clearCloseTimeout();
      setOpenId(id);
    },
    [clearCloseTimeout]
  );

  useEffect(() => {
    close();
  }, [close, pathname]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rowRef.current?.contains(event.target as Node)) close();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !openId) return;
      event.preventDefault();
      const trigger = itemRefs.current.get(openId);
      close();
      trigger?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      clearCloseTimeout();
    };
  }, [clearCloseTimeout, close, openId]);

  function focusTopLevel(index: number) {
    const next = categories[index];
    if (!next) return;
    itemRefs.current.get(next.id)?.focus();

    if (!openId) return;
    if (next.children.length === 0) {
      close();
      return;
    }
    setOpenId(next.id);
    setPinnedId(next.id);
  }

  function handleTopLevelKeyDown(
    event: React.KeyboardEvent<HTMLElement>,
    category: NavigationCategoryDto,
    index: number
  ) {
    if (event.key === "ArrowDown" && category.children.length > 0) {
      event.preventDefault();
      open(category.id);
      setPinnedId(category.id);
      requestAnimationFrame(() => {
        document
          .getElementById(`category-panel-${category.id}`)
          ?.querySelector<HTMLElement>("[data-mega-link]")
          ?.focus();
      });
      return;
    }

    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();
    focusTopLevel(nextTopLevelIndex(categories.length, index, event.key as TopLevelNavigationKey));
  }

  return (
    <div
      ref={rowRef}
      className="relative mx-auto flex min-w-0 max-w-[90rem] flex-wrap items-center justify-center gap-x-5 gap-y-1"
      onMouseLeave={scheduleClose}
      onMouseEnter={clearCloseTimeout}
      onBlur={() => {
        requestAnimationFrame(() => {
          if (!rowRef.current?.contains(document.activeElement)) close();
        });
      }}
    >
      {categories.map((category, index) => {
        const hasChildren = category.children.length > 0;
        const expanded = hasChildren && openId === category.id;
        const active = containsPath(category, pathname, locale);
        const itemClassName = cn(
          "group inline-flex min-h-11 items-center gap-1 whitespace-nowrap border-b-2 px-1 font-heading text-body-sm font-bold transition-colors duration-hover-fast",
          expanded || active
            ? "border-accent text-accent-hover"
            : "border-transparent text-text hover:border-border-hover hover:text-accent-hover"
        );

        return (
          <div key={category.id} className="flex min-w-0 items-center">
            {hasChildren ? (
              <button
                ref={(node) => {
                  if (node) itemRefs.current.set(category.id, node);
                  else itemRefs.current.delete(category.id);
                }}
                id={`category-trigger-${category.id}`}
                type="button"
                aria-expanded={expanded}
                aria-controls={`category-panel-${category.id}`}
                onClick={() => {
                  if (expanded && pinnedId === category.id) {
                    close();
                    return;
                  }
                  setPinnedId(category.id);
                  open(category.id);
                }}
                onMouseEnter={() => open(category.id)}
                onKeyDown={(event) => handleTopLevelKeyDown(event, category, index)}
                className={itemClassName}
              >
                <span>{category.name}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-hover-fast",
                    expanded && "rotate-180"
                  )}
                  aria-hidden="true"
                />
                <span className="sr-only">{formatLabel(labels.submenu, category.name)}</span>
              </button>
            ) : (
              <Link
                ref={(node) => {
                  if (node) itemRefs.current.set(category.id, node);
                  else itemRefs.current.delete(category.id);
                }}
                href={categoryPath(locale, category.slug)}
                onMouseEnter={close}
                onKeyDown={(event) => handleTopLevelKeyDown(event, category, index)}
                className={itemClassName}
              >
                {category.name}
              </Link>
            )}

            {hasChildren ? (
              <div
                id={`category-panel-${category.id}`}
                role="region"
                aria-labelledby={`category-trigger-${category.id}`}
                aria-hidden={!expanded}
                hidden={!expanded}
                className={cn("absolute left-0 right-0 top-full z-40 pt-3", !expanded && "hidden")}
              >
                <div className="max-h-[min(70vh,42rem)] overflow-y-auto rounded-panel border border-border bg-surface shadow-card-hover">
                  <div className="grid gap-5 p-6 lg:grid-cols-3 xl:grid-cols-4 xl:p-8">
                    {category.children.map((column) => (
                      <CategoryColumn key={column.id} category={column} locale={locale} close={close} />
                    ))}
                  </div>
                  <div className="flex items-center justify-end border-t border-border bg-background px-6 py-3 xl:px-8">
                    <Link
                      data-mega-link
                      href={categoryPath(locale, category.slug)}
                      onClick={close}
                      className="inline-flex min-h-11 shrink-0 items-center gap-2 font-heading text-body-sm font-bold text-text transition-colors duration-hover-fast hover:text-accent-hover"
                    >
                      {formatLabel(labels.viewAll, category.name)}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      {promotional ? <PromotionalCategoryLink category={promotional} locale={locale} /> : null}
    </div>
  );
}
