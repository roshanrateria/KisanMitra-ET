import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        heading: ["Manrope", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        "on-primary-fixed-variant": "#0c5216",
        "surface-container-high": "#e9e8e7",
        "on-tertiary": "#ffffff",
        "tertiary-fixed-dim": "#ffba38",
        "error-container": "#ffdad6",
        "primary-fixed-dim": "#91d78a",
        "on-primary-container": "#cbffc2",
        "inverse-primary": "#91d78a",
        "surface-variant": "#e3e2e1",
        "primary-container": "#3a7b3a",
        "on-background": "#1a1c1c",
        "on-tertiary-fixed-variant": "#604100",
        "secondary-container": "#ffca98",
        "on-surface": "#1a1c1c",
        "surface-container": "#eeeeed",
        "on-surface-variant": "#40493d",
        "on-tertiary-container": "#ffefda",
        "surface-dim": "#dadad9",
        "on-primary-fixed": "#002203",
        "surface-container-low": "#f4f3f2",
        "surface-container-lowest": "#ffffff",
        "outline-variant": "#bfcaba",
        "on-primary": "#ffffff",
        "surface-bright": "#faf9f8",
        "outline": "#707a6c",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",
        "on-secondary-container": "#7a532a",
        "inverse-on-surface": "#f1f0f0",
        "surface-container-highest": "#e3e2e1",
        "primary-fixed": "#acf4a4",
        "secondary-fixed": "#ffdcbd",
        "inverse-surface": "#2f3130",
        "tertiary": "#734e00",
        "on-secondary-fixed": "#2c1600",
        "on-tertiary-fixed": "#281900",
        "surface-tint": "#2a6b2c",
        "secondary-fixed-dim": "#f0bd8b",
        "on-secondary": "#ffffff",
        "surface": "#faf9f8",
        "error": "#ba1a1a",
        "on-secondary-fixed-variant": "#623f18",
        "tertiary-container": "#926500",
        "tertiary-fixed": "#ffdeac",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        "3xl": "auto", /* For rounded-full */
        "2xl": "3rem", /* 48px */
        xl: "2rem", /* 32px */
        lg: "var(--radius)", /* 16px */
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
