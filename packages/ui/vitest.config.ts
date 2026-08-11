import { defineConfig } from "vitest/config";

export default defineConfig({
  // Primitives use the automatic JSX runtime; without this esbuild emits
  // React.createElement calls and every render() throws "React is not defined".
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
