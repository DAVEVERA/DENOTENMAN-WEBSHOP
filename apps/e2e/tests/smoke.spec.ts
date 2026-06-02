import { test, expect } from "@playwright/test";

test("homepage loads with correct title and Dutch heading", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await expect(page).toHaveTitle(/De Notenman/i);

  // The hero H1 is always present regardless of whether the API is up
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Premium noten");
});
