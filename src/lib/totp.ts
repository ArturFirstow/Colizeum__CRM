import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Одноразовые коды для входа (второй фактор, требование 5.1).
//
// Стандарт TOTP (RFC 6238) — тот самый, что понимают Google Authenticator,
// Яндекс Ключ, 1Password и прочие. Телефон и сервер считают один и тот же код
// из общего секрета и текущего времени, по сети код не передаётся.
//
// Написано вручную, а не взято библиотекой, сознательно: здесь шестьдесят
// строк на стандартной криптографии из самого Node, а каждая зависимость в
// сервисе, который проверяют по безопасности, — это ещё один чужой пакет,
// за обновлениями которого надо следить.
// ─────────────────────────────────────────────────────────────────────────────

const DIGITS = 6;
const PERIOD_SEC = 30;
/** Разрешаем код из соседнего окна: часы на телефоне бывают на минуту врут. */
const WINDOW = 1;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Секрет в виде, который понимают приложения-аутентификаторы. */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Код для конкретного получасового окна. */
function codeForCounter(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  // Динамическое усечение по стандарту: последние 4 бита указывают, откуда
  // брать четыре байта результата.
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** Текущий код — нужен только для самопроверки в тестах. */
export function currentCode(secret: string, atMs = Date.now()): string {
  return codeForCounter(secret, Math.floor(atMs / 1000 / PERIOD_SEC));
}

/** Проверяет код, введённый человеком. Сравнение без утечки по времени. */
export function verifyCode(secret: string, input: string, atMs = Date.now()): boolean {
  const clean = (input || "").replace(/\D/g, "");
  if (clean.length !== DIGITS) return false;
  const counter = Math.floor(atMs / 1000 / PERIOD_SEC);
  for (let drift = -WINDOW; drift <= WINDOW; drift++) {
    const expected = codeForCounter(secret, counter + drift);
    const a = Buffer.from(expected);
    const b = Buffer.from(clean);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/**
 * Ссылка для приложения-аутентификатора. Её же кодируем в QR-код: человек
 * наводит камеру и ничего не перепечатывает руками.
 */
export function otpauthUrl(secret: string, email: string, issuer = "Colizeum Agency"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SEC),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ── Запасные коды ───────────────────────────────────────────────────────────
// Телефон теряют и меняют. Без запасных кодов единственный администратор
// однажды окажется заперт снаружи собственного сервиса — а это и есть
// отказ в обслуживании, только своими руками.

export const RECOVERY_CODE_COUNT = 8;

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    // Группы по 4 символа — так их проще прочитать с бумаги.
    randomBytes(4).toString("hex").toUpperCase().match(/.{4}/g)!.join("-"),
  );
}

/** Нормализует введённый запасной код: люди вводят их с пробелами и строчными. */
export function normalizeRecoveryCode(input: string): string {
  return (input || "").toUpperCase().replace(/[^A-F0-9]/g, "");
}
