import assert from "node:assert/strict";
import test from "node:test";
import { parseRunId } from "../scripts/verify-product-image-migration";

test("verification accepts exactly one safe run identity", () => {
  assert.equal(parseRunId(["--run-id=20260820-deadbeef"]), "20260820-deadbeef");
  assert.throws(() => parseRunId([]));
  assert.throws(() => parseRunId(["--run-id=../unsafe"]));
  assert.throws(() => parseRunId(["--run-id=one", "--run-id=two"]));
});
