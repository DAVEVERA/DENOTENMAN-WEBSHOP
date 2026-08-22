"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { Locale } from "@/lib/i18n";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { denyGoogleAnalyticsConsent } from "@/lib/analytics";
import {
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_SETTINGS_EVENT,
  createCookieConsent,
  parseCookieConsent,
  type CookieConsent as CookieConsentState,
} from "@/lib/cookie-consent";
import { clearProductViewSessionStorage } from "@/lib/product-view-consent";

const mailchimpConnectedSiteUrl =
  "https://chimpstatic.com/mcjs-connected/js/users/8acdcbab41d6c9a77789a5c6e/e153af6949eb3f4d24a641635.js";

const copy: Record<Locale, {
  title: string;
  intro: string;
  necessary: string;
  necessaryDescription: string;
  analytics: string;
  analyticsDescription: string;
  marketing: string;
  marketingDescription: string;
  accept: string;
  reject: string;
  preferences: string;
  save: string;
  close: string;
  policy: string;
}> = {
  nl: {
    title: "Uw cookiekeuze",
    intro: "Noodzakelijke opslag houdt de winkelwagen en uw keuze werkend. Met uw toestemming gebruiken we analytics en marketingmeting.",
    necessary: "Noodzakelijk",
    necessaryDescription: "Winkelwagen, favorieten, beveiliging en het bewaren van uw cookiekeuze.",
    analytics: "Analytics",
    analyticsDescription: "Google Analytics helpt ons geaggregeerd gebruik van de webshop te meten.",
    marketing: "Marketing",
    marketingDescription: "Mailchimp en Google Ads helpen campagnes en nieuwsbriefinteracties te meten.",
    accept: "Alles accepteren",
    reject: "Alles weigeren",
    preferences: "Zelf kiezen",
    save: "Voorkeuren opslaan",
    close: "Sluiten",
    policy: "Lees het cookiebeleid",
  },
  en: {
    title: "Your cookie choice",
    intro: "Necessary storage keeps the cart and your choice working. With your consent, we use analytics and marketing measurement.",
    necessary: "Necessary",
    necessaryDescription: "Cart, favourites, security and storage of your cookie choice.",
    analytics: "Analytics",
    analyticsDescription: "Google Analytics helps us measure aggregated webshop usage.",
    marketing: "Marketing",
    marketingDescription: "Mailchimp and Google Ads help measure campaigns and newsletter interactions.",
    accept: "Accept all",
    reject: "Reject all",
    preferences: "Choose settings",
    save: "Save preferences",
    close: "Close",
    policy: "Read the cookie policy",
  },
  fr: {
    title: "Votre choix de cookies",
    intro: "Le stockage nécessaire assure le panier et mémorise votre choix. Avec votre accord, nous utilisons la mesure d’audience et marketing.",
    necessary: "Nécessaires",
    necessaryDescription: "Panier, favoris, sécurité et mémorisation de votre choix.",
    analytics: "Mesure d’audience",
    analyticsDescription: "Google Analytics nous aide à mesurer l’utilisation agrégée de la boutique.",
    marketing: "Marketing",
    marketingDescription: "Mailchimp et Google Ads aident à mesurer les campagnes et interactions avec les e-mails.",
    accept: "Tout accepter",
    reject: "Tout refuser",
    preferences: "Personnaliser",
    save: "Enregistrer mes choix",
    close: "Fermer",
    policy: "Lire la politique de cookies",
  },
};

