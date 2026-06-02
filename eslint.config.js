const js = require("@eslint/js");
const nextVitals = require("eslint-config-next/core-web-vitals");
const globals = require("globals");
const tseslint = require("typescript-eslint");

const nextAppFiles = ["apps/{admin,storefront}/**/*.{js,jsx,mjs,ts,tsx,mts,cts}"];
const packageFiles = ["apps/worker/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"];

const scopedNextVitals = nextVitals.map((config) => {
  if (config.ignores) {
    return config;
  }

  return {
    ...config,
    files: nextAppFiles,
  };
});

module.exports = [
  {
    ignores: [
      ".git/**",
      ".next/**",
      ".turbo/**",
      ".vercel/**",
      "dist/**",
      "node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/*.config.js",
      "**/*.tsbuildinfo",
    ],
  },
  {
    files: packageFiles,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  ...scopedNextVitals,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@next/next/no-img-element": "off",
    },
  },
];
