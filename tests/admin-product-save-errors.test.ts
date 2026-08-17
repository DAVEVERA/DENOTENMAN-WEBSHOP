import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeCategoryAssignments,
  productSaveErrorMessage,
} from "../components/admin-panel/ProductAdminForm";

test("product save failures remain actionable after network and stale-write errors", () => {
  assert.equal(
    productSaveErrorMessage(new TypeError("Failed to fetch")),
    "Geen verbinding met de server. Controleer je internetverbinding en probeer opnieuw."
  );
  assert.equal(
    productSaveErrorMessage({ error: "STALE_PRODUCT" }),
    "Dit product is intussen elders gewijzigd. Herlaad de pagina voordat je opnieuw opslaat."
  );
  assert.equal(productSaveErrorMessage({ message: "SKU bestaat al." }), "SKU bestaat al.");
});

test("category assignments always expose exactly one deepest primary category", () => {
  const normalized = normalizeCategoryAssignments(
    [
      { categoryId: "main", isPrimary: false, sortOrder: 0 },
      { categoryId: "sub", isPrimary: false, sortOrder: 1 },
    ],
    [
      { id: "main", name: "Noten", parentId: null },
      { id: "sub", name: "Amandelen", parentId: "main" },
    ],
  );

  assert.deepEqual(normalized.map(({ categoryId, isPrimary }) => ({ categoryId, isPrimary })), [
    { categoryId: "main", isPrimary: false },
    { categoryId: "sub", isPrimary: true },
  ]);
});
