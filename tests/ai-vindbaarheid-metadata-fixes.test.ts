import assert from "node:assert/strict";
import test from "node:test";
import { canApplyMetadataFixes, planSafeMetadataFixes } from "../lib/ai-vindbaarheid/metadata-fixes";

test("fills only missing metadata using existing product facts", () => {
  const result = planSafeMetadataFixes([{
    locale: "nl",
    name: "Geroosterde ongezouten amandelen",
    shortDescription: "Geroosterde ongezouten amandelen met een knapperige bite, geschikt als snack bij de borrel of als toevoeging aan een salade.",
    seoTitle: null,
    metaDescription: null,
  }]);
  assert.deepEqual(result.map((item) => item.field), ["seoTitle", "metaDescription"]);
  assert.match(result[0].value, /De Notenman/);
});

test("does not overwrite existing SEO fields or invent missing product descriptions", () => {
  const result = planSafeMetadataFixes([{
    locale: "nl",
    name: "Amandelen",
    shortDescription: null,
    seoTitle: "Bestaande handmatige titel",
    metaDescription: "",
  }]);
  assert.equal(result.length, 0);
});

test("does not generate excessively long or short metadata", () => {
  const result = planSafeMetadataFixes([{
    locale: "fr",
    name: "A".repeat(75),
    shortDescription: "Te kort",
    seoTitle: null,
    metaDescription: null,
  }]);
  assert.equal(result.length, 0);
});

test("only owners and administrators can apply metadata fixes", () => {
  assert.equal(canApplyMetadataFixes("OWNER"), true);
  assert.equal(canApplyMetadataFixes("ADMIN"), true);
  assert.equal(canApplyMetadataFixes("STAFF"), false);
});

test("preserves the exact previous field value for optimistic updates", () => {
  const fixes = planSafeMetadataFixes([{ locale: "en", name: "Organic cashew nuts", shortDescription: null, seoTitle: "", metaDescription: null }]);
  assert.equal(fixes.length, 1);
  assert.equal(fixes[0].expected, "");
  assert.equal(fixes[0].field, "seoTitle");
});
