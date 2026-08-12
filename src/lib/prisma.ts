import { PrismaClient } from "@prisma/client";

// Singleton, чтобы в dev (hot reload Next.js) не плодить подключения.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; sqliteTuned?: boolean };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ─────────────────────────────────────────────────────────────────────────────
// SQLite: включаем режим WAL.
//
// Из коробки база живёт в режиме journal_mode=delete, и это главная причина
// «сайт подтормаживает». В нём любая запись — сообщение в чат, сохранение
// задачи, отметка о прочтении — на время своей работы БЛОКИРУЕТ всех, кто
// в этот момент просто читает страницу. Пять человек в сервисе плюс опросы
// уведомлений раз в 10–12 секунд — и запросы регулярно стоят в очереди.
//
// WAL (журнал предзаписи) разводит их: читатели работают, пока идёт запись.
// Режим хранится в самом файле базы, поэтому команду достаточно выполнить
// один раз — дальше он действует всегда, включая перезапуски. Повторный
// вызов ничего не ломает.
// ─────────────────────────────────────────────────────────────────────────────
if (!globalForPrisma.sqliteTuned && process.env.DATABASE_URL?.startsWith("file:")) {
  globalForPrisma.sqliteTuned = true;
  void prisma
    .$queryRawUnsafe("PRAGMA journal_mode=WAL")
    .catch(() => {
      // База ещё не создана или занята — не повод падать при старте.
    });
}
