import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        koa: {
          50: "#fdf8f6",
          100: "#f2e8e5",
          200: "#eaddd7",
          500: "#a27b5c",
          600: "#8a6549",
          700: "#6d4f39",
          800: "#503828",
          900: "#38261b",
        }
      },
    },
  },
  plugins: [],
};
export default config;
