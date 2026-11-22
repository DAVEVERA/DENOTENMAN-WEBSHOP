import assert from "node:assert/strict";
import test from "node:test";
import { actionableAuditFindings } from "../lib/ai-vindbaarheid/audit-findings";
import type { RenderedProductPageAudit } from "../lib/rendered-product-page-audit";

test("findings list only failed checks with higher impact first", () => {
  const pages: RenderedProductPageAudit[] = [{
    locale: "nl",
    url: "https://denotenman.com/nl/producten/amandelen",
    status: 200,
    score: 50,
    checks: [
      { code: "title", label: "Titel", passed: false, detail: "", recommendation: "Verbeter titel" },
      { code: "robots", label: "Robots", passed: false, detail: "", recommendation: "Verwijder noindex" },
      { code: "h1", label: "H1", passed: true, detail: "", recommendation: "Geen actie" },
    ],
  }];
  const findings = actionableAuditFindings(pages);
  assert.equal(findings.length, 2);
  assert.deepEqual(findings.map((finding) => finding.code), ["robots", "title"]);
  assert.deepEqual(findings.map((finding) => finding.priority), ["hoog", "normaal"]);
  assert.equal(findings[0].locale, "nl");
  assert.equal(findings[0].url, pages[0].url);
});

test("a clean audit produces no improvement actions", () => {
  const pages: RenderedProductPageAudit[] = [{
    locale: "en", url: "https://denotenman.com/en/products/almonds", status: 200, score: 100,
    checks: [{ code: "h1", label: "H1", passed: true, detail: "", recommendation: "No action" }],
  }];
  assert.deepEqual(actionableAuditFindings(pages), []);
});
