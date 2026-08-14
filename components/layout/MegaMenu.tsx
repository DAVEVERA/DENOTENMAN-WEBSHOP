"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MainCategoryDto } from "@/lib/queries";
import type { MainCategoryGroupDto } from "@/lib/categoryGroups";
import type { Locale } from "@/lib/i18n";
import { category as categoryPath } from "@/lib/routes";
import { cn } from "@/lib/cn";

export function MegaMenu({
  groups,
  promotional,
  locale,
}: {
  groups: MainCategoryGroupDto[];
  promotional?: MainCategoryDto;
  locale: Locale;
}) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const scheduleClose = (slug: string) => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setOpenSlug((current) => (current === slug ? null : current));
    }, 200);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rowRef.current && !rowRef.current.contains(event.target as Node)) {
        setOpenSlug(null);
      }
    }
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenSlug(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      clearCloseTimeout();
    };
  }, []);

  return (
    <div ref={rowRef} className="contents">
      {groups.map((group) =>
        group.categories.length > 1 ? (
          <div
            key={group.primarySlug}
            className="relative flex items-center"
            onMouseEnter={() => {
              clearCloseTimeout();
              setOpenSlug(group.primarySlug);
            }}
            onMouseLeave={() => scheduleClose(group.primarySlug)}
          >
            <a
              href={categoryPath(locale, group.primarySlug)}
              className="font-heading text-body-md font-bold text-text transition-colors duration-hover-fast hover:text-accent-hover"
            >
              {group.label}
            </a>
            <button
              type="button"
              aria-expanded={openSlug === group.primarySlug}
              aria-haspopup="true"
              aria-label={`${group.label} submenu`}
              onClick={() =>
                setOpenSlug((current) => (current === group.primarySlug ? null : group.primarySlug))
              }
              onFocus={() => {
                clearCloseTimeout();
                setOpenSlug(group.primarySlug);
              }}
              className="flex items-center p-1 text-text transition-colors duration-hover-fast hover:text-accent-hover"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-hover-fast",
                  openSlug === group.primarySlug && "rotate-180"
                )}
                aria-hidden="true"
              />
            </button>
            {openSlug === group.primarySlug ? (
              <div
                className="absolute left-1/2 top-full z-40 mt-2 w-56 -translate-x-1/2 rounded-panel border border-border bg-surface p-3 shadow-card-hover"
                onMouseEnter={clearCloseTimeout}
                onMouseLeave={() => scheduleClose(group.primarySlug)}
              >
                <ul className="flex flex-col">
                  {group.categories
                    .filter((item) => item.slug !== group.primarySlug)
                    .map((item) => (
                      <li key={item.id}>
                        <a
                          href={categoryPath(locale, item.slug)}
                          onClick={() => setOpenSlug(null)}
                          className="block rounded-button px-3 py-2 font-heading text-body-sm font-semibold text-text hover:bg-background hover:text-accent-hover"
                        >
                          {item.name}
                        </a>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <a
            key={group.primarySlug}
            href={categoryPath(locale, group.primarySlug)}
            className="font-heading text-body-md font-bold text-text transition-colors duration-hover-fast hover:text-accent-hover"
          >
            {group.label}
          </a>
        )
      )}
      {promotional ? (
        <a
          href={categoryPath(locale, promotional.slug)}
          className="font-heading text-body-md font-bold text-accent-hover transition-colors duration-hover-fast hover:text-accent"
        >
          {promotional.name}
        </a>
      ) : null}
    </div>
  );
}
