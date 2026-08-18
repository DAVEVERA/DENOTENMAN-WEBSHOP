import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("category admin updates invalidate the shared storefront layout", () => {
  const helper = readFileSync("lib/category-revalidation.ts", "utf8");
  const route = readFileSync("app/api/admin/categories/[id]/route.ts", "utf8");

  assert.match(helper, /revalidatePath\("\/", "layout"\)/);
  assert.match(route, /revalidateCategoryStorefront\(id\)/);
  assert.match(route, /frontendSynced: revalidation\.frontendSynced/);
});

test("category admin reports a saved-but-not-synced result to the editor", () => {
  const editor = readFileSync(
    "app/admin/(dashboard)/categorieen/[id]/CategoryEditForm.tsx",
    "utf8"
  );

  assert.match(editor, /data\?\.frontendSynced === false/);
  assert.match(editor, /categorie is opgeslagen, maar de webshop kon niet direct worden vernieuwd/);
});
