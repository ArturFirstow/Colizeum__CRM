import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { taskCreateSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const data = taskCreateSchema.parse(await req.json());
    const task = await prisma.task.create({
      data: { ...data, ownerId: session.userId, dueDate: data.dueDate ? new Date(data.dueDate) : undefined },
    });
    return ok(task, { status: 201 });
  });
}
