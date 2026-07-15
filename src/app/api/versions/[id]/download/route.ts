import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
import { fail } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// Скачивание версии через backend с проверкой прав (прямой доступ к бакету запрещён).
export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return fail("unauthorized", "Требуется вход", 401);

  const { id } = await ctx.params;
  const version = await prisma.documentVersion.findUnique({ where: { id } });
  if (!version) return fail("not_found", "Версия не найдена", 404);

  const storage = getStorage();
  const obj = await storage.get(version.storageKey);
  if (!obj) return fail("not_found", "Файл отсутствует в хранилище", 404);

  const bytes = new Uint8Array(obj.data);
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": version.mimeType || "application/octet-stream",
      "Content-Length": String(version.sizeBytes),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(version.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
