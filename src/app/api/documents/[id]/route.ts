import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { documentUpdateSchema } from "@/lib/validation";
import { getStorage } from "@/lib/storage";
import { guardDocument } from "@/lib/guard";

type Ctx = { params: Promise<{ id: string }> };

// Правка карточки документа: название, тип, привязка к сделке.
// Загруженные версии не трогаются — они живут своей историей.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardDocument(session, id);
    const data = documentUpdateSchema.parse(await req.json());
    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) return fail("not_found", "Документ не найден", 404);
    const doc = await prisma.document.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.dealId !== undefined ? { dealId: data.dealId } : {}),
      },
    });
    return ok(doc);
  });
}

// Удаление документа со всеми версиями (и файлами в хранилище).
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardDocument(session, id);
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
