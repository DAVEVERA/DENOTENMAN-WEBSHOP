"use client";

import Link from "next/link";
import { ChevronDown, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { CustomerServiceCopy } from "@/lib/customer-service-content";

export function CustomerServiceKnowledgeBase({ copy }: { copy: CustomerServiceCopy }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const entries = useMemo(() => {
    if (!normalizedQuery) return copy.entries;
    return copy.entries.filter((entry) =>
      [entry.category, entry.question, entry.answer]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    );
  }, [copy.entries, normalizedQuery]);

  return (
    <section aria-labelledby="knowledge-title" className="py-10 sm:py-14">
      <div className="max-w-3xl">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">
          {copy.eyebrow}
        </p>
        <h2 id="knowledge-title" className="mt-2 text-heading-lg sm:text-heading-xl">
          {copy.knowledgeTitle}
        </h2>
        <p className="mt-3 max-w-2xl leading-7 text-muted">{copy.knowledgeLead}</p>
      </div>

      <div className="relative mt-6 max-w-3xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
        <label htmlFor="customer-service-search" className="sr-only">
          {copy.searchLabel}
        </label>
        <input
          id="customer-service-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.searchPlaceholder}
          className="min-h-12 w-full rounded-button border border-border bg-surface py-3 pl-12 pr-12 text-body-md shadow-card placeholder:text-muted focus:border-accent-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={copy.clearSearch}
            className="absolute right-0 top-0 inline-flex h-12 w-12 touch-manipulation items-center justify-center text-muted hover:text-text"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-body-sm text-muted" role="status" aria-live="polite">
        {entries.length === 1
          ? copy.resultCountSingular
          : copy.resultCount.replace("{count}", String(entries.length))}
      </p>

      {entries.length ? (
        <div className="mt-5 grid max-w-4xl gap-3">
          {entries.map((entry) => (
            <details key={entry.id} className="group rounded-card border border-border bg-surface shadow-card open:border-accent/70">
              <summary className="flex min-h-14 cursor-pointer list-none touch-manipulation items-center gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.68rem] font-bold uppercase tracking-[0.12em] text-accent-ink">{entry.category}</span>
                  <span className="mt-1 block font-heading text-[1.02rem] font-bold leading-snug text-text sm:text-heading-sm">{entry.question}</span>
                </span>
                <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="border-t border-border px-4 py-4 sm:px-5 sm:py-5">
                <p className="max-w-3xl leading-7 text-text">{entry.answer}</p>
                {entry.links?.length ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {entry.links.map((link) => (
                      <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center font-heading text-body-sm font-bold text-accent-ink underline underline-offset-4 hover:text-accent-hover">
                        {link.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="mt-5 max-w-3xl rounded-card border border-dashed border-border bg-surface p-6">
          <h3 className="text-heading-sm">{copy.noResultsTitle}</h3>
          <p className="mt-2 leading-7 text-muted">{copy.noResultsText}</p>
        </div>
      )}
    </section>
  );
}
