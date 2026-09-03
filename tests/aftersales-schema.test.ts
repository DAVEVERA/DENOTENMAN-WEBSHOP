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
    locales: { nl: localeContent, en: localeContent, fr: localeContent },
    design: defaultDesign,
  };
}

function validFlow() {
  return {
    id: "flow-1",
    name: "Bestelling en verzending",
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
    ],
  };
}

test("aftersales flow accepts the two required transaction events and supported tokens", () => {
  assert.equal(aftersalesFlowInputSchema.safeParse(validFlow()).success, true);
});

test("aftersales flow rejects unknown personalization fields", () => {
  const input = validFlow();
  input.steps[0].content.locales.nl.subject = "Hallo {{password}}";
  const parsed = aftersalesFlowInputSchema.safeParse(input);
  assert.equal(parsed.success, false);
  assert.match(JSON.stringify(parsed.error?.flatten()), /ondersteunde personalisatievelden/);
});

test("aftersales flow cannot lose or duplicate a required event", () => {
  const input = validFlow();
  input.steps[1].trigger = "ORDER_PAID";
  const parsed = aftersalesFlowInputSchema.safeParse(input);
  assert.equal(parsed.success, false);
  assert.match(JSON.stringify(parsed.error?.flatten()), /precies één bestel- en één verzendstap/);
});
