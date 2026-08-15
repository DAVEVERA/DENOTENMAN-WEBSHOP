import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as panelModule from "../components/admin-panel/ProductAuditPanel";
import type { RenderedProductPageAudit } from "../lib/rendered-product-page-audit";

test("the audit UI shows rendered storefront checks per language", () => {
  const module = panelModule as unknown as {
    RenderedPageAuditPanel?: (props: { pages: RenderedProductPageAudit[] }) => React.ReactNode;
  };
  assert.equal(typeof module.RenderedPageAuditPanel, "function");
  if (!module.RenderedPageAuditPanel) return;

  const html = renderToStaticMarkup(
    <module.RenderedPageAuditPanel
      pages={[
        {
          locale: "nl",
          url: "https://denotenman.com/nl/producten/amandelen",
          status: 200,
          score: 88,
          checks: [
            { code: "canonical", label: "Canonical", passed: true, detail: "/nl/producten/amandelen", recommendation: "Voeg een self-referencing canonical toe." },
            { code: "hreflang", label: "Hreflang", passed: false, detail: "EN ontbreekt", recommendation: "Koppel ook de Engelse productpagina." },
          ],
        },
      ]}
    />
  );

  assert.match(html, /Gerenderde storefrontcontrole/);
  assert.match(html, /Nederlands/);
  assert.match(html, /88/);
  assert.match(html, /Canonical/);
  assert.match(html, /Hreflang/);
  assert.match(html, /Aanpak: Koppel ook de Engelse productpagina/);
  assert.match(html, /Open productpagina/);
});
