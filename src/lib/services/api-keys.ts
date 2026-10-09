import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Служебные ключи доступа к API (требование Влада 9.2).
//
// Ключ выдаётся ПРОГРАММЕ, а не человеку: коннектор Aspro ходит за данными
// сам, без входа и cookie. Отсюда всё остальное — свой срок жизни, свой набор
// разрешений, отзыв и замена без простоя.
//
// Вид ключа:  colz_<8 символов><32 символа>
//             └┬─┘ └────┬────┘└────┬─────┘
//              │        │          └ секрет, виден один раз
//              │        └ префикс: по нему ключ находится в базе и узнаётся
//              └ чтобы ключ можно было опознать в чужом логе или репозитории
//
// В базе лежит ТОЛЬКО отпечаток (sha256) — как у пароля. Ключ, сохранённый в
// базе открытым текстом, при утечке дампа отдаёт весь контур разом.
//
// Почему sha256, а не bcrypt как у паролей: пароль человек придумывает, и его
// можно подобрать по словарю — поэтому там нужна намеренно медленная функция.
// Здесь секрет — 32 случайных символа из 36, перебирать нечего. Зато sha256
// быстрый, а проверка идёт на каждом запросе коннектора.
//
// Замена без простоя: ключей может быть несколько живых одновременно. Выпустили
// новый → переключили коннектор → отозвали старый. Отозванный остаётся в
// списке: по нему видно, что ключ был и когда его закрыли.
// ─────────────────────────────────────────────────────────────────────────────

/** Сущности, которые можно открыть ключу. Совпадают с адресами в /api/v1. */
export const API_SCOPES = [
  "advertisers",
  "deals",
  "documents",
  "tasks",
  "invoices",
  "tournament-contractors",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const SCOPE_LABELS: Record<ApiScope, string> = {
  advertisers: "Клиенты",
  deals: "Сделки",
  documents: "Документы",
  tasks: "Задачи",
  invoices: "Счета",
  "tournament-contractors": "Контрагенты турниров",
};

const PREFIX_LEN = 8;
const SECRET_LEN = 32;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomString(n: number): string {
  const bytes = randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export type IssuedKey = { key: string; prefix: string; id: string };

/** Выпускает новый ключ. Полное значение возвращается ОДИН раз — его не сохранить потом. */
export async function issueApiKey(opts: {
  name: string;
  scopes: ApiScope[];
  expiresAt: Date;
  note?: string | null;
  createdById: string;
}): Promise<IssuedKey> {
  const prefix = randomString(PREFIX_LEN);
  const key = `colz_${prefix}${randomString(SECRET_LEN)}`;
  const row = await prisma.apiKey.create({
    data: {
      name: opts.name,
      prefix,
      keyHash: hashKey(key),
      scopes: JSON.stringify(opts.scopes),
      expiresAt: opts.expiresAt,
      note: opts.note ?? null,
      createdById: opts.createdById,
    },
    select: { id: true },
  });
  return { key, prefix, id: row.id };
}

export type KeyCheck =
  | { ok: true; id: string; name: string; scopes: ApiScope[] }
  | { ok: false; reason: string };

/**
 * Проверяет ключ из заголовка запроса.
 *
 * Сравнение отпечатков идёт через timingSafeEqual: обычное сравнение строк
 * заканчивается на первом несовпавшем символе, и по времени ответа можно
 * подбирать ключ посимвольно. Здесь подбирать нечего, но правило одно на все
 * сравнения секретов — так не придётся вспоминать, где можно, а где нельзя.
 */
export async function checkApiKey(raw: string | null): Promise<KeyCheck> {
  if (!raw) return { ok: false, reason: "Ключ не передан" };
  const key = raw.replace(/^Bearer\s+/i, "").trim();
  if (!key.startsWith("colz_") || key.length < 5 + PREFIX_LEN + SECRET_LEN) {
    return { ok: false, reason: "Ключ неверного вида" };
  }
  const prefix = key.slice(5, 5 + PREFIX_LEN);

  const row = await prisma.apiKey.findUnique({ where: { prefix } });
  if (!row) return { ok: false, reason: "Ключ не найден" };

  const given = Buffer.from(hashKey(key), "hex");
  const stored = Buffer.from(row.keyHash, "hex");
  if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
    return { ok: false, reason: "Ключ не найден" };
  }
  if (row.revokedAt) return { ok: false, reason: "Ключ отозван" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "Срок действия ключа истёк" };

  // Отметка об использовании — чтобы в списке было видно живые и забытые ключи.
  prisma.apiKey
    .update({
      where: { id: row.id },
      data: { lastUsedAt: new Date(), useCount: { increment: 1 } },
    })
    .catch(() => {
      /* счётчик не важнее ответа на запрос */
    });

  return {
    ok: true,
    id: row.id,
    name: row.name,
    scopes: JSON.parse(row.scopes) as ApiScope[],
  };
}

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  useCount: number;
  note: string | null;
  createdAt: Date;
  authorName: string | null;
  /** Живой, отозванный или просроченный — одним словом для списка. */
  state: "живой" | "отозван" | "просрочен";
};

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const rows = await prisma.apiKey.findMany({
    orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
    include: { createdBy: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    scopes: JSON.parse(r.scopes) as ApiScope[],
    expiresAt: r.expiresAt,
    revokedAt: r.revokedAt,
    lastUsedAt: r.lastUsedAt,
    useCount: r.useCount,
    note: r.note,
    createdAt: r.createdAt,
    authorName: r.createdBy?.name ?? null,
    state: r.revokedAt ? "отозван" : r.expiresAt.getTime() < Date.now() ? "просрочен" : "живой",
  }));
}

export async function revokeApiKey(id: string): Promise<void> {
  await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
}
