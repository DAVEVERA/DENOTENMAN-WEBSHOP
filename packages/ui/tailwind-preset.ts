import type { Config } from "tailwindcss";

/**
 * DeNotenman Tailwind preset.
 *
 * Palette rationale:
 *   brand-green  #2f6b3f — forest/herb green; evokes organic, natural produce.
 *   brand-earth  #7c5c3b — warm brown walnut shell; natural, grounded.
 *   neutral      warm stone scale (slightly warm grey, not cold blue-grey).
 *   surface      #faf8f5 — off-white parchment background for warmth.
 *   danger       #b91c1c — accessible red (contrast ≥ 4.5:1 on white).
 *   warning      #92400e — dark amber on white (≥ 4.5:1).
 *   success      #166534 — deep green on white (≥ 4.5:1).
 *   info         #1e40af — deep blue on white (≥ 4.5:1).
 *
 * All foreground/background pairings in the component palette must achieve
 * WCAG 2.2 AA contrast (4.5:1 for normal text, 3:1 for large/UI).
 */
const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        brand: {
          green: {
            DEFAULT: "#2f6b3f",
            50: "#f0f7f2",
            100: "#d9ede0",
            200: "#b3dbc3",
            300: "#7ec19d",
            400: "#4ea375",
            500: "#2f6b3f",
            600: "#275a35",
            700: "#1f4829",
            800: "#183720",
            900: "#112818",
          },
          earth: {
            DEFAULT: "#7c5c3b",
            50: "#f9f5f0",
            100: "#ede3d7",
            200: "#d9c7af",
            300: "#bfa07e",
            400: "#a37e58",
            500: "#7c5c3b",
            600: "#6a4d31",
            700: "#563d27",
            800: "#43301e",
            900: "#332415",
          },
        },
        neutral: {
          50: "#faf8f5",
          100: "#f0ede8",
          200: "#e2ddd6",
          300: "#c9c2b8",
          400: "#a89e92",
          500: "#8a7e71",
          600: "#6e6358",
          700: "#574e44",
          800: "#3d3730",
          900: "#28231e",
          950: "#171310",
        },
        surface: "#faf8f5",
        danger: {
          DEFAULT: "#b91c1c",
          light: "#fef2f2",
          border: "#fca5a5",
        },
        warning: {
          DEFAULT: "#92400e",
          light: "#fffbeb",
          border: "#fcd34d",
        },
        success: {
          DEFAULT: "#166534",
          light: "#f0fdf4",
          border: "#86efac",
        },
        info: {
          DEFAULT: "#1e40af",
          light: "#eff6ff",
          border: "#93c5fd",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Fira Code", "ui-monospace", "monospace"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.375rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px",
      },
      spacing: {
        px: "1px",
        0: "0",
        0.5: "0.125rem",
        1: "0.25rem",
        1.5: "0.375rem",
        2: "0.5rem",
        2.5: "0.625rem",
        3: "0.75rem",
        3.5: "0.875rem",
        4: "1rem",
        5: "1.25rem",
        6: "1.5rem",
        7: "1.75rem",
        8: "2rem",
        9: "2.25rem",
        10: "2.5rem",
        11: "2.75rem",
        12: "3rem",
        14: "3.5rem",
        16: "4rem",
        20: "5rem",
        24: "6rem",
        28: "7rem",
        32: "8rem",
        36: "9rem",
        40: "10rem",
        44: "11rem",
        48: "12rem",
        52: "13rem",
        56: "14rem",
        60: "15rem",
        64: "16rem",
        72: "18rem",
        80: "20rem",
        96: "24rem",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
        xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
        none: "none",
      },
    },
  },
};

export default preset;
