import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const projectFile = (relativePath: string) =>
  readFile(path.join(process.cwd(), relativePath), "utf8");

test("GA4 page views are consent gated, explicit and supplied with final route context", async () => {
  const [consent, analytics] = await Promise.all([
    projectFile("components/privacy/CookieConsent.tsx"),
    projectFile("components/analytics/GoogleAnalytics.tsx"),
  ]);

  assert.match(consent, /consent\?\.analytics[\s\S]*?<GoogleAnalytics/);
  assert.match(analytics, /send_page_view: false/);
  assert.match(analytics, /sendGoogleAnalyticsEvent\("page_view"/);
  assert.match(analytics, /const currentTitle = document\.title\.trim\(\)/);
  assert.match(analytics, /const routeStartTitle = document\.title\.trim\(\)/);
  assert.match(analytics, /currentTitle === routeStartTitle/);
  assert.match(analytics, /actualRoute !== expectedRoute/);
  assert.match(analytics, /canonicalizeBrowserRoute/);
  assert.match(analytics, /resolveRoutePageTitle/);
  assert.match(analytics, /denotenmanGaConfig\.ignore_referrer = true/);
  assert.match(consent, /denyGoogleAnalyticsConsent\(\)/);
  assert.match(analytics, /page_title: pageTitle/);
  assert.match(analytics, /page_location: pageLocation/);
  assert.match(analytics, /usePathname\(\)/);
  assert.match(analytics, /useSearchParams\(\)/);
});

test("purchase is only exposed from a server-confirmed paid non-test order and is deduplicated", async () => {
  const [page, effects, orders] = await Promise.all([
    projectFile("app/[locale]/order/[orderId]/page.tsx"),
    projectFile("components/checkout/OrderStatusEffects.tsx"),
    projectFile("lib/orders.ts"),
  ]);

  assert.match(page, /syncOrderPaymentStatus\(existing/);
  assert.match(page, /Could not refresh payment status/);
  assert.match(page, /order\.isTest\s*\?\s*undefined/);
  assert.match(page, /view === "PAID"[\s\S]*?buildGoogleAnalyticsPurchase/);
  assert.match(effects, /sendGoogleAnalyticsEvent\("purchase"/);
  assert.match(effects, /denotenman-ga4-purchase:/);
  assert.match(effects, /window\.localStorage/);
  assert.match(effects, /!event\.detail\.analytics/);
  assert.match(orders, /onPaymentObserved/);
  assert.match(orders, /method: payment\.method/);
});

test("checkout emits standard funnel events and structured failure context", async () => {
  const checkout = await projectFile("components/checkout/CheckoutForm.tsx");

  assert.match(checkout, /sendGoogleAnalyticsEvent\("begin_checkout"/);
  assert.match(
    checkout,
    /sendGoogleAnalyticsEventBeforeNavigation\(\s*"add_payment_info"/
  );
  assert.match(checkout, /sendGoogleAnalyticsEvent\("checkout_error"/);
  assert.match(checkout, /sendGoogleAnalyticsEventBeforeNavigation/);
  assert.match(checkout, /error_code:/);
  assert.match(checkout, /delivery_method:/);
  assert.match(checkout, /payment_provider: "mollie"/);
});

test("future Mailchimp campaigns and owned QR targets receive campaign attribution", async () => {
  const [mailchimp, qr] = await Promise.all([
    projectFile("lib/mailchimp/newsletter.ts"),
    projectFile("components/admin-panel/qrcodes/QrCodeWorkbench.tsx"),
  ]);

  assert.match(mailchimp, /google_analytics: `denotenman_/);
  assert.match(mailchimp, /tracking: tracking\(input\)/);
  assert.match(qr, /addCampaignParametersToOwnedUrl/);
  assert.match(qr, /source: "qr_code"/);
  assert.match(qr, /medium: "offline"/);
});
