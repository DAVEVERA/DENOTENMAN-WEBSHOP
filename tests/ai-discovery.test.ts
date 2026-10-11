import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import robots from "../app/robots";
import { GET } from "../app/llms.txt/route";
import { buildLlmsTxt } from "../lib/llms-discovery";

test("AI search crawlers can discover public pages without opening private flows", () => {
  const rules = robots().rules;
  assert.ok(Array.isArray(rules));

  const discovery = rules.find((rule) =>
    Array.isArray(rule.userAgent) && rule.userAgent.includes("OAI-SearchBot")
  );
  assert.ok(discovery);
  assert.deepEqual(discovery.allow, "/");
  assert.ok(Array.isArray(discovery.disallow));
  assert.ok(discovery.disallow.includes("/admin"));
  assert.ok(discovery.disallow.includes("/api"));
  assert.ok(discovery.disallow.some((path) => path.endsWith("/cart")));

  const training = rules.find((rule) =>
    Array.isArray(rule.userAgent) && rule.userAgent.includes("GPTBot")
  );
  assert.ok(training);
  assert.equal(training.disallow, "/");
});

test("llms.txt is a concise curated index with canonical absolute links", async () => {
  const body = buildLlmsTxt("https://denotenman.com/");
  assert.match(body, /^# De Notenman\n/);
  assert.match(body, /https:\/\/denotenman\.com\/nl/);
  assert.match(body, /https:\/\/denotenman\.com\/products\/sitemap\.xml/);
  assert.match(body, /https:\/\/denotenman\.com\/sitemap\.xml/);
  assert.doesNotMatch(body, /\/admin|\/checkout|\/cart/);

  const response = GET();
  assert.match(response.headers.get("content-type") ?? "", /^text\/markdown/);
  assert.match(response.headers.get("link") ?? "", /rel="describedby"/);
  assert.match(await response.text(), /^# De Notenman\n/);
});

test("localized pages advertise the root llms.txt discovery file", () => {
  const layout = readFileSync("app/[locale]/layout.tsx", "utf8");
  assert.match(layout, /<link rel="describedby" href="\/llms\.txt" type="text\/markdown" \/>/);
});
