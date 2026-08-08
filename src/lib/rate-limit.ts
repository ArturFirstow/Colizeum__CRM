import "server-only";

// ─────────────────────────────────────────────────────────────────────────────
// Защита от подбора пароля.
//
// Без неё войти в сервис можно было перебором: форма входа принимала сколько
// угодно попыток подряд. Теперь после нескольких неудач вход по этой связке
// «почта + адрес» временно закрывается.
//
// Счётчик живёт в памяти процесса — этого достаточно, потому что сервис
// работает одним экземпляром на одном сервере (см. docs/ДЕПЛОЙ.md). Если
// когда-нибудь появится несколько копий, счётчик нужно будет вынести в общее
// хранилище, иначе каждая копия начнёт считать заново.
// ─────────────────────────────────────────────────────────────────────────────

type Attempt = { count: number; firstAt: number; blockedUntil: number };

const attempts = new Map<string, Attempt>();

/** Сколько неудач подряд допускаем. */
const MAX_FAILS = 7;
/** Окно, в котором копятся неудачи. */
const WINDOW_MS = 15 * 60 * 1000;
/** На сколько закрываем вход после исчерпания попыток. */
const BLOCK_MS = 15 * 60 * 1000;

/** Периодически чистим карту, чтобы она не росла бесконечно. */
function sweep(now: number) {
  if (attempts.size < 500) return;
  for (const [key, a] of attempts) {
    if (now - a.firstAt > WINDOW_MS && now > a.blockedUntil) attempts.delete(key);
  }
}

export type RateVerdict = { allowed: true } | { allowed: false; retryAfterSec: number };

/** Проверяет, можно ли сейчас пробовать войти под этим ключом. */
export function checkLoginAllowed(key: string): RateVerdict {
  const now = Date.now();
  sweep(now);
  const a = attempts.get(key);
  if (!a) return { allowed: true };
  if (now < a.blockedUntil) {
    return { allowed: false, retryAfterSec: Math.ceil((a.blockedUntil - now) / 1000) };
  }
  // Окно истекло — начинаем считать заново.
  if (now - a.firstAt > WINDOW_MS) {
    attempts.delete(key);
  }
  return { allowed: true };
}

/** Отмечает неудачную попытку и при необходимости закрывает вход. */
export function registerFailedLogin(key: string): void {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return;
  }
  a.count += 1;
  if (a.count >= MAX_FAILS) a.blockedUntil = now + BLOCK_MS;
}

/** Удачный вход — счётчик обнуляем. */
export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}
