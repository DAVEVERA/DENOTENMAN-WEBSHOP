import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}", "../../packages/ui/src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "brand-primary": {
          DEFAULT: "#2F4F4F",
          50: "#eaf1f1",
          100: "#cadddd",
          200: "#a9c8c8",
          300: "#89b2b2",
          400: "#689c9c",
          500: "#4f7f7f",
          600: "#3d6262",
          700: "#2F4F4F",
          800: "#223939",
          900: "#142222",
        },
        "brand-gold": {
          DEFAULT: "#CBB899",
          50: "#fdfdfa",
          100: "#f8f5ef",
          200: "#eedfc9",
          300: "#e5caa4",
          400: "#dcb47e",
          500: "#CBB899",
          600: "#af9b7c",
          700: "#927e5e",
          800: "#766141",
          900: "#594423",
        },
        "brand-highlight": {
          DEFAULT: "#DAA520",
        },
        "brand-pattern": {
          DEFAULT: "#7A9A7A",
        },
        surface: "#F7F3EC",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      container: {
        center: true,
        padding: {
          DEFAULT: "1rem",
          sm: "1.5rem",
          lg: "2rem",
        },
      },
    },
  },
  plugins: [],
};

export default config;
