import assert from "node:assert/strict";
import { sanitizeProductHtml, toProductPlainText } from "../lib/product-content";

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
  toProductPlainText('<h2>Smaak</h2><p>Vol &amp; romig</p><ul><li>Knapperig</li></ul>'),
  "Smaak Vol & romig Knapperig"
);

console.log("product content tests passed");
