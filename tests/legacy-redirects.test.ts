import assert from "node:assert/strict";
import test from "node:test";
import { legacyWordpressRedirects } from "../lib/legacyRedirects";

test("permanently redirects the removed roasted shelled pistachio product", () => {
  const redirects = legacyWordpressRedirects();
  const destination = "/nl/categorie/pistachenoten";

  assert.deepEqual(
    redirects.find(
      (redirect) => redirect.source === "/nl/producten/pistaches-gepeld-gebrand"
    ),
    {
      source: "/nl/producten/pistaches-gepeld-gebrand",
      destination,
      permanent: true,
    }
  );
  assert.deepEqual(
    redirects.find(
      (redirect) => redirect.source === "/product/pistaches-gepeld-gebrand"
    ),
    {
      source: "/product/pistaches-gepeld-gebrand",
      destination,
      permanent: true,
    }
  );
});
