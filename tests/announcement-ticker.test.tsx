import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { AnnouncementTicker } from "../components/home/AnnouncementTicker";
import { getAnnouncementTickerCopy } from "../lib/customer-service-content";

test("announcement ticker is compact, branded and links to the market page", () => {
  const markup = renderToStaticMarkup(
    <AnnouncementTicker copy={getAnnouncementTickerCopy("nl")} />
  );

  assert.match(markup, /bg-black text-white/);
  assert.match(markup, /font-heading/);
  assert.match(markup, /Donderdag/);
  assert.match(markup, /Hilvarenbeek/);
  assert.match(markup, /href="\/nl\/paginas\/markten"/);
  assert.match(markup, /aria-label="Pauzeer marktticker"/);
  assert.match(markup, /aria-live="off"/);
});

test("announcement ticker auto-rotates but respects reduced motion", () => {
  const source = readFileSync("components/home/AnnouncementTicker.tsx", "utf8");
  const homepageSource = readFileSync("app/[locale]/page.tsx", "utf8");

  assert.match(source, /window\.setInterval/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /if \(paused \|\| reducedMotion/);
  assert.ok(homepageSource.indexOf("<AnnouncementTicker") < homepageSource.indexOf("<SiteShell"));
});
