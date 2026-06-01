/** Semantic design tokens — mirrors :root in index.css */
export const designTokens = {
  color: {
    bg: "#faf7f2",
    surface: "#ffffff",
    ink: "#1f1a17",
    muted: "#6f655f",
    accent: "#e8622a",
    sand: "#e8e0d8",
    border: "#e8e0d8",
    ok: "#3d7a5f",
    warn: "#e8622a",
    danger: "#dc2626",
    consoleBg: "#171412",
    consoleBar: "#231e1a",
  },
  font: {
    display: '"Syne", "DM Sans", system-ui, sans-serif',
    body: '"Inter", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  },
  radius: {
    sm: "6px",
    md: "8px",
    lg: "12px",
  },
  shadow: {
    neo: "6px 6px 0 rgb(31 26 23 / 1)",
    neoSm: "4px 4px 0 rgb(31 26 23 / 1)",
  },
} as const;

export type DesignTokenColor = keyof typeof designTokens.color;
