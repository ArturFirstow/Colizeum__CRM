import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { getStorage } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  await requireSession();
  const { id } = await ctx.params;
  const file = await prisma.fileAsset.findUnique({ where: { id } });
  if (!file) return new Response("Файл не найден", { status: 404 });
  const stored = await getStorage().get(file.storageKey);
  if (!stored) return new Response("Файл недоступен", { status: 404 });
  return new Response(new Uint8Array(stored.data), {
    headers: {
      "Content-Type": file.contentType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    },
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    const file = await prisma.fileAsset.findUnique({ where: { id } });
    if (!file) return fail("not_found", "Файл не найден", 404);
    await getStorage().delete(file.storageKey).catch(() => {});
    await prisma.fileAsset.delete({ where: { id } });
    return ok({ ok: true });
  });
}
