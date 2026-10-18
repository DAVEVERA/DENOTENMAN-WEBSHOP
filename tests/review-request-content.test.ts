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
  // The opt-out moved out of `body` into its own canvas block, so it renders
  // below the approved Google block instead of above it.
  const locales = AFTERSALES_STEP_DEFAULTS.REVIEW_REQUEST!.resolved!.locales;
  assert.match(locales.nl.blockText.optout, /afmeld/i);
  assert.match(locales.en.blockText.optout, /unsubscribe/i);
  assert.match(locales.fr.blockText.optout, /désabonn/i);
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

test("the review request ships the approved question and button label", () => {
  // Both live inside the approved Google block now, not in the plain body.
  const nl = AFTERSALES_STEP_DEFAULTS.REVIEW_REQUEST!.resolved!.locales.nl;
  assert.match(nl.blockText.google, /Bent u tevreden over onze service\?/);
  assert.match(nl.blockText.google, /Laat een review achter/);
  assert.equal(nl.buttonLabel, "Laat een review achter");
});

test("the review request step ships a hand-built canvas, not the derived one", () => {
  const resolved = AFTERSALES_STEP_DEFAULTS.REVIEW_REQUEST!.resolved;
  assert.ok(resolved, "no canvas is seeded, so the approved design is not what goes out");
  const blocks = resolved.canvas.rows.flatMap((row) => row.columns.flatMap((column) => column.blocks));
  assert.ok(blocks.some((block) => block.type === "customHtml"), "the Google block is missing");
});
