import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { getStorage, sanitizeFileName } from "@/lib/storage";
import { checkUpload } from "@/lib/upload-rules";
import { writeAudit, clientIp } from "@/lib/audit";
import { guardOrd } from "@/lib/guard";

type Ctx = { params: Promise<{ id: string }> };

// Загрузка файла к записи ОРД: kind = creative (картинка креатива) | act (PDF акта).
export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardOrd(session, id);
    const ord = await prisma.ordMarking.findUnique({ where: { id } });
    if (!ord) return fail("not_found", "Запись ОРД не найдена", 404);

    const form = await req.formData();
    const kind = String(form.get("kind") ?? "");
    const file = form.get("file");
    if (kind !== "creative" && kind !== "act") return fail("bad_kind", "kind: creative | act", 400);
    if (!file || typeof file === "string") return fail("no_file", "Файл не приложен", 400);

    // Тип и размер — общее правило на весь сервис (src/lib/upload-rules.ts).
    {
      const f = file as File;
      const verdict = checkUpload(f.name, f.type, f.size);
      if (!verdict.ok) return fail("bad_file", verdict.message, 400);
    }

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

// ─────────────────────────────────────────────────────────────────────────────
// Удаление ошибочно загруженного файла.
//
// Раньше его не было вовсе: загрузить креатив можно, скачать можно, а если
// приложили не тот — запись оставалась с чужим файлом навсегда. Единственным
// выходом было удалить всю запись ОРД вместе с ЕРИД и датами.
//
// Удаляем в том же порядке, что и везде в сервисе: сначала файл из хранилища,
// потом отметку в базе. Если упадём между ними — в базе останется ссылка на
// несуществующий файл, это видно и чинится повторным удалением. Наоборот
// получился бы файл-сирота, про который никто не знает.
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardOrd(session, id);
    const kind = new URL(req.url).searchParams.get("kind");
    if (kind !== "creative" && kind !== "act") return fail("bad_kind", "kind: creative | act", 400);

    const ord = await prisma.ordMarking.findUnique({ where: { id } });
    if (!ord) return fail("not_found", "Запись ОРД не найдена", 404);

    const storageKey = kind === "creative" ? ord.creativeStorageKey : ord.actStorageKey;
    const fileName = kind === "creative" ? ord.creativeFileName : ord.actFileName;
    if (!storageKey) return fail("no_file", "Файла и так нет", 400);

    try {
      await getStorage().delete(storageKey);
    } catch {
      // Файла в хранилище уже нет — цель всё равно достигнута, чистим отметку.
    }

    const updated = await prisma.ordMarking.update({
      where: { id },
      data:
        kind === "creative"
          ? { creativeStorageKey: null, creativeFileName: null }
          : { actStorageKey: null, actFileName: null },
    });

    writeAudit({
      action: "ord.file.delete",
      userId: session.userId,
      userName: session.name,
      entityType: "ord",
      entityId: id,
      changedFields: [kind === "creative" ? "креатив" : "акт", fileName ?? ""],
      ip: clientIp(req),
    });
    return ok(updated);
  });
}
