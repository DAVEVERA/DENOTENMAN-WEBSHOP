import Link from "next/link";
import Image from "next/image";
import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { getCustomerServiceCopy } from "@/lib/customer-service-content";
import { CUSTOMER_SERVICE_WHATSAPP_URL } from "@/lib/customer-service";
import { pagePath } from "@/lib/pages";
import {
  categories as categoriesPath,
  category as categoryPath,
  home as homePath,
} from "@/lib/routes";
import { getMainCategories } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { CookieSettingsButton } from "@/components/privacy/CookieSettingsButton";
import { NewsletterSignup } from "@/components/home/NewsletterSignup";
import styles from "./Footer.module.css";

type FooterDesignACopy = Partial<{
  shopTitle: string;
  helpTitle: string;
  marketsTitle: string;
  newsletterTitle: string;
  newsletterText: string;
  fullAssortment: string;
}>;

const footerLinkClass =
  "inline-flex min-h-11 items-center py-2 text-body-md font-medium text-background/80 underline-offset-4 transition-colors duration-hover-fast hover:text-background hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-body-sm";

const footerLegalLinkClass =
  "inline-flex min-h-11 items-center py-2 text-body-md text-background/75 underline-offset-4 transition-colors duration-hover-fast hover:text-background hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-body-sm";

const paymentMethodsLabel: Record<Locale, string> = {
  nl: "Betaalmethoden",
  en: "Payment methods",
  fr: "Modes de paiement",
};

const socialMediaLabel: Record<Locale, string> = {
  nl: "Volg De Notenman",
  en: "Follow De Notenman",
  fr: "Suivez De Notenman",
};

const paymentMethods = [
  {
    label: "Apple Pay",
    src: "/icons/Mollie - Payment Methods/Apple-pay/Apple-pay-squircle.svg",
  },
  {
    label: "Maestro",
    src: "/icons/Mollie - Payment Methods/Maestro/Maestro-squircle.svg",
  },
  {
    label: "iDEAL | Wero",
    src: "/icons/Mollie - Payment Methods/iDEAL-Wero/iDEAL-Wero-squircle.svg",
  },
  {
    label: "PayPal",
    src: "/icons/Mollie - Payment Methods/PayPal/PayPal-squircle.svg",
  },
] as const;

