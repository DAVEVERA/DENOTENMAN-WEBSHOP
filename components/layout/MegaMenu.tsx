"use client";

import { useEffect, useRef, useState } from "react";
import type { MainCategoryDto } from "@/lib/queries";
import type { Locale } from "@/lib/i18n";
import { category as categoryPath } from "@/lib/routes";
import { cn } from "@/lib/cn";

export function MegaMenu({
  categories,
  locale,
  label,
}: {
  categories: MainCategoryDto[];
  locale: Locale;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onFocus={() => setOpen(true)}
        className="font-heading text-body-md text-text transition-colors duration-hover-fast hover:text-accent-hover"
      >
        {label}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-40 mt-2 grid w-[min(90vw,48rem)] grid-cols-3 gap-gap-lg rounded-panel border border-border bg-surface p-panel shadow-card-hover">
          {categories.map((item) => (
            <div key={item.id}>
              <a
                href={categoryPath(locale, item.slug)}
                className="font-heading text-body-md text-text hover:text-accent-hover"
                onClick={() => setOpen(false)}
              >
                {item.name}
              </a>
              {item.description ? (
                <p className="mt-2 text-body-sm text-muted">{item.description}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
