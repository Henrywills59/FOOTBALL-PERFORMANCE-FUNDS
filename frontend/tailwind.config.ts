import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        field: "#1f6f43",
        ink: "#111827",
        gold: "#d6a84f",
      },
    },
  },
  plugins: [],
} satisfies Config;
