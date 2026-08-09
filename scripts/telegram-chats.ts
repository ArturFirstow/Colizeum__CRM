// ─────────────────────────────────────────────────────────────────────────────
// Кто написал боту — тот и получит уведомления.
//
// Скрипт спрашивает у Telegram список последних сообщений боту и печатает,
// какой chat id у каждого написавшего. Искать эти числа вручную не нужно.
//
// Посмотреть, кто написал боту:
//   npx tsx scripts/telegram-chats.ts
//
// Сразу привязать чат к сотруднику:
//   npx tsx scripts/telegram-chats.ts a.firstov@colizeum.ru 123456789
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type TgChat = { id: number; first_name?: string; last_name?: string; username?: string };
type TgUpdate = { message?: { chat?: TgChat; text?: string } };

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const [email, chatId] = process.argv.slice(2);

  // Режим привязки — токен не нужен, просто пишем в базу.
  if (email && chatId) {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) {
      console.error(`Сотрудник ${email} не найден.`);
      process.exit(1);
    }
    await prisma.user.update({ where: { id: user.id }, data: { telegramChatId: chatId.trim() } });
    console.log(`Готово. ${user.name} будет получать уведомления в чат ${chatId}.`);
    return;
  }

  if (!token) {
    console.error("Не задан TELEGRAM_BOT_TOKEN в .env — см. docs/TELEGRAM.md");
    process.exit(1);
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const data = (await res.json()) as { ok: boolean; result?: TgUpdate[]; description?: string };
  if (!data.ok) {
    console.error(`Telegram ответил ошибкой: ${data.description ?? "неизвестно"}`);
    process.exit(1);
  }

  // Один и тот же человек мог написать несколько раз — оставляем по одному.
  const chats = new Map<number, TgChat>();
  for (const u of data.result ?? []) {
    const chat = u.message?.chat;
    if (chat) chats.set(chat.id, chat);
  }

  if (chats.size === 0) {
    console.log("Боту пока никто не написал.\n");
    console.log("Попросите каждого сотрудника открыть бота в Telegram и отправить /start,");
    console.log("затем запустите эту команду снова.");
    return;
  }

  console.log("\nКто написал боту:\n");
  for (const c of chats.values()) {
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "без имени";
    const at = c.username ? ` (@${c.username})` : "";
    console.log(`  chat id ${String(c.id).padEnd(14)} ${name}${at}`);
  }

  const users = await prisma.user.findMany({
    select: { email: true, name: true, telegramChatId: true },
    orderBy: { email: "asc" },
  });
  console.log("\nСотрудники сервиса:\n");
  for (const u of users) {
    const state = u.telegramChatId ? `→ чат ${u.telegramChatId}` : "— уведомления не настроены";
    console.log(`  ${u.email.padEnd(28)} ${u.name.padEnd(20)} ${state}`);
  }

  console.log("\nПривязать:  npx tsx scripts/telegram-chats.ts <почта> <chat id>");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
