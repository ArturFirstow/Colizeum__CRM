// ─────────────────────────────────────────────────────────────────────────────
// Пароли сотрудникам одной командой.
//
// Каждому — свой стойкий пароль (16 символов), список печатается на экран:
//   npx tsx scripts/reset-passwords.ts
//
// Один общий пароль всем (быстрая проверка, менее безопасно):
//   npx tsx scripts/reset-passwords.ts "ОбщийПароль123"
//
// Поменять пароль одному человеку:
//   npx tsx scripts/set-password.ts <почта> "ЛичныйПароль"
// ─────────────────────────────────────────────────────────────────────────────

import { randomInt } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ROLE_RU: Record<string, string> = {
  Owner: "админ",
  Director: "руководитель",
  Manager: "менеджер",
};

// Без похожих друг на друга символов (0/O, 1/l/I) — пароль диктуют и переписывают.
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGIT = "23456789";
const SPECIAL = "!@#$%&*+-=?";
const ALL = UPPER + LOWER + DIGIT + SPECIAL;

function strongPassword(length = 16): string {
  // По одному символу каждого вида — гарантия, что пароль пройдёт любые правила.
  const chars = [
    UPPER[randomInt(UPPER.length)],
    LOWER[randomInt(LOWER.length)],
    DIGIT[randomInt(DIGIT.length)],
    SPECIAL[randomInt(SPECIAL.length)],
  ];
  while (chars.length < length) chars.push(ALL[randomInt(ALL.length)]);
  // Перемешиваем, иначе первые четыре позиции всегда одного вида.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

async function main() {
  const shared = process.argv[2];
  if (shared !== undefined && shared.length < 6) {
    console.error("Общий пароль слишком короткий — минимум 6 символов.");
    process.exit(1);
  }

  const users = await prisma.user.findMany({ orderBy: { role: "asc" } });
  if (users.length === 0) {
    console.error("В базе нет сотрудников — похоже, сид не запускался.");
    process.exit(1);
  }

  const issued: { email: string; name: string; role: string; track: string; password: string }[] = [];

  for (const u of users) {
    const password = shared ?? strongPassword();
    await prisma.user.update({
      where: { id: u.id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    issued.push({ email: u.email, name: u.name, role: u.role, track: u.track, password });
  }

  const wEmail = Math.max(...issued.map((i) => i.email.length));
  const wPass = Math.max(...issued.map((i) => i.password.length));

  console.log(`\nПароли заданы: ${issued.length} сотрудников.\n`);
  console.log(`  ${"ЛОГИН".padEnd(wEmail)}  ${"ПАРОЛЬ".padEnd(wPass)}  КТО`);
  console.log(`  ${"-".repeat(wEmail)}  ${"-".repeat(wPass)}  ---`);
  for (const i of issued) {
    const who = `${i.name} — ${ROLE_RU[i.role] ?? i.role}${i.track === "Tournaments" ? ", турниры" : ""}`;
    console.log(`  ${i.email.padEnd(wEmail)}  ${i.password.padEnd(wPass)}  ${who}`);
  }
  console.log(
    "\nСохраните список сейчас — пароли нигде не хранятся в открытом виде и заново их не увидеть.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
