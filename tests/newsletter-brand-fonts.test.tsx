import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FontSelect } from "../app/admin/(dashboard)/marketing/nieuwsbrieven/NewsletterStyleControls";
import { DEFAULT_NEWSLETTER_THEME } from "../lib/newsletter/document";

test("new newsletters use Dosis and Montserrat and the editor offers only those house fonts", () => {
  assert.equal(DEFAULT_NEWSLETTER_THEME.font, "montserrat");
  assert.equal(DEFAULT_NEWSLETTER_THEME.headingFont, "dosis");
  const html = renderToStaticMarkup(<FontSelect label="Lettertype" value="montserrat" onChange={() => undefined} />);
  assert.match(html, />Montserrat \(huisstijl\)</u);
  assert.match(html, />Dosis \(huisstijl\)</u);
  assert.doesNotMatch(html, />Arial</u);
  assert.doesNotMatch(html, />Verdana</u);
});
