// Переименовать сотрудника: npx tsx scripts/rename-user.ts <почта> "Имя Фамилия"
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const [email, name] = process.argv.slice(2);
  if (!email || !name) {
    console.error('Укажите почту и имя: npx tsx scripts/rename-user.ts a.ivanushkin@colizeum.ru "Александр Иванушкин"');
    process.exit(1);
  }
  const user = await prisma.user.update({
    where: { email: email.trim().toLowerCase() },
    data: { name: name.trim() },
  });
  console.log(`Готово: теперь ${user.email} отображается как «${user.name}».`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
