import assert from "node:assert/strict";
import test from "node:test";
import { rankTypoMatches, typoMatchScore } from "../lib/catalog-fuzzy";

test("catalog typo matching tolerates missing letters and accents", () => {
  assert.equal(typoMatchScore("amndelen", "Amandelen naturel"), 1);
  assert.equal(typoMatchScore("pistache notn", "Pistache noten"), 1);
  assert.equal(typoMatchScore("pecan", "Pécannoten"), 0);
});

test("catalog typo matching rejects unrelated products and ranks the closest match first", () => {
  assert.equal(typoMatchScore("amndelen", "Pistachenoten"), null);
  const matches = rankTypoMatches("amndelen", [
    { id: "b", names: ["Pistachenoten"] },
    { id: "a", names: ["Amandelen naturel"] },
    { id: "c", names: ["Amandelmeel"] },
  ]);
  assert.deepEqual(matches.map((item) => item.id), ["a"]);
});
