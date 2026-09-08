import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Шрифты лежат в public/fonts, поэтому ролик рендерится без интернета.
 * @font-face объявляем из кода: так путь к файлу проходит через staticFile()
 * и не ломает сборщик.
 */
export const serif = { fontFamily: "Playfair Display" };
export const sans = { fontFamily: "Inter" };

const CYRILLIC =
  "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116";
const LATIN_EXT =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";
const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

const face = (
  family: string,
  style: string,
  weight: string,
  file: string,
  range: string,
) =>
  `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:block;src:url("${staticFile(
    `fonts/${file}`,
  )}") format("woff2");unicode-range:${range};}`;

const css = [
  face("Playfair Display", "normal", "400 600", "playfair-cyrillic.woff2", CYRILLIC),
  face("Playfair Display", "normal", "400 600", "playfair-latin-ext.woff2", LATIN_EXT),
  face("Playfair Display", "normal", "400 600", "playfair-latin.woff2", LATIN),
  face("Playfair Display", "italic", "400 500", "playfair-italic-cyrillic.woff2", CYRILLIC),
  face("Playfair Display", "italic", "400 500", "playfair-italic-latin.woff2", LATIN),
  face("Inter", "normal", "300 600", "inter-cyrillic.woff2", CYRILLIC),
  face("Inter", "normal", "300 600", "inter-latin-ext.woff2", LATIN_EXT),
  face("Inter", "normal", "300 600", "inter-latin.woff2", LATIN),
].join("");

if (typeof document !== "undefined" && !document.getElementById("promo-fonts")) {
  const tag = document.createElement("style");
  tag.id = "promo-fonts";
  tag.textContent = css;
  document.head.appendChild(tag);

  const sample = "Ключ, который носят на себе — you are the key 4 900 ₽";
  const handle = delayRender("Загрузка шрифтов");

  Promise.all([
    document.fonts.load('400 100px "Playfair Display"', sample),
    document.fonts.load('500 100px "Playfair Display"', sample),
    document.fonts.load('600 100px "Playfair Display"', sample),
    document.fonts.load('italic 400 100px "Playfair Display"', sample),
    document.fonts.load('300 100px "Inter"', sample),
    document.fonts.load('400 100px "Inter"', sample),
    document.fonts.load('500 100px "Inter"', sample),
  ])
    .then(() => continueRender(handle))
    .catch(() => continueRender(handle));
}
