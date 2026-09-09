"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { ShippingCountryCode } from "@/lib/shipping";
import {
  COUNTRY_PREFERENCE_COOKIE,
  COUNTRY_PREFERENCE_LIFETIME_DAYS,
  parseCountryPreference,
} from "@/lib/country-preference";

const copy: Record<Locale, { title: string; nl: string; be: string }> = {
  nl: { title: "Kies je land", nl: "Nederland", be: "België" },
  en: { title: "Choose your country", nl: "Netherlands", be: "Belgium" },
  fr: { title: "Choisissez votre pays", nl: "Pays-Bas", be: "Belgique" },
};

function readCountryCookie(): ShippingCountryCode | null {
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${COUNTRY_PREFERENCE_COOKIE}=`));
  return parseCountryPreference(match?.split("=")[1] ?? null);
}

export function CountrySelectModal({ locale }: { locale: Locale }) {
  const labels = copy[locale];
  const [open, setOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setOpen(!readCountryCookie());
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function choose(country: ShippingCountryCode) {
    const maxAge = COUNTRY_PREFERENCE_LIFETIME_DAYS * 24 * 60 * 60;
    document.cookie = `${COUNTRY_PREFERENCE_COOKIE}=${country}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="country-select-title"
        className="w-full max-w-sm rounded-panel border-2 border-contrast bg-surface p-6 shadow-2xl"
      >
        <h2
          id="country-select-title"
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-xl font-bold text-contrast outline-none"
        >
          {labels.title}
        </h2>
        <div className="mt-5 grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => choose("NL")}
            className="flex min-h-12 items-center justify-center gap-2 rounded-button border-2 border-contrast bg-surface px-4 font-heading font-bold text-contrast hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span aria-hidden="true">🇳🇱</span>
            <span>{labels.nl}</span>
          </button>
          <button
            type="button"
            onClick={() => choose("BE")}
            className="flex min-h-12 items-center justify-center gap-2 rounded-button border-2 border-contrast bg-surface px-4 font-heading font-bold text-contrast hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span aria-hidden="true">🇧🇪</span>
            <span>{labels.be}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
