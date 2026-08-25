import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { AnnouncementTicker } from "../components/home/AnnouncementTicker";
import { getAnnouncementTickerCopy } from "../lib/customer-service-content";
import nl from "../dictionaries/nl.json";

test("announcement bar keeps every USP visible in a fixed responsive grid", () => {
  const markup = renderToStaticMarkup(
    <AnnouncementTicker copy={getAnnouncementTickerCopy("nl", nl.usp)} />
  );

  assert.match(markup, /bg-black text-white/);
  assert.match(markup, /aria-label="Voordelen van De Notenman"/);
  assert.equal((markup.match(/Dagelijks vers gebrand/g) ?? []).length, 1);
  assert.equal((markup.match(/Persoonlijk advies van De Notenman/g) ?? []).length, 1);
  assert.equal((markup.match(/Jarenlange ervaring op de markt/g) ?? []).length, 1);
  assert.equal((markup.match(/Gratis verzending vanaf/g) ?? []).length, 1);
  assert.equal((markup.match(/width="14" height="14"/g) ?? []).length, 4);
  assert.match(markup, /%2Fbrand%2Ffavicon\.png/);
  assert.match(markup, /grid-cols-2 lg:grid-cols-4/);
  assert.doesNotMatch(markup, /<button/);
  assert.doesNotMatch(markup, /aria-hidden="true"[^>]*>[^<]*Dagelijks vers gebrand/);
});

test("announcement bar contains no slider or animation runtime", () => {
  const source = readFileSync("components/home/AnnouncementTicker.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.doesNotMatch(source, /TickerGroup|duplicate|useEffect|useState|setInterval|Pause|Play/);
  assert.doesNotMatch(css, /announcement-ticker-scroll|announcement-ticker__track|translate3d\(-50%/);
});
