import assert from "node:assert/strict";
import {
  hasLegacyProductCopy,
  sanitizeProductHtml,
  sanitizeProductShortHtml,
  shouldPreserveImprovedProductCopy,
  toProductPlainText,
} from "../lib/product-content";

assert.equal(
  sanitizeProductHtml('<h2>Vers gebrand</h2><p>Rijk &amp; <strong>romig</strong>.</p>'),
  '<h2>Vers gebrand</h2><p>Rijk &amp; <strong>romig</strong>.</p>'
);
assert.equal(
  sanitizeProductHtml('<p onclick="alert(1)">Noten<script>alert(1)</script></p>'),
  "<p>Noten</p>"
);
assert.equal(
  sanitizeProductHtml('<a href="javascript:alert(1)">Onveilig</a><a href="https://denotenman.com/nl">Veilig</a>'),
  '<a>Onveilig</a><a href="https://denotenman.com/nl" rel="noopener noreferrer">Veilig</a>'
);
assert.equal(
  sanitizeProductHtml('<a href="//evil.example">Extern</a><a href="/nl/producten">Intern</a>'),
  '<a>Extern</a><a href="/nl/producten" rel="noopener noreferrer">Intern</a>'
);
assert.equal(
  toProductPlainText('<h2>Smaak</h2><p>Vol &amp; romig</p><ul><li>Knapperig</li></ul>'),
  "Smaak Vol & romig Knapperig"
);
assert.equal(toProductPlainText("Voor<h2>Na</h2>slot"), "Voor Na slot");
assert.doesNotThrow(() => toProductPlainText("&#999999999999999999999;"));
assert.equal(sanitizeProductHtml("<p><br></p>"), "");
assert.equal(sanitizeProductShortHtml("<p>&nbsp;</p>"), "");

assert.equal(
  sanitizeProductHtml(
    '<div class="evil"><b>Vol</b> en <i>zacht</i> <span style="color:red" class="x" onclick="alert(1)" data-rt-font="HEADING" data-rt-size="lg">van smaak</span></div>'
  ),
  '<p><strong>Vol</strong> en <em>zacht</em> <span data-rt-font="heading" data-rt-size="lg">van smaak</span></p>'
);

assert.equal(
  sanitizeProductShortHtml(
    '<h2>Titel</h2><p>Een <strong>korte</strong> tekst.</p><ul><li>Geen lijst</li></ul>'
  ),
  'Titel<p>Een <strong>korte</strong> tekst.</p>Geen lijst'
);

assert.equal(
  sanitizeProductShortHtml(
    '<span data-rt-font="comic-sans" data-rt-size="99px" style="font-size:99px" onmouseover="alert(1)">Veilig</span>'
  ),
  "<span>Veilig</span>"
);

for (const input of [
  '<div><b>Merktekst</b><br><span data-rt-font="body" data-rt-size="sm">Compact</span></div>',
  '<p><a href="/nl/producten">Relatief</a></p>',
]) {
  const once = sanitizeProductHtml(input);
  assert.equal(sanitizeProductHtml(once), once, `sanitizer must be idempotent for ${input}`);
}

const shortOnce = sanitizeProductShortHtml(
  '<div><b>Kort</b> <span data-rt-font="heading" data-rt-size="md">maar rijk</span></div>'
);
assert.equal(sanitizeProductShortHtml(shortOnce), shortOnce);

console.log("product content tests passed");

assert.equal(hasLegacyProductCopy("Een product dat uitnodigt om te proeven."), true);
assert.equal(hasLegacyProductCopy("Een specifieke productomschrijving."), false);
assert.equal(
  shouldPreserveImprovedProductCopy(
    "Een specifieke productomschrijving.",
    "Een product dat uitnodigt om te proeven.",
  ),
  true,
);
assert.equal(
  shouldPreserveImprovedProductCopy(
    "Een specifieke productomschrijving.",
    "Een nieuwe specifieke productomschrijving.",
  ),
  false,
);
