import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGoogleAnalyticsPurchase,
  cartToGoogleAnalyticsItems,
  isMollieReferrer,
} from "../lib/analytics";
import {
  addCampaignParametersToOwnedUrl,
  campaignSlug,
} from "../lib/campaign-urls";

test("purchase payload uses the confirmed order id and excludes shipping from value", () => {
  const purchase = buildGoogleAnalyticsPurchase({
    id: "order_123",
    currency: "eur",
    subtotalCents: 2400,
    discountCode: "ZOMER",
    discountCents: 300,
    shippingCents: 495,
    items: [
      {
        variantId: "variant_1",
        productName: "Amandelen",
        variantLabel: "1 kg",
        unitPriceCents: 1200,
        quantity: 2,
      },
    ],
  });

  assert.deepEqual(purchase, {
    transaction_id: "order_123",
    value: 21,
    currency: "EUR",
    shipping: 4.95,
    coupon: "ZOMER",
    items: [
      {
        item_id: "variant_1",
        item_name: "Amandelen",
        affiliation: "De Notenman",
        item_variant: "1 kg",
        discount: 1.5,
        price: 10.5,
        quantity: 2,
      },
    ],
  });
});

test("checkout items contain stable variant ids and numeric euro prices", () => {
  const items = cartToGoogleAnalyticsItems([
    {
      variantId: "variant_2",
      productId: "product_2",
      slug: "cashews",
      name: "Cashews",
      variantLabel: "500 g",
      priceCents: 875,
      quantity: 3,
      imageUrl: null,
      locale: "nl",
    },
  ]);

  assert.equal(items[0]?.item_id, "variant_2");
  assert.equal(items[0]?.price, 8.75);
  assert.equal(items[0]?.quantity, 3);
});

test("only Mollie domains are recognized as payment-provider referrers", () => {
  assert.equal(isMollieReferrer("https://www.mollie.com/checkout/select-method"), true);
  assert.equal(isMollieReferrer("https://payments.mollie.com/payments/example"), true);
  assert.equal(isMollieReferrer("https://mollie.com.evil.example/"), false);
  assert.equal(isMollieReferrer("not a url"), false);
});

test("owned QR targets receive one consistent UTM set and external URLs stay untouched", () => {
  const tracked = addCampaignParametersToOwnedUrl(
    "https://www.denotenman.nl/nl/winkel?ref=kaart#noten",
    "https://denotenman.nl",
    {
      source: "QR code",
      medium: "offline",
      campaign: "Najaar op de Markt",
      content: "product",
    }
  );
  const url = new URL(tracked);

  assert.equal(url.searchParams.get("ref"), "kaart");
  assert.equal(url.searchParams.get("utm_source"), "qr_code");
  assert.equal(url.searchParams.get("utm_medium"), "offline");
  assert.equal(url.searchParams.get("utm_campaign"), "najaar_op_de_markt");
  assert.equal(url.searchParams.get("utm_content"), "product");
  assert.equal(url.hash, "#noten");
  assert.equal(
    addCampaignParametersToOwnedUrl("https://example.com", "https://denotenman.nl", {
      source: "qr",
      medium: "offline",
      campaign: "test",
    }),
    "https://example.com"
  );
  assert.equal(campaignSlug("Crème Brûlée 2026"), "creme_brulee_2026");
});
