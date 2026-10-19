import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { aftersalesTestSampleFilters } from "../lib/aftersales/test-sample";

test("a review test mail is sampled from a delivered order, not a merely paid one", () => {
  const [real] = aftersalesTestSampleFilters("REVIEW_REQUEST");
  assert.equal(real.status, "FULFILLED");
  assert.equal(real.businessOrderListId, null);
  assert.equal(real.isTest, false);
});

test("the other triggers keep the sample they had", () => {
  assert.equal(aftersalesTestSampleFilters("ORDER_FULFILLED")[0].status, "FULFILLED");
  assert.deepEqual(aftersalesTestSampleFilters("ORDER_PAID")[0].status, { in: ["PAID", "FULFILLED"] });
});

test("the test send hands the review link to the renderer", async () => {
  const source = await readFile("app/api/admin/marketing/aftersales/test/route.ts", "utf8");
  // Without this a test of the review step throws instead of sending, because
  // the renderer refuses to build that mail without a destination.
  assert.match(source, /reviewActionUrlOverrideFor/, "the test send resolves no review override");
  assert.match(source, /REVIEW_URL_SETTING_KEY/, "the test send never reads the review link");
  const renderCall = source.slice(
    source.indexOf("const rendered = renderAftersalesEmail("),
    source.indexOf("const rendered = renderAftersalesEmail(") + 600
  );
  assert.match(renderCall, /actionUrlOverride/, "the override is not passed to the renderer");
});
