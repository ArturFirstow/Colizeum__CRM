import type { Config } from "tailwindcss";

/**
 * Фирменный стиль Colizeum Agency (по брендбуку 2025).
 * Палитра: точные значения из брендбука — жёлтый (#FCDF3B / #FFE665 / #FFE97C)
 * и нейтральные «графитовые» серые (#1F1F1F / #2B2B2B / #202020, светлые #F1F1F1 / #ECECEC).
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
        // Брендовый жёлтый.
        brand: {
          DEFAULT: "#FCDF3B",
          50: "#FFFCE6",
          100: "#FFF6B8",
          200: "#FFE97C", // брендбук: светлый жёлтый
          300: "#FFE665", // брендбук: мягкий жёлтый
          400: "#FCDF3B", // брендбук: основной жёлтый
          500: "#EACB25",
          600: "#C9AD1E",
          700: "#8F7B15",
          800: "#5E5010",
          900: "#332C08",
        },
        // Нейтральные графитовые тона (без синего оттенка — как в брендбуке).
        ink: {
          DEFAULT: "#141416",
          950: "#0E0E0F",
          900: "#151516",
          850: "#1A1A1B",
          800: "#1F1F1F", // брендбук
          700: "#2B2B2B", // брендбук
          600: "#3A3A3B",
          // Текстовые тона подняты по контрасту (ТЗ р.2, п.0): второстепенный
          // текст на карточках должен читаться, а не угадываться.
          500: "#8A8A8E",
          400: "#A6A6AA",
          300: "#C4C4C8",
          200: "#D9D9DB",
          100: "#EBEBEC",
          50: "#F1F1F1", // брендбук: светло-серый
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -12px rgba(0,0,0,0.18)",
        "card-dark": "0 1px 2px rgba(0,0,0,0.5), 0 14px 40px -20px rgba(0,0,0,0.8)",
        glow: "0 0 0 1px rgba(252,223,59,0.35), 0 10px 34px -10px rgba(252,223,59,0.3)",
      },
      backgroundImage: {
        "xo-grid":
          "radial-gradient(circle at 1px 1px, rgba(252,223,59,0.06) 1px, transparent 0)",
        "brand-gradient": "linear-gradient(135deg, #1A1A1B 0%, #FCDF3B 160%)",
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
