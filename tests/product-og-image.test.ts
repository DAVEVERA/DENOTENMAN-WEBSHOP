import assert from "node:assert/strict";
import test from "node:test";
import { OG_IMAGE_SIZE } from "../lib/seo/metadata";

// The route reaches the Prisma client through lib/queries, which refuses to be
// imported without a database of its own. Nothing here connects: these tests
// prove the card is described without a single query.
process.env.DATABASE_URL ??=
  "postgresql://test:test@127.0.0.1:5432/denotenman_test";

type ProductOgRoute = typeof import("../app/[locale]/products/[product]/opengraph-image");

async function loadRoute(): Promise<ProductOgRoute> {
  return import("../app/[locale]/products/[product]/opengraph-image");
}

// `next build` collects page data for this route before any product slug is
// known: /[locale] contributes static params, [product] is force-dynamic and
// contributes none, so generateImageMetadata runs with { locale } alone. It
// must describe the card from the brand fallback instead of querying the
// catalogue with an undefined slug.
test("the product share card is described without a product slug at build time", async () => {
  const { generateImageMetadata, size } = await loadRoute();

  const images = await generateImageMetadata({ params: { locale: "nl" } });

  assert.equal(images.length, 1);
  assert.equal(images[0].id, "card");
  assert.match(images[0].alt, /De Notenman/);
  assert.deepEqual(images[0].size, OG_IMAGE_SIZE);
  assert.deepEqual(size, OG_IMAGE_SIZE);
});

test("an empty product slug is not sent to the catalogue either", async () => {
  const { generateImageMetadata } = await loadRoute();

  const images = await generateImageMetadata({
    params: { locale: "nl", product: "" },
  });

  assert.equal(images.length, 1);
  assert.match(images[0].alt, /De Notenman/);
});
