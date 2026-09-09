import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { createCopywriterProductsGetHandler } from "@/app/api/admin/design-studio/copywriter/products/route";
import { createCopywriterProductGetHandler } from "@/app/api/admin/design-studio/copywriter/products/[productId]/route";
import { createCopywriterProposalPostHandler } from "@/app/api/admin/design-studio/copywriter/proposals/route";
import { createCopywriterProposalPatchHandler } from "@/app/api/admin/design-studio/copywriter/proposals/[proposalId]/route";
import { createCopywriterApplyPostHandler } from "@/app/api/admin/design-studio/copywriter/proposals/[proposalId]/apply/route";

const origin = "https://admin.example.nl";
const admin = { id: "admin-1", role: "ADMIN" };

function request(path: string, method = "GET", body?: unknown, key = "copywriter:key-123") {
  return new NextRequest(`${origin}${path}`, {
    method,
    headers: {
      origin,
      host: "admin.example.nl",
      "content-type": "application/json",
      "idempotency-key": key,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function noStore(response: Response) {
  assert.equal(response.headers.get("cache-control"), "no-store");
}

test("CopyWriter catalog routes are admin scoped, Dutch only, bounded, and no-store", async () => {
  let limit = 0;
  const handler = createCopywriterProductsGetHandler({
    getAdminSession: async () => admin,
    listProducts: async (value) => { limit = value; return [{ id: "product-1" }]; },
  });
  const response = await handler(request("/api/admin/design-studio/copywriter/products?locale=nl&limit=900"));
  assert.equal(response.status, 200);
  assert.equal(limit, 500);
  assert.deepEqual(await response.json(), { products: [{ id: "product-1" }] });
  noStore(response);

  const forbidden = await createCopywriterProductsGetHandler({
    getAdminSession: async () => ({ id: "staff-1", role: "STAFF" }),
    listProducts: async () => { throw new Error("must not run"); },
  })(request("/api/admin/design-studio/copywriter/products"));
  assert.equal(forbidden.status, 403);
  noStore(forbidden);
});

test("CopyWriter product detail awaits params and passes the authenticated owner", async () => {
  const handler = createCopywriterProductGetHandler({
    getAdminSession: async () => admin,
    getProduct: async (input) => {
      assert.deepEqual(input, { adminUserId: "admin-1", productId: "product-awaited" });
      return { product: { id: "product-awaited" }, proposal: null } as never;
    },
  });
  const response = await handler(
    request("/api/admin/design-studio/copywriter/products/product-awaited?locale=nl"),
    { params: Promise.resolve({ productId: "product-awaited" }) },
  );
  assert.equal(response.status, 200);
  noStore(response);
});

test("generation requires auth, same origin, idempotency, and strict one-product input", async () => {
  let calls = 0;
  const handler = createCopywriterProposalPostHandler({
    getAdminSession: async () => admin,
    hasSameOrigin: () => true,
    createProposal: async (input) => {
      calls += 1;
      assert.equal(input.adminUserId, "admin-1");
      assert.equal(input.options.productId, "product-1");
      return { proposal: { id: "proposal-1" }, replayed: false } as never;
    },
  });
  const invalid = await handler(request(
    "/api/admin/design-studio/copywriter/proposals",
    "POST",
    { productId: "product-1", locale: "nl", bulk: true },
  ));
  assert.equal(invalid.status, 422);
  assert.equal(calls, 0);
  noStore(invalid);

  const created = await handler(request(
    "/api/admin/design-studio/copywriter/proposals",
    "POST",
    { productId: "product-1", locale: "nl" },
  ));
  assert.equal(created.status, 201);
  assert.equal(calls, 1);
  noStore(created);
});

test("editorial save is strict and apply requires explicit confirmation plus selected fields", async () => {
  let edits: unknown;
  const patch = createCopywriterProposalPatchHandler({
    getAdminSession: async () => admin,
    hasSameOrigin: () => true,
    editProposal: async (input) => { edits = input.edits; return { id: input.proposalId } as never; },
  });
  const patchResponse = await patch(
    request("/api/admin/design-studio/copywriter/proposals/proposal-1", "PATCH", { edits: { seoTitle: "Nieuwe SEO-titel" } }),
    { params: Promise.resolve({ proposalId: "proposal-1" }) },
  );
  assert.equal(patchResponse.status, 200);
  assert.deepEqual(edits, { seoTitle: "Nieuwe SEO-titel" });
  noStore(patchResponse);

  let applied = 0;
  const apply = createCopywriterApplyPostHandler({
    getAdminSession: async () => admin,
    hasSameOrigin: () => true,
    applyProposal: async () => {
      applied += 1;
      return { proposal: { id: "proposal-1" }, replayed: false } as never;
    },
  });
  const applyBody = {
    sourceProductVersion: "2026-09-08T10:00:00.000Z",
    protectedFactsHash: `sha256:${"a".repeat(64)}`,
    selectedFields: ["seoTitle"],
  };
  const rejected = await apply(
    request("/api/admin/design-studio/copywriter/proposals/proposal-1/apply", "POST", { ...applyBody, confirmation: "YES" }),
    { params: Promise.resolve({ proposalId: "proposal-1" }) },
  );
  assert.equal(rejected.status, 422);
  assert.equal(applied, 0);
  noStore(rejected);

  const accepted = await apply(
    request("/api/admin/design-studio/copywriter/proposals/proposal-1/apply", "POST", { ...applyBody, confirmation: "APPLY_SELECTED_FIELDS" }),
    { params: Promise.resolve({ proposalId: "proposal-1" }) },
  );
  assert.equal(accepted.status, 200);
  assert.equal(applied, 1);
  noStore(accepted);
});
