"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Download } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { ProductFaqPlacement } from "@prisma/client";
import type { StorefrontProductFaq } from "@/lib/product-faq";

const headings: Record<Locale, string> = {
  nl: "Veelgestelde vragen",
  en: "Frequently asked questions",
  fr: "Questions fréquentes",
};

const downloadLabels: Record<Locale, string> = {
  nl: "Open de bijlage",
  en: "Open attachment",
  fr: "Ouvrir la pièce jointe",
};

export function ProductFaqAccordion({
  items,
  locale,
  placement,
}: {
  items: StorefrontProductFaq[];
  locale: Locale;
  placement: ProductFaqPlacement;
}) {
  const visibleItems = items;
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  if (visibleItems.length === 0) return null;

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target = index;
    if (event.key === "ArrowDown") target = (index + 1) % visibleItems.length;
    else if (event.key === "ArrowUp") target = (index - 1 + visibleItems.length) % visibleItems.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = visibleItems.length - 1;
    else return;
    event.preventDefault();
    buttons.current[target]?.focus();
  }

  const placementClass = placement === "BELOW_DESCRIPTION"
    ? "mt-6 min-w-0"
    : placement === "BELOW_PRODUCT_DETAILS"
      ? "mt-8 min-w-0"
      : "min-w-0 lg:col-span-2";

  return (
    <section aria-labelledby={`faq-title-${placement}`} className={placementClass}>
      <h2 id={`faq-title-${placement}`} className="text-heading-md text-text">{headings[locale]}</h2>
      <div className="mt-4 divide-y divide-border border-y border-border">
        {visibleItems.map((item, index) => {
          const open = openIds.has(item.id);
          const panelId = `faq-panel-${placement}-${item.id}`;
          const buttonId = `faq-button-${placement}-${item.id}`;
          return (
            <article key={item.id}>
              <h3>
                <button
                  ref={(node) => { buttons.current[index] = node; }}
                  id={buttonId}
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onKeyDown={(event) => navigate(event, index)}
                  onClick={() => setOpenIds((current) => {
                    const next = new Set(current);
                    if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                    return next;
                  })}
                  className="flex min-h-14 w-full items-center justify-between gap-4 py-3 text-left font-heading text-body-md font-bold text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  <span>{item.question}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-accent-hover transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
              </h3>
              <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open} className="pb-5">
                <div className="product-rich-text text-muted" dangerouslySetInnerHTML={{ __html: item.answerHtml }} />
                {item.media ? <FaqMedia item={item} locale={locale} /> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FaqMedia({ item, locale }: { item: StorefrontProductFaq; locale: Locale }) {
  const [failed, setFailed] = useState(false);
  if (!item.media || failed) return null;
  const media = item.media;
  if (media.contentType.startsWith("video/")) {
    return (
      <video controls preload="metadata" onError={() => setFailed(true)} className="mt-4 max-h-[32rem] w-full rounded-card border border-border bg-black" aria-label={media.label}>
        <source src={media.url} type={media.contentType} />
      </video>
    );
  }
  if (media.contentType === "application/pdf") {
    return (
      <a href={media.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-button border border-accent px-4 font-semibold text-text underline-offset-4 hover:underline">
        <Download className="h-4 w-4" aria-hidden="true" /> {media.label || downloadLabels[locale]}
      </a>
    );
  }
  return (
    <img
      src={media.url}
      alt={media.label}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="mt-4 h-auto max-h-[32rem] w-auto max-w-full rounded-card border border-border bg-background object-contain"
    />
  );
}
