import assert from "node:assert/strict";
import test from "node:test";
import {
  indexablePageKeys,
  pageRobots,
  pageSlugs,
  type PageKey,
} from "../lib/pages";

test("empty newsletter utility pages stay routable but are excluded from sitemap page keys", () => {
  assert.equal(pageSlugs.optOut.nl, "afmelden-nieuwsbrief");
  assert.equal(indexablePageKeys.some((key) => (key as PageKey) === "optOut"), false);
  assert.equal(indexablePageKeys.some((key) => (key as PageKey) === "subscribe"), false);
});

test("empty newsletter utility pages use noindex,follow while content pages keep default robots", () => {
  assert.deepEqual(pageRobots("optOut"), { index: false, follow: true });
  assert.deepEqual(pageRobots("subscribe"), { index: false, follow: true });
  assert.equal(pageRobots("about"), undefined);
});
