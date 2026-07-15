import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { getStorage } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

// Удаление документа со всеми версиями (и файлами в хранилище).
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    const doc = await prisma.document.findUnique({
      where: { id },
      include: { versions: true },
    });
    if (doc) {
      const storage = getStorage();
      await Promise.all(doc.versions.map((v) => storage.delete(v.storageKey).catch(() => {})));
      await prisma.document.delete({ where: { id } });
    }
    return ok({ ok: true });
  });
}
