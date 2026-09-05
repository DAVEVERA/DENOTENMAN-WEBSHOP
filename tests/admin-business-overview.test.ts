import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(process.cwd(), "app/admin/(dashboard)/zakelijk/page.tsx"),
  "utf8",
);

test("business accounts are shown before the collapsible notification inbox", () => {
  const accountsIndex = source.indexOf('id="klantaccounts"');
  const notificationsIndex = source.indexOf('id="meldingen"');

  assert.ok(accountsIndex >= 0, "customer account section is missing");
  assert.ok(notificationsIndex > accountsIndex, "notifications must follow accounts");
  assert.match(source, /<details[^>]*id="meldingen"/);
  assert.match(source, /<summary/);
  assert.match(source, /Zakelijke meldingen/);
});

test("business account rows show order totals instead of account status", () => {
  assert.match(source, />Bestellingen<\/th>/);
  assert.doesNotMatch(source, />Status<\/th>/);
  assert.match(source, /orderCount/);
  assert.match(source, /orderLists\.reduce/);
});
