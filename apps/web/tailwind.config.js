/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      bg: "rgb(var(--bg-rgb) / <alpha-value>)",
      surface: "rgb(var(--surface-rgb) / <alpha-value>)",
      cream: "rgb(var(--bg-rgb) / <alpha-value>)",
      sand: "rgb(var(--sand-rgb) / <alpha-value>)",
      ink: "rgb(var(--ink-rgb) / <alpha-value>)",
      muted: "rgb(var(--muted-rgb) / <alpha-value>)",
      warm: "rgb(var(--muted-rgb) / <alpha-value>)",
      accent: "rgb(var(--accent-rgb) / <alpha-value>)",
      terracotta: "rgb(var(--accent-rgb) / <alpha-value>)",
      border: "rgb(var(--border-rgb) / <alpha-value>)",
      ok: "#3d7a5f",
      warn: "#e8622a",
      danger: "#dc2626",
    },
    extend: {
      fontFamily: {
        display: ["Syne", "DM Sans", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        DEFAULT: "8px",
      },
    },
  },
  plugins: [],
};
