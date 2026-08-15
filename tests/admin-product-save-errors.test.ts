import assert from "node:assert/strict";
import test from "node:test";
import { productSaveErrorMessage } from "../components/admin-panel/ProductAdminForm";

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
