import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { AnnouncementTicker } from "../components/home/AnnouncementTicker";
import { getAnnouncementTickerCopy } from "../lib/customer-service-content";
import nl from "../dictionaries/nl.json";

test("announcement ticker is compact, branded and repeats every USP for an infinite track", () => {
  const markup = renderToStaticMarkup(
    <AnnouncementTicker copy={getAnnouncementTickerCopy("nl", nl.usp)} />
  );

  assert.match(markup, /bg-black text-white/);
  assert.match(markup, /aria-label="Voordelen van De Notenman"/);
  assert.equal((markup.match(/Dagelijks vers gebrand/g) ?? []).length, 3);
  assert.equal((markup.match(/Persoonlijk advies van De Notenman/g) ?? []).length, 3);
  assert.equal((markup.match(/Jarenlange ervaring op de markt/g) ?? []).length, 3);
  assert.equal((markup.match(/width="18" height="18"/g) ?? []).length, 6);
  assert.match(markup, /%2Fbrand%2Ffavicon\.png/);
  assert.doesNotMatch(markup, /<button/);
  assert.doesNotMatch(markup, /Pauzeer|Start marktticker/);
});

test("announcement ticker continuously slides with CSS and respects reduced motion", () => {
  const source = readFileSync("components/home/AnnouncementTicker.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  const homepageSource = readFileSync("app/[locale]/page.tsx", "utf8");

  assert.doesNotMatch(source, /useEffect|useState|setInterval|Pause|Play/);
  assert.match(css, /announcement-ticker-scroll 24s linear infinite/);
  assert.match(css, /translate3d\(-50%/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.ok(homepageSource.indexOf("<AnnouncementTicker") < homepageSource.indexOf("<SiteShell"));
});
