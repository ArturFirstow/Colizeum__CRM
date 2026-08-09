// ─────────────────────────────────────────────────────────────────────────────
// Задать ОДИН пароль сразу всем сотрудникам — чтобы быстро зайти под каждым и
// проверить сервис целиком (у ролей разный набор разделов).
//
// Запуск:
//   npx tsx scripts/reset-passwords.ts "ОбщийПароль123"
//
// После проверки задайте людям личные пароли:
//   npx tsx scripts/set-password.ts <почта> "ЛичныйПароль"
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ROLE_RU: Record<string, string> = {
  Owner: "админ",
  Director: "руководитель",
  Manager: "менеджер",
};

async function main() {
  const password = process.argv[2];

  if (!password || password.length < 6) {
    console.error('Укажите пароль в кавычках, минимум 6 символов:');
    console.error('  npx tsx scripts/reset-passwords.ts "ОбщийПароль123"');
    process.exit(1);
  }

  const users = await prisma.user.findMany({ orderBy: { email: "asc" } });
  if (users.length === 0) {
    console.error("В базе нет сотрудников — похоже, сид не запускался.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.updateMany({ data: { passwordHash } });

  console.log(`\nПароль «${password}» задан для всех ${users.length} сотрудников.\n`);
  console.log("Логины:\n");
  for (const u of users) {
    const track = u.track === "Tournaments" ? ", турниры" : "";
    console.log(`  ${u.email.padEnd(30)} ${u.name} — ${ROLE_RU[u.role] ?? u.role}${track}`);
  }
  console.log("\nПароль у всех одинаковый — тот, что выше.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