function deleteOptionalCookies() {
  const optionalPrefixes = ["_ga", "_gid", "_gat", "_gcl", "_mc", "MCPopup"];
  for (const entry of document.cookie.split(";")) {
    const name = entry.split("=", 1)[0]?.trim();
    if (!name || !optionalPrefixes.some((prefix) => name.startsWith(prefix))) continue;
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.denotenman.com; SameSite=Lax`;
  }
}

export function CookieConsent({ locale }: { locale: Locale }) {
  const labels = copy[locale];
  const [ready, setReady] = useState(false);
  const [consent, setConsent] = useState<CookieConsentState | null>(null);
  const [open, setOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const stored = parseCookieConsent(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY));
    setConsent(stored);
    setAnalytics(stored?.analytics ?? false);
    setMarketing(stored?.marketing ?? false);
    setOpen(!stored);
    setReady(true);

    function openSettings() {
      setShowDetails(true);
      setOpen(true);
    }

    window.addEventListener(COOKIE_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, openSettings);
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, showDetails]);

  function persist(nextAnalytics: boolean, nextMarketing: boolean) {
    const next = createCookieConsent({ analytics: nextAnalytics, marketing: nextMarketing });
    const revokedOptionalConsent = Boolean(
      consent &&
      ((consent.analytics && !nextAnalytics) || (consent.marketing && !nextMarketing))
    );

    if (consent?.analytics && !nextAnalytics) {
      // Deny Google before notifying listeners, closing the revoke race.
      denyGoogleAnalyticsConsent();
    }

    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(next));
    setConsent(next);
    setAnalytics(nextAnalytics);
    setMarketing(nextMarketing);
    setOpen(false);
    setShowDetails(false);
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: next }));

    if (consent?.analytics && !nextAnalytics) {
      clearProductViewSessionStorage(window.sessionStorage);
    }
    if (revokedOptionalConsent) {
      deleteOptionalCookies();
      window.location.reload();
    }
  }

  return (
    <>
      {consent?.analytics ? (
        <GoogleAnalytics />
      ) : null}

      {consent?.marketing ? (
        <Script id="mailchimp-connected-site" src={mailchimpConnectedSiteUrl} strategy="lazyOnload" />
      ) : null}

      {ready && open ? (
        <div className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-5">
          <section
            role={showDetails ? "dialog" : "region"}
            aria-modal={showDetails || undefined}
            aria-labelledby="cookie-consent-title"
            className="mx-auto max-h-[calc(100vh-1.5rem)] max-w-3xl overflow-y-auto rounded-panel border-2 border-contrast bg-surface p-5 shadow-2xl sm:p-7"
          >
            <h2
              id="cookie-consent-title"
              ref={headingRef}
              tabIndex={-1}
              className="font-heading text-2xl font-bold text-contrast outline-none"
            >
              {labels.title}
            </h2>
            <p className="mt-3 leading-relaxed text-muted">{labels.intro}</p>

            {showDetails ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-card border border-border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div><h3 className="font-heading font-bold text-contrast">{labels.necessary}</h3><p className="mt-1 text-sm text-muted">{labels.necessaryDescription}</p></div>
                    <span className="rounded-full bg-background px-3 py-1 text-xs font-bold text-contrast">Altijd actief</span>
                  </div>
                </div>
                <label className="flex cursor-pointer items-start justify-between gap-4 rounded-card border border-border p-4">
                  <span><span className="block font-heading font-bold text-contrast">{labels.analytics}</span><span className="mt-1 block text-sm text-muted">{labels.analyticsDescription}</span></span>
                  <input className="mt-1 h-5 w-5 shrink-0 accent-[#333333]" type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} />
                </label>
                <label className="flex cursor-pointer items-start justify-between gap-4 rounded-card border border-border p-4">
                  <span><span className="block font-heading font-bold text-contrast">{labels.marketing}</span><span className="mt-1 block text-sm text-muted">{labels.marketingDescription}</span></span>
                  <input className="mt-1 h-5 w-5 shrink-0 accent-[#333333]" type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} />
                </label>
              </div>
            ) : null}

            <a className="mt-4 inline-block text-sm font-semibold text-contrast underline underline-offset-4" href={`/${locale}/${locale === "nl" ? "paginas/cookiebeleid" : locale === "fr" ? "pages/politique-de-cookies" : "pages/cookie-policy"}`}>
              {labels.policy}
            </a>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button type="button" onClick={() => persist(false, false)} className="min-h-12 rounded-button border-2 border-contrast bg-contrast px-4 font-heading font-bold text-surface hover:bg-[#4a4a4a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                {labels.reject}
              </button>
              {showDetails ? (
                <button type="button" onClick={() => persist(analytics, marketing)} className="min-h-12 rounded-button border-2 border-contrast bg-surface px-4 font-heading font-bold text-contrast hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                  {labels.save}
                </button>
              ) : (
                <button type="button" onClick={() => setShowDetails(true)} className="min-h-12 rounded-button border-2 border-contrast bg-surface px-4 font-heading font-bold text-contrast hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                  {labels.preferences}
                </button>
              )}
              <button type="button" onClick={() => persist(true, true)} className="min-h-12 rounded-button border-2 border-contrast bg-contrast px-4 font-heading font-bold text-surface hover:bg-[#4a4a4a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                {labels.accept}
              </button>
            </div>

            {consent ? (
              <button type="button" onClick={() => { setOpen(false); setShowDetails(false); }} className="mt-4 min-h-11 text-sm font-semibold text-muted underline underline-offset-4">
                {labels.close}
              </button>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
