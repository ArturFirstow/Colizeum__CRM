import { continueRender, delayRender, staticFile } from "remotion";

/** Шрифты брендбука: Oswald — заголовки, Manrope — текст. Лежат в public/fonts. */
export const display = { fontFamily: "Oswald" };
export const text = { fontFamily: "Manrope" };

const CYRILLIC = "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116";
const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

const face = (family: string, weight: string, file: string, range: string) =>
  `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:block;src:url("${staticFile(
    `fonts/${file}`,
  )}") format("woff2");unicode-range:${range};}`;

const css = [
  face("Oswald", "400 700", "oswald-cyrillic.woff2", CYRILLIC),
  face("Oswald", "400 700", "oswald-latin.woff2", LATIN),
  face("Manrope", "300 800", "manrope-cyrillic.woff2", CYRILLIC),
  face("Manrope", "300 800", "manrope-latin.woff2", LATIN),
].join("");

if (typeof document !== "undefined" && !document.getElementById("promo-fonts")) {
  const tag = document.createElement("style");
  tag.id = "promo-fonts";
  tag.textContent = css;
  document.head.appendChild(tag);

  const sample = "Клиенты Сделки Документы Деньги — COLIZEUM AGENCY 43 999 374 ₽";
  const handle = delayRender("Загрузка шрифтов");

  Promise.all([
    document.fonts.load('500 100px "Oswald"', sample),
    document.fonts.load('700 100px "Oswald"', sample),
    document.fonts.load('300 100px "Manrope"', sample),
    document.fonts.load('500 100px "Manrope"', sample),
    document.fonts.load('800 100px "Manrope"', sample),
  ])
    .then(() => continueRender(handle))
    .catch(() => continueRender(handle));
}
