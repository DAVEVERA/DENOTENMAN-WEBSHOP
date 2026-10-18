import assert from "node:assert/strict";
import test from "node:test";
import { AFTERSALES_STEP_DEFAULTS } from "../lib/aftersales/step-defaults";

test("the review request step is seeded in all three locales", () => {
  const step = AFTERSALES_STEP_DEFAULTS.REVIEW_REQUEST;
  assert.ok(step, "REVIEW_REQUEST has no seed content");
  assert.ok(step.name.length > 0);
  for (const locale of ["nl", "en", "fr"] as const) {
    const copy = step.content.locales[locale];
    assert.ok(copy.subject.length > 0, `${locale} subject is empty`);
    assert.ok(copy.previewText.length > 0, `${locale} previewText is empty`);
    assert.ok(copy.heading.length > 0, `${locale} heading is empty`);
    assert.ok(copy.body.length > 0, `${locale} body is empty`);
    assert.ok(copy.buttonLabel.length > 0, `${locale} buttonLabel is empty`);
  }
});

test("the review request copy carries an opt-out line in every locale", () => {
  const locales = AFTERSALES_STEP_DEFAULTS.REVIEW_REQUEST!.content.locales;
  assert.match(locales.nl.body, /afmeld/i);
  assert.match(locales.en.body, /unsubscribe/i);
  assert.match(locales.fr.body, /désabonn/i);
});

test("the review request copy never references a tracking code", () => {
  const locales = AFTERSALES_STEP_DEFAULTS.REVIEW_REQUEST!.content.locales;
  for (const locale of ["nl", "en", "fr"] as const) {
    const copy = locales[locale];
    assert.ok(!copy.body.includes("{{tracking_code}}"), `${locale} body references tracking_code`);
    assert.ok(!copy.subject.includes("{{tracking_code}}"), `${locale} subject references tracking_code`);
    assert.ok(!copy.previewText.includes("{{tracking_code}}"), `${locale} previewText references tracking_code`);
  }
});

test("the review request copy asks the question from the approved design", () => {
  const nl = AFTERSALES_STEP_DEFAULTS.REVIEW_REQUEST!.content.locales.nl;
  assert.match(nl.body, /Bent u tevreden over onze service\?/);
  assert.equal(nl.buttonLabel, "Laat een review achter");
});
