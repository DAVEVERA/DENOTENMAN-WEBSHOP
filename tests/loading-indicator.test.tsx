import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LoadingIndicator } from "../components/ui/LoadingIndicator";

test("cashew loader reserves dimensions and exposes its status label", () => {
  const markup = renderToStaticMarkup(
    <LoadingIndicator label="Product laden…" size="lg" showLabel />,
  );

  assert.match(markup, /role="status"/);
  assert.match(markup, /aria-live="polite"/);
  assert.match(markup, /Product laden…/);
  assert.match(markup, /dn-cashew-loader--lg/);
  assert.match(markup, /cashew-transparent\.png/);
  assert.match(markup, /width="1239"/);
  assert.match(markup, /height="1270"/);
});

test("decorative compact loader does not create a nested live region", () => {
  const markup = renderToStaticMarkup(<LoadingIndicator size="sm" decorative />);
  assert.match(markup, /aria-hidden="true"/);
  assert.doesNotMatch(markup, /role="status"/);
  assert.match(markup, /dn-cashew-loader--sm/);
});

test("loader stylesheet includes a reduced-motion fallback and stable size variants", () => {
  const css = readFileSync("components/ui/LoadingIndicator.loader.css", "utf8");
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\.dn-cashew-loader--sm/);
  assert.match(css, /\.dn-cashew-loader--lg/);
  assert.doesNotMatch(css, /dn-truckloader|dn-tl-/);
});
