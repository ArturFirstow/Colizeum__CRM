import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { decisionCreateSchema } from "@/lib/validation";

// Сотрудник отправляет вопрос руководителю («нужно согласовать», «выдать доступ»).
export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const data = decisionCreateSchema.parse(await req.json());
    const created = await prisma.decisionRequest.create({
      data: {
        title: data.title,
        details: data.details ?? null,
        kind: data.kind ?? "Согласование",
        advertiserId: data.advertiserId ?? null,
        dealId: data.dealId ?? null,
        attachmentsKey: data.attachmentsKey ?? null,
        requesterId: session.userId,
      },
    });
    return ok(created);
  });
}
