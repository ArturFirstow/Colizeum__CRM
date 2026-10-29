import { Easing } from "remotion";

// Брендбук 2025 — те же значения, что в tailwind.config.ts сервиса.
export const C = {
  bg: "#101011",
  ink900: "#151516",
  ink800: "#1F1F1F",
  ink700: "#2B2B2B",
  ink500: "#8A8A8E",
  ink300: "#C4C4C8",
  ink50: "#F1F1F1",
  brand: "#FCDF3B",
  brandSoft: "#FFE97C",
  red: "#EF4444",
  green: "#10B981",
};

/**
 * Одно ускорение на весь ролик — то же затухание, что в интерфейсе
 * (`cubic-bezier(0.22, 1, 0.36, 1)`). Пружин и перелётов нет осознанно:
 * продукт и ролик должны двигаться одинаково.
 */
export const EASE = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_OUT = Easing.bezier(0.33, 1, 0.68, 1);

export const FPS = 30;

/** Секунды → кадры. Все тайминги в сценарии считаны по звуковой дорожке. */
export const sec = (s: number) => Math.round(s * FPS);
