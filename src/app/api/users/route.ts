import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { userCreateSchema } from "@/lib/validation";

export async function GET() {
  return withSession(async () => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { ownedAdvertisers: true, ownedTasks: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return ok(users);
  });
}

// Выдача доступов сотруднику — только администратор сервиса (Owner).
export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    if (session.role !== "Owner") {
      return fail("forbidden", "Создавать сотрудников может только администратор", 403);
    }
    const data = userCreateSchema.parse(await req.json());
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) return fail("email_taken", "Сотрудник с таким e-mail уже есть", 409);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        role: data.role ?? "Manager",
        passwordHash: await hashPassword(data.password),
      },
      select: { id: true, name: true, email: true, role: true },
    });
    return ok(user, { status: 201 });
  });
}
