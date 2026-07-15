import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
import { fail } from "@/lib/api";

type Ctx = { params: Promise<{ id: string; kind: string }> };

// Скачивание файла ОРД (creative | act) через backend.
export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return fail("unauthorized", "Требуется вход", 401);

  const { id, kind } = await ctx.params;
  const ord = await prisma.ordMarking.findUnique({ where: { id } });
  if (!ord) return fail("not_found", "Запись не найдена", 404);

  const storageKey = kind === "creative" ? ord.creativeStorageKey : kind === "act" ? ord.actStorageKey : null;
  const fileName = kind === "creative" ? ord.creativeFileName : ord.actFileName;
  if (!storageKey) return fail("not_found", "Файл не загружен", 404);

  const obj = await getStorage().get(storageKey);
  if (!obj) return fail("not_found", "Файл отсутствует в хранилище", 404);

  return new NextResponse(new Uint8Array(obj.data), {
    status: 200,
    headers: {
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName ?? kind)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
