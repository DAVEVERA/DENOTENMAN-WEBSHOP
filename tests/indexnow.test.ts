import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCategoryIndexNowUrls,
  buildProductIndexNowUrls,
  readIndexNowConfig,
  submitIndexNowUrls,
} from "../lib/indexnow";

const configuredEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  SITE_URL: "https://denotenman.com",
  INDEXNOW_KEY: "Valid-Key-2026",
};

test("IndexNow configuration rejects malformed keys and non-http site URLs", () => {
  assert.equal(readIndexNowConfig({ ...configuredEnv, INDEXNOW_KEY: "short" }), undefined);
  assert.equal(
    readIndexNowConfig({ ...configuredEnv, SITE_URL: "file:///tmp/shop" }),
    undefined
  );
  assert.deepEqual(readIndexNowConfig(configuredEnv), {
    siteOrigin: "https://denotenman.com",
    host: "denotenman.com",
    key: "Valid-Key-2026",
    keyLocation: "https://denotenman.com/indexnow-key.txt",
  });
});

test("IndexNow submits unique same-origin URLs in one bounded request", async () => {
  let endpoint = "";
  let request: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    endpoint = input.toString();
    request = init;
    return new Response(null, { status: 202 });
  };

  const result = await submitIndexNowUrls(
    [
      "https://denotenman.com/nl/producten/amandelen",
      "https://denotenman.com/nl/producten/amandelen",
      "https://example.com/foreign",
    ],
    { env: configuredEnv, fetchImpl }
  );

  assert.deepEqual(result, { status: "submitted", submitted: 1, statusCode: 202 });
  assert.equal(endpoint, "https://api.indexnow.org/indexnow");
  assert.equal(request?.method, "POST");
  assert.equal(request?.headers && new Headers(request.headers).get("content-type"), "application/json; charset=utf-8");
  assert.deepEqual(JSON.parse(String(request?.body)), {
    host: "denotenman.com",
    key: "Valid-Key-2026",
    keyLocation: "https://denotenman.com/indexnow-key.txt",
    urlList: ["https://denotenman.com/nl/producten/amandelen"],
  });
});

test("IndexNow returns a failure result instead of throwing on network errors", async () => {
  const result = await submitIndexNowUrls(
    ["https://denotenman.com/nl"],
    {
      env: configuredEnv,
      fetchImpl: async () => {
        throw new Error("network down");
      },
    }
  );

  assert.deepEqual(result, { status: "failed", submitted: 0 });
});

test("product and category changes expand to affected localized storefront URLs", () => {
  assert.deepEqual(
    buildProductIndexNowUrls({
      baseUrl: "https://denotenman.com",
      translations: [
        { locale: "nl", slug: "amandelen" },
        { locale: "en", slug: "almonds" },
      ],
      categoryTranslations: [{ locale: "nl", slug: "noten" }],
    }),
    [
      "https://denotenman.com/nl",
      "https://denotenman.com/nl/categorie",
      "https://denotenman.com/en",
      "https://denotenman.com/en/category",
      "https://denotenman.com/fr",
      "https://denotenman.com/fr/categorie",
      "https://denotenman.com/nl/producten/amandelen",
      "https://denotenman.com/en/products/almonds",
      "https://denotenman.com/nl/categorie/noten",
    ]
  );

  assert.deepEqual(
    buildCategoryIndexNowUrls({
      baseUrl: "https://denotenman.com",
      translations: [
        { locale: "nl", slug: "noten" },
        { locale: "fr", slug: "noix" },
      ],
    }),
    [
      "https://denotenman.com/nl",
      "https://denotenman.com/nl/categorie",
      "https://denotenman.com/en",
      "https://denotenman.com/en/category",
      "https://denotenman.com/fr",
      "https://denotenman.com/fr/categorie",
      "https://denotenman.com/nl/categorie/noten",
      "https://denotenman.com/fr/categorie/noix",
    ]
  );
});
