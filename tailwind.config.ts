import type { Config } from "tailwindcss";

/**
 * Фирменный стиль Colizeum: чёрный + жёлтый, мотив «ХО».
 * Палитра построена вокруг глубоких «чернил» (ink) и брендового жёлтого (brand).
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#FFDD00",
          50: "#FFFBE5",
          100: "#FFF4B8",
          200: "#FFEC80",
          300: "#FFE44D",
          400: "#FFDD00",
          500: "#F5CE00",
          600: "#D9B300",
          700: "#A88A00",
          800: "#6E5A00",
          900: "#3D3200",
        },
        ink: {
          DEFAULT: "#0B0B0D",
          950: "#060608",
          900: "#0B0B0D",
          850: "#111116",
          800: "#16161C",
          700: "#1E1E26",
          600: "#282833",
          500: "#3A3A47",
          400: "#5A5A68",
          300: "#8A8A97",
          200: "#B8B8C2",
          100: "#E3E3E8",
          50: "#F5F5F7",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -12px rgba(0,0,0,0.18)",
        "card-dark": "0 1px 2px rgba(0,0,0,0.5), 0 12px 32px -16px rgba(0,0,0,0.7)",
        glow: "0 0 0 1px rgba(255,221,0,0.35), 0 8px 30px -8px rgba(255,221,0,0.25)",
      },
      backgroundImage: {
        "xo-grid":
          "radial-gradient(circle at 1px 1px, rgba(255,221,0,0.10) 1px, transparent 0)",
      },
      borderRadius: {
        xl2: "1rem",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
