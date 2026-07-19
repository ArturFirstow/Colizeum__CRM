// «Кинетика»: маленький праздник — конфетти в цветах брендбука.
// Вызывается при закрытии сделки. Без библиотек, чистый DOM + CSS-анимация.

const COLORS = ["#FCDF3B", "#FFE665", "#FFE97C", "#F1F1F1", "#4ade80"];

export function celebrate() {
  if (typeof document === "undefined") return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const n = 90;
  for (let i = 0; i < n; i++) {
    const piece = document.createElement("i");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
    piece.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    piece.style.width = `${6 + Math.random() * 8}px`;
    piece.style.height = `${8 + Math.random() * 10}px`;
    piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3600);
  }
}
