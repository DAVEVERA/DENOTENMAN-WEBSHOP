import assert from "node:assert/strict";
import test from "node:test";
import {
  createProductVisibilityUndoToken,
  verifyProductVisibilityUndoToken,
} from "../lib/product-visibility-undo";

const previousSecret = process.env.ADMIN_SESSION_SECRET;
process.env.ADMIN_SESSION_SECRET = "release-qa-product-undo-secret";

test.after(() => {
  if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = previousSecret;
});

test("visibility undo token is bound to product, admin, state, version and ten-second expiry", async () => {
  const now = Date.parse("2026-10-04T12:00:00.000Z");
  const expected = {
    productId: "product-1",
    adminUserId: "admin-1",
    currentIsActive: false,
    targetIsActive: true,
    version: "2026-10-04T12:00:00.000Z",
  };
  const token = await createProductVisibilityUndoToken(expected, now);

  assert.equal(await verifyProductVisibilityUndoToken(token, expected, now + 9_999), true);
  assert.equal(await verifyProductVisibilityUndoToken(token, expected, now + 10_001), false);
  assert.equal(await verifyProductVisibilityUndoToken(token, { ...expected, productId: "product-2" }, now), false);
  assert.equal(await verifyProductVisibilityUndoToken(token, { ...expected, adminUserId: "admin-2" }, now), false);
  assert.equal(await verifyProductVisibilityUndoToken(token, { ...expected, version: "2026-10-04T12:00:01.000Z" }, now), false);
  const replacement = token.endsWith("a") ? "b" : "a";
  assert.equal(await verifyProductVisibilityUndoToken(`${token.slice(0, -1)}${replacement}`, expected, now), false);
});
