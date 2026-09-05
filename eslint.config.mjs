import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      "prefer-const": "warn",
      "react/no-unescaped-entities": "off",
      "react-hooks/error-boundaries": "error",
      "react-hooks/purity": "error",
      "react-hooks/set-state-in-effect": "error",
    },
  },
  {
    files: ["scripts/**/*.cjs", "tests/**/*.{ts,tsx}"],
    rules: {
      "@next/next/no-assign-module-variable": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: [
      "app/admin/(dashboard)/marketing/nieuwsbrieven/\\[id\\]/page.tsx",
      "app/admin/(dashboard)/marketing/nieuwsbrieven/page.tsx",
    ],
    rules: { "react-hooks/error-boundaries": "off" },
  },
  {
    files: ["app/admin/(dashboard)/zakelijk/\\[id\\]/BusinessOrderListActions.tsx"],
    rules: { "react-hooks/purity": "off" },
  },
  {
    files: [
      "components/admin-panel/AdminDashboardWorkspace.tsx",
      "components/admin-panel/AdminNav.tsx",
      "components/admin-panel/ProductFaqEditor.tsx",
      "components/layout/MegaMenu.tsx",
      "components/privacy/CookieConsent.tsx",
      "components/product/ProductQuickView.tsx",
      "components/product/VariantSelector.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  globalIgnores([
    "everything-claude-code/**",
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    ".*/**",
    "components/admin/**",
    "components/*-elements/**",
    "output/**",
    "public/**",
    "test-results/**",
  ]),
]);
