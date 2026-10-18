import assert from "node:assert/strict";
import test from "node:test";
import {
  AFTERSALES_TRIGGERS_BY_FLOW_TYPE,
  aftersalesFlowInputSchema,
  defaultAftersalesDesign,
  resolveLegacyStepContent,
  type AftersalesLegacyLocaleContent,
  type AftersalesTriggerValue,
} from "../lib/aftersales/schema";

// Token-free copy: every trigger allows a different token set, and this test is
// about how many steps a flow may hold, not about which tokens each one takes.
const plain: AftersalesLegacyLocaleContent = {
  subject: "Onderwerp",
  previewText: "Voorbeeldtekst",
  heading: "Kop",
  body: "Tekst zonder tokens.",
  buttonLabel: "Knop",
};

const content = resolveLegacyStepContent({
  locales: { nl: plain, en: plain, fr: plain },
  design: defaultAftersalesDesign,
});

function step(trigger: AftersalesTriggerValue, index: number) {
  return {
    id: `step-${trigger}-${index}`,
    trigger,
    name: `Stap ${trigger}`,
    position: index,
    enabled: true,
    delayMinutes: 0 as const,
    content,
  };
}

function flow(triggers: AftersalesTriggerValue[]) {
  return {
    id: "flow-p",
    name: "Particulier",
    flowType: "PARTICULIER" as const,
    isActive: true,
    logoUrl: null,
    version: new Date("2026-10-18T12:00:00Z").toISOString(),
    steps: triggers.map(step),
  };
}

const PARTICULIER = [...AFTERSALES_TRIGGERS_BY_FLOW_TYPE.PARTICULIER];

test("a flow saved before a new trigger existed is still savable", () => {
  // The live database holds one step per trigger that existed when it was
  // seeded. Adding a trigger to the app must not lock the editor: the step for
  // it is created by the backfill, which is gated behind a release flag.
  const withoutNewest = PARTICULIER.filter((trigger) => trigger !== "REVIEW_REQUEST");
  const result = aftersalesFlowInputSchema.safeParse(flow(withoutNewest));
  assert.ok(result.success, `three of four triggers was rejected: ${result.error?.message}`);
});

test("a flow holding every trigger stays savable", () => {
  const result = aftersalesFlowInputSchema.safeParse(flow(PARTICULIER));
  assert.ok(result.success, result.error?.message);
});

test("the same trigger twice is still refused", () => {
  const result = aftersalesFlowInputSchema.safeParse(flow(["ORDER_PAID", "ORDER_PAID"]));
  assert.equal(result.success, false);
});

test("a trigger from the other flow type is still refused", () => {
  const result = aftersalesFlowInputSchema.safeParse(flow(["ORDER_PAID", "BUSINESS_ORDER_PAID"]));
  assert.equal(result.success, false);
});

test("a flow with no steps at all is still refused", () => {
  const result = aftersalesFlowInputSchema.safeParse(flow([]));
  assert.equal(result.success, false);
});
