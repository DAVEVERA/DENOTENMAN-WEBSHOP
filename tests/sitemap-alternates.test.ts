import assert from "node:assert/strict";
import test from "node:test";
import { getAlternates } from "../lib/alternates";

test("home alternates expose Dutch as the x-default fallback", async () => {
  const result = await getAlternates("en", { type: "home" });

  assert.deepEqual(result, {
    canonical: "/en",
    languages: {
      nl: "/nl",
      en: "/en",
      fr: "/fr",
      "x-default": "/nl",
    },
  });
});
