// ─────────────────────────────────────────────────────────────────────────────
// Задать пароль сотруднику напрямую в базе.
// Нужно, когда пароль забыт или неизвестен (например, сид отработал с другими
// значениями SEED_PW_*). Работает и на боевом сервере — данные не трогает,
// меняет только пароль указанного человека.
//
// Посмотреть список сотрудников:
//   npx tsx scripts/set-password.ts --list
//
// Задать пароль:
//   npx tsx scripts/set-password.ts a.firstov@colizeum.ru "НовыйПароль123"
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [emailArg, passwordArg] = process.argv.slice(2);

  if (!emailArg || emailArg === "--list") {
    const users = await prisma.user.findMany({
      select: { email: true, name: true, role: true },
      orderBy: { email: "asc" },
    });
    if (users.length === 0) {
      console.log("В базе нет ни одного сотрудника. Похоже, сид не запускался.");
      return;
    }
    console.log("Сотрудники в базе:\n");
    for (const u of users) console.log(`  ${u.email.padEnd(30)} ${u.name} — ${u.role}`);
    console.log(
      '\nЗадать пароль:  npx tsx scripts/set-password.ts <почта> "НовыйПароль"',
    );
    return;
  }

  const email = emailArg.trim().toLowerCase();

  if (!passwordArg) {
    console.error('Укажите пароль вторым аргументом, в кавычках: ... "НовыйПароль123"');
    process.exit(1);
  }
  if (passwordArg.length < 6) {
    console.error("Пароль слишком короткий — минимум 6 символов.");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Сотрудник с почтой ${email} не найден.`);
    console.error("Посмотреть список:  npx tsx scripts/set-password.ts --list");
    process.exit(1);
  }

  await prisma.user.update({
    where: { email },
    data: { passwordHash: await bcrypt.hash(passwordArg, 10) },
  });

  console.log(`Готово. Пароль для ${user.name} (${email}) обновлён.`);
  console.log("Войдите на сайте с этой почтой и новым паролем.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
