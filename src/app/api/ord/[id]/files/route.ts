import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { getStorage, sanitizeFileName } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

// Загрузка файла к записи ОРД: kind = creative (картинка креатива) | act (PDF акта).
export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    const ord = await prisma.ordMarking.findUnique({ where: { id } });
    if (!ord) return fail("not_found", "Запись ОРД не найдена", 404);

    const form = await req.formData();
    const kind = String(form.get("kind") ?? "");
    const file = form.get("file");
    if (kind !== "creative" && kind !== "act") return fail("bad_kind", "kind: creative | act", 400);
    if (!file || typeof file === "string") return fail("no_file", "Файл не приложен", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) return fail("empty_file", "Пустой файл", 400);

    const fileName = (file as File).name || kind;
    const mimeType = (file as File).type || "application/octet-stream";
    const storageKey = `ord/${id}/${kind}/${sanitizeFileName(fileName)}`;

    const storage = getStorage();
    await storage.put(storageKey, buffer, mimeType);

    const updated = await prisma.ordMarking.update({
      where: { id },
      data:
        kind === "creative"
          ? { creativeStorageKey: storageKey, creativeFileName: fileName }
          : { actStorageKey: storageKey, actFileName: fileName },
    });
    return ok(updated, { status: 201 });
  });
}
