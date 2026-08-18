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
  overview: string;
};

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
    <section className="min-w-0 border-t border-border pt-4 first:border-t-0 sm:border-t-0 sm:border-l sm:pl-6 sm:first:border-l-0 sm:first:pl-0">
      <Link
        data-mega-link
        href={categoryPath(locale, category.slug)}
        onClick={close}
        className="inline-flex min-h-11 items-center font-heading text-heading-sm font-bold text-text transition-colors duration-hover-fast hover:text-accent-hover"
      >
        {category.name}
      </Link>
      {category.children.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {category.children.map((child) => (
            <li key={child.id}>
              <Link
                data-mega-link
                href={categoryPath(locale, child.slug)}
                onClick={close}
                className="flex min-h-10 items-center rounded-button px-2 py-2 text-body-sm font-medium text-muted transition-colors duration-hover-fast hover:bg-background hover:text-text"
              >
                {child.name}
              </Link>
            </li>
          ))}
        </ul>
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
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
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
    function handlePointerDown(event: PointerEvent) {
      if (!rowRef.current?.contains(event.target as Node)) close();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !openId) return;
      event.preventDefault();
      const trigger = triggerRefs.current.get(openId);
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

  function handleTriggerKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    category: NavigationCategoryDto,
    index: number
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      open(category.id);
      setPinnedId(category.id);
      requestAnimationFrame(() => {
        rowRef.current
          ?.querySelector<HTMLElement>(`#category-panel-${category.id} [data-mega-link]`)
          ?.focus();
      });
      return;
    }

    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = categories[(index + offset + categories.length) % categories.length];
    if (next) triggerRefs.current.get(next.id)?.focus();
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
        const expanded = openId === category.id;
        const active = containsPath(category, pathname, locale);
        const panelColumns = category.children.length > 0 ? category.children : [category];

        return (
          <div key={category.id} className="flex min-w-0 items-center">
            <button
              ref={(node) => {
                if (node) triggerRefs.current.set(category.id, node);
                else triggerRefs.current.delete(category.id);
              }}
              id={`category-trigger-${category.id}`}
              type="button"
              aria-expanded={expanded}
              aria-controls={`category-panel-${category.id}`}
              aria-haspopup="true"
              onClick={() => {
                if (expanded && pinnedId === category.id) {
                  close();
                  return;
                }
                setPinnedId(category.id);
                open(category.id);
              }}
              onMouseEnter={() => open(category.id)}
              onKeyDown={(event) => handleTriggerKeyDown(event, category, index)}
              className={cn(
                "group inline-flex min-h-11 items-center gap-1 whitespace-nowrap border-b-2 px-1 font-heading text-body-sm font-bold transition-colors duration-hover-fast",
                expanded || active
                  ? "border-accent text-accent-hover"
                  : "border-transparent text-text hover:border-border-hover hover:text-accent-hover"
              )}
            >
              <span>{category.name}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-transform duration-hover-fast",
                  expanded && "rotate-180"
                )}
                aria-hidden="true"
              />
              <span className="sr-only">
                {formatLabel(labels.submenu, category.name)}
              </span>
            </button>

            {expanded ? (
              <div
                id={`category-panel-${category.id}`}
                role="region"
                aria-labelledby={`category-trigger-${category.id}`}
                className="absolute left-0 right-0 top-full z-40 pt-3"
              >
                <div className="overflow-hidden rounded-panel border border-border bg-surface shadow-card-hover">
                  <div className="grid gap-5 p-6 sm:grid-cols-2 xl:grid-cols-3 xl:p-8">
                    {panelColumns.map((column) => (
                      <CategoryColumn
                        key={column.id}
                        category={column}
                        locale={locale}
                        close={close}
                      />
                    ))}
                    {category.children.length === 0 ? (
                      <p className="self-center text-body-sm leading-relaxed text-muted sm:col-span-1 xl:col-span-2">
                        {formatLabel(labels.overview, category.name)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex justify-end border-t border-border bg-background px-6 py-3 xl:px-8">
                    <Link
                      data-mega-link
                      href={categoryPath(locale, category.slug)}
                      onClick={close}
                      className="inline-flex min-h-11 items-center gap-2 font-heading text-body-sm font-bold text-text transition-colors duration-hover-fast hover:text-accent-hover"
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
      {promotional ? (
        <PromotionalCategoryLink category={promotional} locale={locale} />
      ) : null}
    </div>
  );
}
