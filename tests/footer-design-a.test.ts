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

test("footer includes the functional newsletter band and the left-facing truck artwork", () => {
  assert.match(footerSource, /<NewsletterSignup/);
  assert.match(footerSource, /privacyHref=\{pagePath\("privacy", locale\)\}/);
  assert.match(footerSource, /src="\/footer\/notenman-pindatruck-alpha\.png"/);
  assert.match(footerSource, /width=\{1398\}/);
  assert.match(footerSource, /height=\{656\}/);
  assert.match(footerSource, /size="responsive"/);
  assert.match(footerSource, /<Container fullWidth/);
  assert.match(footerStyles, /linear-gradient\(180deg, #e0b200 0, #121212 4\.5rem/);
});

test("truck and exact 24-hour shipping copy form one moving rig", () => {
  assert.match(footerSource, />Verzending binnen 24 uur<\/p>/);
  assert.doesNotMatch(footerSource, /Gratis verzending vanaf/);
  assert.match(footerSource, /className=\{styles\.truckRig\}/);
  assert.match(footerSource, /className=\{styles\.truckVisual\}/);
  assert.match(footerSource, /className=\{styles\.truckMessage\}/);
  assert.match(footerStyles, /\.truckRig\s*\{[\s\S]*display: flex/);
  assert.match(footerStyles, /\.truckRig\s*\{[\s\S]*width: max-content/);
  assert.match(footerStyles, /\.truckVisual\s*\{[\s\S]*width: clamp\(7rem, 15vw, 12rem\)/);
});

test("complete rig crosses right to left with suspension and a matching road shadow", () => {
  assert.match(footerStyles, /translate3d\(100vw, 0, 0\)/);
  assert.match(footerStyles, /translate3d\(-100%, 0, 0\)/);
  assert.match(footerStyles, /animation: truck-crossing 22s linear infinite/);
  assert.match(
    footerStyles,
    /animation: truck-suspension 0\.72s ease-in-out infinite alternate/,
  );
  assert.match(
    footerStyles,
    /animation: truck-shadow 0\.72s ease-in-out infinite alternate/,
  );
  assert.match(footerStyles, /@keyframes truck-shadow/);
});

test("truck rig remains fully static and centered for reduced motion", () => {
  assert.match(footerStyles, /prefers-reduced-motion: reduce/);
  assert.match(
    footerStyles,
    /\.truckRig\s*\{[\s\S]*left: 50%;[\s\S]*animation: none;[\s\S]*translateX\(-50%\)/,
  );
  assert.match(
    footerStyles,
    /\.truck,[\s\S]*\.truckVisual::after\s*\{[\s\S]*animation: none/,
  );
});
