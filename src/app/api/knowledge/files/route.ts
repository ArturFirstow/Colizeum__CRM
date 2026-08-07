import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { getStorage, sanitizeFileName } from "@/lib/storage";

// Загрузка рабочего файла в базу знаний (шаблон договора, прайс, презентация).
export async function POST(req: NextRequest) {
  return withSession(async () => {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("no_file", "Выберите файл", 400);

    const title = String(form.get("title") ?? "").trim() || file.name;
    const category = String(form.get("category") ?? "").trim() || "Материалы для клиента";
    const description = String(form.get("description") ?? "").trim();

    const buffer = Buffer.from(await file.arrayBuffer());
    const created = await prisma.knowledgeFile.create({
      data: {
        title,
        category,
        description: description || null,
        fileName: file.name,
        sizeBytes: buffer.length,
        contentType: file.type || null,
        storageKey: "pending",
      },
    });
    const storageKey = `knowledge/${created.id}/${sanitizeFileName(file.name)}`;
    await getStorage().put(storageKey, buffer, file.type || "application/octet-stream");
    const saved = await prisma.knowledgeFile.update({ where: { id: created.id }, data: { storageKey } });
    return ok(saved);
  });
}
