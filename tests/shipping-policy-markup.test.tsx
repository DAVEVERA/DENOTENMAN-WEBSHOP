import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ShippingReturns } from "../app/[locale]/pages/[slug]/_components/ShippingReturns";

test("shows every country rate, threshold and the return window from checkout policy", () => {
  const html = renderToStaticMarkup(<ShippingReturns locale="nl" />);

  assert.match(html, /€(?:\s|&nbsp;|\u00a0)50,00/);
  assert.match(html, /€(?:\s|&nbsp;|\u00a0)70,00/);
  assert.match(html, /€(?:\s|&nbsp;|\u00a0)5,95/);
  assert.match(html, /€(?:\s|&nbsp;|\u00a0)6,95/);
  assert.match(html, /€(?:\s|&nbsp;|\u00a0)6,65/);
  assert.match(html, /€(?:\s|&nbsp;|\u00a0)8,75/);
  assert.match(html, /14 dagen bedenktijd/);
  assert.match(html, /ongeopend is en .*verzegeling intact is/i);
  assert.doesNotMatch(html, /€(?:\s|&nbsp;|\u00a0)(?:4,95|7,95|40,00)/);
});
