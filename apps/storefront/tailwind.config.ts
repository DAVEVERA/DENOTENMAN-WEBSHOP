import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}", "../../packages/ui/src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "brand-green": {
          DEFAULT: "#2f6b3f",
          50: "#f0f7f2",
          100: "#d8eddd",
          200: "#b3d9be",
          300: "#84be97",
          400: "#569f6f",
          500: "#3a8351",
          600: "#2f6b3f",
          700: "#265633",
          800: "#1f4529",
          900: "#193822",
        },
        "brand-earth": {
          DEFAULT: "#7c5c3b",
          50: "#faf5ef",
          100: "#f3e6d3",
          200: "#e6cba7",
          300: "#d4a872",
          400: "#c08548",
          500: "#b06d30",
          600: "#7c5c3b",
          700: "#634829",
          800: "#4e371f",
          900: "#3d2b17",
        },
        surface: "#faf8f5",
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
