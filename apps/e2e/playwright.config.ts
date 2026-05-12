import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";
const skipWebServer = process.env["E2E_SKIP_WEBSERVER"] === "1";

const webServer = skipWebServer
  ? {}
  : {
      webServer: {
        command: "pnpm --filter @denotenman/storefront dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
    };

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  workers: 1,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  ...webServer,
});
