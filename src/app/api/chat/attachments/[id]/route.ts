import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
import { fail } from "@/lib/api";
import { guardChatAttachment } from "@/lib/guard";

type Ctx = { params: Promise<{ id: string }> };

// Скачивание вложения чата через backend (с проверкой входа).
export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return fail("unauthorized", "Требуется вход", 401);

  const { id } = await ctx.params;
  // Проверка участия в канале: без неё файл из чужой личной переписки
  // скачивался по прямой ссылке любым вошедшим сотрудником.
  const att = await guardChatAttachment(session, id);

  const obj = await getStorage().get(att.storageKey);
  if (!obj) return fail("not_found", "Файл отсутствует в хранилище", 404);

  return new NextResponse(new Uint8Array(obj.data), {
    status: 200,
    headers: {
      "Content-Type": att.contentType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(att.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