export async function Footer({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: typeof nl;
}) {
  const mainCategories = await getMainCategories(locale);
  const customerService = getCustomerServiceCopy(locale);
  const footerCopy = dictionary.footer as typeof dictionary.footer &
    FooterDesignACopy;
  const shopCategories = mainCategories
    .filter((category) => category.type !== "PROMOTIONAL")
    .slice(0, 6);

  return (
    <>
      <NewsletterSignup
        locale={locale}
        privacyHref={pagePath("privacy", locale)}
        copy={{
          eyebrow: dictionary.home.newsletter.eyebrow,
          title: dictionary.home.newsletter.title,
          intro: dictionary.home.newsletter.intro,
          emailLabel: dictionary.home.newsletter.emailLabel,
          emailPlaceholder: dictionary.home.newsletter.emailPlaceholder,
          consentText: dictionary.home.newsletter.consent,
          privacyLinkLabel: dictionary.home.newsletter.privacyLinkLabel,
          submit: dictionary.home.newsletter.submit,
          submitting: dictionary.home.newsletter.submitting,
          success: dictionary.home.newsletter.success,
          invalid: dictionary.home.newsletter.validationError,
          unavailable: dictionary.home.newsletter.error,
          rateLimited: dictionary.home.newsletter.rateLimit,
        }}
      />

      <footer className="bg-[#121212] text-background">
        <Container fullWidth className="px-5 py-panel sm:px-8 sm:py-10 lg:px-12 lg:py-12 xl:px-16">
          <div className="flex flex-col gap-gap-md border-b border-background/15 pb-panel sm:flex-row sm:items-end sm:justify-between">
            <Link
              href={homePath(locale)}
              aria-label={dictionary.nav.home}
              className="inline-flex min-h-11 w-fit items-center rounded-button py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              <Logo
                alt={{
                  mark: dictionary.brand.logoMarkAlt,
                  wordmark: dictionary.brand.logoWordmarkAlt,
                }}
                variant="dark"
                parts="wordmark"
                size="responsive"
              />
            </Link>
            <p className="max-w-md text-body-md leading-relaxed text-background/75 sm:text-body-sm">
              {dictionary.brand.baseline}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-x-gap-lg gap-y-panel py-panel sm:grid-cols-2 lg:grid-cols-4 lg:py-10">
            <nav aria-labelledby="footer-shop-title">
              <h2
                id="footer-shop-title"
                className="font-heading text-heading-sm font-bold text-background"
              >
                {footerCopy.shopTitle ?? dictionary.footer.categoriesTitle}
              </h2>
              <ul className="mt-gap-md space-y-0">
                <li>
                  <Link
                    href={categoriesPath(locale)}
                    className={footerLinkClass}
                  >
                    {footerCopy.fullAssortment ?? dictionary.nav.viewAll}
                  </Link>
                </li>
                {shopCategories.map((category) => (
                  <li key={category.id}>
                    <Link
                      href={categoryPath(locale, category.slug)}
                      prefetch={false}
                      className={footerLinkClass}
                    >
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-labelledby="footer-help-title">
              <h2
                id="footer-help-title"
                className="font-heading text-heading-sm font-bold text-background"
              >
                {footerCopy.helpTitle ?? dictionary.footer.serviceTitle}
              </h2>
              <ul className="mt-gap-md space-y-0">
                <li>
                  <Link
                    href={pagePath("faq", locale)}
                    className={footerLinkClass}
                  >
                    {dictionary.nav.customerService}
                  </Link>
                </li>
                <li>
                  <Link
                    href={pagePath("contact", locale)}
                    className={footerLinkClass}
                  >
                    {dictionary.footer.contact}
                  </Link>
                </li>
                <li>
                  <Link
                    href={pagePath("shippingReturns", locale)}
                    className={footerLinkClass}
                  >
                    {dictionary.footer.returns}
                  </Link>
                </li>
                <li>
                  <Link
                    href={pagePath("about", locale)}
                    className={footerLinkClass}
                  >
                    {dictionary.footer.aboutTitle}
                  </Link>
                </li>
                <li>
                  <Link
                    href={pagePath("contact", locale)}
                    className={footerLinkClass}
                  >
                    {dictionary.nav.business}
                  </Link>
                </li>
              </ul>
            </nav>

            <section aria-labelledby="footer-markets-title">
              <h2
                id="footer-markets-title"
                className="font-heading text-heading-sm font-bold text-background"
              >
                {footerCopy.marketsTitle ?? dictionary.footer.marketDaysTitle}
              </h2>
              <ul className="mt-gap-md space-y-gap-sm text-body-md text-background/80 sm:text-body-sm">
                {customerService.marketVisits.map((visit) => (
                  <li
                    key={visit.id}
                    className="border-l-2 border-accent pl-gap-md"
                  >
                    <span className="block font-semibold text-background">
                      {visit.day} · {visit.location}
                    </span>
                    <span className="mt-1 block text-background/75">
                      {visit.hours}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href={pagePath("markets", locale)}
                className={`${footerLinkClass} mt-gap-sm`}
              >
                {dictionary.nav.whereIsNotenman}
              </Link>
            </section>

            <section aria-labelledby="footer-newsletter-title">
              <h2
                id="footer-newsletter-title"
                className="font-heading text-heading-sm font-bold text-background"
              >
                {footerCopy.newsletterTitle ?? dictionary.footer.subscribe}
              </h2>
              {footerCopy.newsletterText ? (
                <p className="mt-gap-md text-body-md leading-relaxed text-background/75 sm:text-body-sm">
                  {footerCopy.newsletterText}
                </p>
              ) : null}
              <Link
                href={pagePath("subscribe", locale)}
                className="mt-gap-md inline-flex min-h-11 items-center justify-center rounded-button bg-accent px-5 py-3 font-heading text-body-sm font-bold text-contrast shadow-button transition-colors duration-hover-fast hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                {dictionary.footer.subscribe}
              </Link>
              <div>
                <Link
                  href={pagePath("optOut", locale)}
                  className={`${footerLinkClass} mt-gap-sm`}
                >
                  {dictionary.footer.optOut}
                </Link>
              </div>

              <nav
                className={styles.socialMediaSection}
                aria-labelledby="footer-social-media-title"
              >
                <h3 id="footer-social-media-title" className="sr-only">
                  {socialMediaLabel[locale]}
                </h3>
                <ul className={styles.socialMediaCard}>
                  <li>
                    <a
                      href="https://www.facebook.com/denotenman"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Facebook"
                      className={`${styles.socialMediaLink} ${styles.socialMediaFacebook}`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className={styles.socialMediaIcon}
                      >
                        <path
                          fill="currentColor"
                          d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.45h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12Z"
                        />
                      </svg>
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://instagram.com/de_notenman"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram"
                      className={`${styles.socialMediaLink} ${styles.socialMediaInstagram}`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                        className={styles.socialMediaIcon}
                      >
                        <rect x="3" y="3" width="18" height="18" rx="5" />
                        <circle cx="12" cy="12" r="4" />
                        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                      </svg>
                    </a>
                  </li>
                  <li>
                    <a
                      href={CUSTOMER_SERVICE_WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="WhatsApp"
                      className={`${styles.socialMediaLink} ${styles.socialMediaWhatsapp}`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className={styles.socialMediaIcon}
                      >
                        <path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.4-4.7a8.5 8.5 0 1 1 16.1-4.1Z" />
                        <path
                          fill="currentColor"
                          stroke="none"
                          d="M8.2 7.4c.4-.2.8-.1 1 .4l.8 1.7c.1.3.1.5-.1.8l-.7.7c.8 1.6 2.1 2.9 3.7 3.6l.8-.9c.2-.2.5-.3.8-.1l1.7.8c.4.2.5.5.3.9-.4.9-1.3 1.5-2.3 1.4-3.9-.4-7-3.4-7.6-7.2-.1-.9.5-1.7 1.6-2.1Z"
                        />
                      </svg>
                    </a>
                  </li>
                </ul>
              </nav>
            </section>
          </div>

          <section
            className={styles.paymentMethodsSection}
            aria-labelledby="footer-payment-methods-title"
          >
            <h2 id="footer-payment-methods-title" className="sr-only">
              {paymentMethodsLabel[locale]}
            </h2>
            <ul className={styles.paymentMethodsCard}>
              {paymentMethods.map((method) => (
                <li key={method.label} className={styles.paymentMethod}>
                  <Image
                    src={method.src}
                    alt={method.label}
                    width={64}
                    height={64}
                    sizes="52px"
                    className={styles.paymentMethodIcon}
                  />
                </li>
              ))}
            </ul>
          </section>
        </Container>

        <div className="border-t border-background/15">
          <Container fullWidth className="px-5 py-gap-md sm:px-8 lg:grid lg:grid-cols-[auto_1fr] lg:items-center lg:gap-x-12 lg:px-12 xl:px-16">
            <p className="text-body-md text-background/75 sm:text-body-sm">
              © De Notenman · {dictionary.footer.copyright}
            </p>
            <nav
              aria-label={dictionary.footer.legalTitle}
              className="mt-2 lg:mt-0"
            >
              <ul className="flex flex-wrap items-center gap-x-gap-md lg:justify-end">
                <li>
                  <Link
                    href={pagePath("terms", locale)}
                    className={footerLegalLinkClass}
                  >
                    {dictionary.footer.terms}
                  </Link>
                </li>
                <li>
                  <Link
                    href={pagePath("additionalTerms", locale)}
                    className={footerLegalLinkClass}
                  >
                    {dictionary.footer.additionalTerms}
                  </Link>
                </li>
                <li>
                  <Link
                    href={pagePath("privacy", locale)}
                    className={footerLegalLinkClass}
                  >
                    {dictionary.footer.privacy}
                  </Link>
                </li>
                <li>
                  <Link
                    href={pagePath("cookies", locale)}
                    className={footerLegalLinkClass}
                  >
                    {dictionary.footer.cookies}
                  </Link>
                </li>
                <li>
                  <CookieSettingsButton
                    label={dictionary.footer.cookieSettings}
                  />
                </li>
                <li>
                  <Link
                    href={pagePath("withdrawal", locale)}
                    className={footerLegalLinkClass}
                  >
                    {dictionary.footer.withdrawal}
                  </Link>
                </li>
                <li>
                  <Link
                    href={pagePath("processingAgreement", locale)}
                    className={footerLegalLinkClass}
                  >
                    {dictionary.footer.processingAgreement}
                  </Link>
                </li>
              </ul>
            </nav>
          </Container>
        </div>
      </footer>
    </>
  );
}
