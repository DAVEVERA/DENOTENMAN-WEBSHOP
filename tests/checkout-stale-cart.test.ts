import assert from "node:assert/strict";
import test from "node:test";

import * as orders from "@/lib/orders";

test("resolves a stale variant id by stable product slug and localized variant label", () => {
  const resolveCheckoutVariant = (
    orders as typeof orders & {
      resolveCheckoutVariant?: (
        line: {
          variantId: string;
          quantity: number;
          productSlug?: string;
          variantLabel?: string;
        },
        variants: Array<{
          id: string;
          product: { slug: string };
          translations: Array<{ locale: string; label: string }>;
        }>,
        locale: "nl",
      ) => { id: string } | undefined;
    }
  ).resolveCheckoutVariant;

  const resolved = resolveCheckoutVariant?.(
    {
      variantId: "deleted-database-variant-id",
      quantity: 2,
      productSlug: "chocolade-amandelen-caramel-zeezout",
      variantLabel: "250 gram",
    },
    [
      {
        id: "current-variant-id",
        product: { slug: "chocolade-amandelen-caramel-zeezout" },
        translations: [{ locale: "nl", label: "250 gram" }],
      },
    ],
    "nl",
  );

  assert.equal(resolved?.id, "current-variant-id");
});
