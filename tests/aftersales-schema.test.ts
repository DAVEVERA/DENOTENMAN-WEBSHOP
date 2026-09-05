import assert from "node:assert/strict";
import test from "node:test";
import { aftersalesFlowInputSchema } from "../lib/aftersales/schema";

const localeContent = {
  subject: "Bestelling {{order_number}} van {{first_name}}",
  previewText: "Betaling ontvangen",
  heading: "Bedankt, {{first_name}}",
  body: "Je bestelling met totaal {{order_total}} wordt verwerkt.",
  buttonLabel: "Bekijk je bestelling",
};

const defaultDesign = {
  layout: "CLASSIC" as const,
  font: "SANS" as const,
  fontSize: "STANDAARD" as const,
  mediaUrl: null,
  mediaAlt: "",
};

function stepContent() {
  return {
    locales: { nl: { ...localeContent }, en: { ...localeContent }, fr: { ...localeContent } },
    design: defaultDesign,
  };
}

function validFlow() {
  return {
    id: "flow-1",
    name: "Bestelling en verzending",
    flowType: "PARTICULIER" as const,
    isActive: true,
    logoUrl: null,
    version: "2026-08-19T08:00:00.000Z",
    steps: [
      {
        id: "paid",
        trigger: "ORDER_PAID",
        name: "Bedankt",
        position: 0,
        enabled: true,
        delayMinutes: 0,
        content: stepContent(),
      },
      {
        id: "fulfilled",
        trigger: "ORDER_FULFILLED",
        name: "Verzonden",
        position: 1,
        enabled: true,
        delayMinutes: 0,
        content: stepContent(),
      },
      {
        id: "stock",
        trigger: "BACK_IN_STOCK",
        name: "Voorraadmelding",
        position: 2,
        enabled: true,
        delayMinutes: 0,
        content: {
          ...stepContent(),
          locales: Object.fromEntries(["nl", "en", "fr"].map((locale) => [locale, {
            subject: "{{product_name}} is weer op voorraad",
            previewText: "Bekijk {{product_name}}",
            heading: "Weer op voorraad",
            body: "Bestel via {{product_url}}",
            buttonLabel: "Bekijk product",
          }])) as ReturnType<typeof stepContent>["locales"],
        },
      },
    ],
  };
}

test("aftersales flow accepts the three required trigger types and supported tokens", () => {
  assert.equal(aftersalesFlowInputSchema.safeParse(validFlow()).success, true);
});

test("aftersales flow rejects unknown personalization fields", () => {
  const input = validFlow();
  input.steps[0].content.locales.nl.subject = "Hallo {{password}}";
  const parsed = aftersalesFlowInputSchema.safeParse(input);
  assert.equal(parsed.success, false);
  assert.match(JSON.stringify(parsed.error?.flatten()), /ondersteunde personalisatievelden/);
});

test("aftersales flow cannot lose or duplicate a required trigger type", () => {
  const input = validFlow();
  input.steps[1].trigger = "ORDER_PAID";
  const parsed = aftersalesFlowInputSchema.safeParse(input);
  assert.equal(parsed.success, false);
  assert.match(JSON.stringify(parsed.error?.flatten()), /precies één stap per triggertype/);
});

test("stock messages reject order-only fields and order messages reject stock-only fields", () => {
  const stock = validFlow();
  stock.steps[2].content.locales.nl.subject = "Hallo {{first_name}}";
  assert.equal(aftersalesFlowInputSchema.safeParse(stock).success, false);
  const order = validFlow();
  order.steps[0].content.locales.nl.subject = "Hallo {{product_name}}";
  assert.equal(aftersalesFlowInputSchema.safeParse(order).success, false);
});

import { AFTERSALES_TRIGGERS, PARTICULIER_TRIGGERS, BUSINESS_TRIGGERS, AFTERSALES_TRIGGERS_BY_FLOW_TYPE } from "../lib/aftersales/schema";

test("business triggers are disjoint from particuliere triggers and both are covered", () => {
  const overlap = PARTICULIER_TRIGGERS.filter((t) => (BUSINESS_TRIGGERS as readonly string[]).includes(t));
  assert.deepEqual(overlap, []);
  assert.deepEqual(
    [...PARTICULIER_TRIGGERS, ...BUSINESS_TRIGGERS].sort(),
    [...AFTERSALES_TRIGGERS].sort()
  );
});

test("AFTERSALES_TRIGGERS_BY_FLOW_TYPE maps each flow type to its own trigger set", () => {
  assert.deepEqual(AFTERSALES_TRIGGERS_BY_FLOW_TYPE.PARTICULIER, PARTICULIER_TRIGGERS);
  assert.deepEqual(AFTERSALES_TRIGGERS_BY_FLOW_TYPE.ZAKELIJK, BUSINESS_TRIGGERS);
});
