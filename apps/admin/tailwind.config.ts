import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}", "../../packages/ui/src/**/*.{js,ts,jsx,tsx}"],
  presets: [require("../../packages/ui/tailwind-preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
