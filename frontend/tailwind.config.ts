import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#111111",
        "primary-active": "#242424",
        "brand-accent": "#3b82f6",
        canvas: "#ffffff",
        "surface-soft": "#f8f9fa",
        "surface-card": "#f5f5f5",
        "surface-strong": "#e5e7eb",
        "surface-dark": "#101010",
        "surface-dark-elevated": "#1a1a1a",
        hairline: "#e5e7eb",
        "hairline-soft": "#f3f4f6",
        ink: "#111111",
        body: "#374151",
        muted: "#6b7280",
        "muted-soft": "#898989",
        "on-primary": "#ffffff",
        "on-dark": "#ffffff",
        "on-dark-soft": "#a1a1aa",
        success: "#10b981",
        warning: "#f59e0b",
        error: "#ef4444",
        badge: {
          orange: "#fb923c",
          pink: "#ec4899",
          violet: "#8b5cf6",
          emerald: "#34d399",
        },
      },
      fontFamily: {
        cal: ["var(--font-cal)", "Manrope", "Inter", "sans-serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        pill: "9999px",
        full: "9999px",
      },
      spacing: {
        xxs: "4px",
        xs: "8px",
        sm: "12px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        xxl: "48px",
        section: "96px",
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(0,0,0,0.05)",
        card: "0 4px 12px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
