import { notFound } from "next/navigation";
import Script from "next/script";
import type { Metadata } from "next";
import { Dosis, Montserrat } from "next/font/google";
import { locales, isLocale } from "@/lib/i18n";
import { BASE_URL } from "@/lib/routes";
import { buildOrganizationStructuredData } from "@/lib/structured-data";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";
import { CookieConsent } from "@/components/privacy/CookieConsent";
import { COOKIE_CONSENT_BOOTSTRAP_SCRIPT } from "@/lib/cookie-consent-bootstrap";
import "@/app/globals.css";

const dosis = Dosis({
  subsets: ["latin"],
  variable: "--font-dosis",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

const dictionaries = { nl, en, fr };

const icons = { icon: "/brand/favicon.png" };

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  icons,
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  modal,
  params,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const dictionary = dictionaries[locale];
  const organizationStructuredData = buildOrganizationStructuredData(BASE_URL);

  return (
    <html
      lang={locale}
      className={`${dosis.variable} ${montserrat.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-background font-body text-text">
        <Script
          id="cookie-consent-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: COOKIE_CONSENT_BOOTSTRAP_SCRIPT }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationStructuredData).replace(/</g, "\\u003c"),
          }}
        />
        <CookieConsent locale={locale} />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-text"
        >
          {dictionary.nav.skipToContent}
        </a>
        {children}
        {modal}
      </body>
    </html>
  );
}
