import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const footerSource = readFileSync("components/layout/Footer.tsx", "utf8");
const footerStyles = readFileSync(
  "components/layout/Footer.module.css",
  "utf8",
);

test("footer exposes the four Design A content groups", () => {
  for (const id of [
    "footer-shop-title",
    "footer-help-title",
    "footer-markets-title",
    "footer-newsletter-title",
  ]) {
    assert.match(footerSource, new RegExp(`aria-labelledby="${id}"`));
    assert.match(footerSource, new RegExp(`id="${id}"`));
  }
});

test("footer uses canonical localized routes and central market content", () => {
  assert.match(footerSource, /getCustomerServiceCopy\(locale\)/);
  assert.match(footerSource, /categoriesPath\(locale\)/);
  assert.match(footerSource, /categoryPath\(locale, category\.slug\)/);
  assert.match(footerSource, /pagePath\("faq", locale\)/);
  assert.match(footerSource, /pagePath\("contact", locale\)/);
  assert.match(footerSource, /pagePath\("markets", locale\)/);
  assert.doesNotMatch(footerSource, /Hilvarenbeek|Uden|Antwerpen/);
});

test("business CTA appears only in the footer directly after About us", () => {
  const compactHeaderSource = readFileSync("components/layout/CompactHeader.tsx", "utf8");
  const aboutLink = footerSource.indexOf('pagePath("about", locale)');
  const businessLink = footerSource.indexOf("dictionary.nav.business");

  assert.doesNotMatch(compactHeaderSource, /dictionary\.nav\.business/);
  assert.ok(aboutLink >= 0);
  assert.ok(businessLink > aboutLink);
  assert.match(footerSource.slice(aboutLink, businessLink), /<\/li>\s*<li>/);
});

test("footer keeps legal links in the lower bar and touch targets usable", () => {
  const contentGroupsEnd = footerSource.indexOf(
    "border-t border-background/15",
  );
  const legalNavigation = footerSource.indexOf("dictionary.footer.legalTitle");

  assert.ok(contentGroupsEnd > 0);
  assert.ok(legalNavigation > contentGroupsEnd);
  assert.match(footerSource, /pagePath\("terms", locale\)/);
  assert.match(footerSource, /pagePath\("privacy", locale\)/);
  assert.match(footerSource, /pagePath\("cookies", locale\)/);
  assert.match(footerSource, /CookieSettingsButton/);
  assert.match(footerSource, /min-h-11/);
});

test("footer includes the functional newsletter band", () => {
  assert.match(footerSource, /<NewsletterSignup/);
  assert.match(footerSource, /privacyHref=\{pagePath\("privacy", locale\)\}/);
  assert.match(footerSource, /<Container fullWidth/);
});

test("footer omits the truck strip and its yellow-to-anthracite gradient", () => {
  assert.doesNotMatch(footerSource, /notenman-pindatruck-alpha|truckLane|truckRig|truckVisual|truckMessage/);
  assert.doesNotMatch(footerSource, /Verzending binnen 24 uur/);
  assert.doesNotMatch(footerStyles, /\.truck|@keyframes truck-/);
  assert.doesNotMatch(footerStyles, /linear-gradient\(180deg, #e0b200 0, #121212 4\.5rem/);
});

test("footer shows the supplied Mollie payment banner, not the old per-method icons", () => {
  assert.match(footerSource, /\/payment\/mollie-secure-payments-nl\.svg/);
  // The per-method squircles were replaced by one banner; a leftover reference
  // would 404, because those files are gone from public/.
  assert.doesNotMatch(footerSource, /Mollie - Payment Methods/);

  assert.match(footerSource, /aria-labelledby="footer-payment-methods-title"/);
  assert.match(footerSource, /className=\{styles\.paymentMethodsBanner\}/);
  assert.doesNotMatch(footerSource, /styles\.paymentMethodsCard/);
  assert.match(footerStyles, /\.paymentMethodsBanner\s*\{[\s\S]*max-width: 100%/);
  assert.match(footerStyles, /\.paymentMethodsBanner\s*\{[\s\S]*height: auto/);
  assert.doesNotMatch(footerStyles, /paymentMethod:hover|payment-method-slide-in/);
});

test("the payment banner is described per locale instead of by file name", () => {
  // A decorative alt like "Mollie" tells a screen reader nothing about which
  // methods the shop accepts.
  for (const needle of [/iDEAL, creditcard en PayPal/, /iDEAL, credit card and PayPal/, /carte de crédit et PayPal/]) {
    assert.match(footerSource, needle);
  }
  assert.match(footerSource, /alt=\{paymentMethodsAlt\[locale\]\}/);
});

test("footer shows verified social channels as rings that sit in the dark", () => {
  assert.match(footerSource, /https:\/\/www\.facebook\.com\/denotenman/);
  assert.match(footerSource, /https:\/\/instagram\.com\/de_notenman/);
  assert.match(footerSource, /CUSTOMER_SERVICE_WHATSAPP_URL/);
  assert.match(footerSource, /aria-labelledby="footer-social-media-title"/);
  assert.match(footerSource, /target="_blank"/);
  assert.match(footerSource, /rel="noopener noreferrer"/);
  // The light card was replaced by rings that sit in the dark footer.
  assert.doesNotMatch(footerStyles, /#e8e8e8/);
  assert.match(footerStyles, /\.socialMediaLink\s*\{[\s\S]*border-radius: 999px/);
  assert.match(footerStyles, /\.socialMediaLink\s*\{[\s\S]*border: 1px solid rgb\(246 243 238 \/ 22%\)/);
  // 44px keeps the tap target usable now that there is no filled button.
  assert.match(footerStyles, /\.socialMediaLink\s*\{[\s\S]*width: 2\.75rem/);
  assert.match(footerStyles, /@keyframes social-media-icon-slide-in/);
  assert.match(footerStyles, /\.socialMediaFacebook:hover\s*\{[\s\S]*#1877f2/);
  assert.match(footerStyles, /\.socialMediaInstagram:hover\s*\{[\s\S]*#d62976/);
  assert.match(footerStyles, /\.socialMediaWhatsapp:hover\s*\{[\s\S]*#25d366/);
});
