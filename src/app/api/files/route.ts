import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { getStorage, sanitizeFileName } from "@/lib/storage";
import { checkUpload } from "@/lib/upload-rules";
import { writeAudit, clientIp } from "@/lib/audit";

// Список вложений владельца (карточка сделки, статья базы знаний и т.д.).
export async function GET(req: NextRequest) {
  return withSession(async () => {
    const { searchParams } = new URL(req.url);
    const ownerType = searchParams.get("ownerType");
    const ownerId = searchParams.get("ownerId");
    const kind = searchParams.get("kind");
    if (!ownerType || !ownerId) return fail("bad_request", "Не указан владелец файла", 400);
    const files = await prisma.fileAsset.findMany({
      where: { ownerType, ownerId, ...(kind ? { kind } : {}) },
      orderBy: { uploadedAt: "desc" },
    });
    return ok(files);
  });
}

// Загрузка файла. Файл кладём в StorageProvider, в БД — только метаданные.
export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("no_file", "Выберите файл", 400);

    const ownerType = String(form.get("ownerType") ?? "").trim();
    // «Входящие» напарника всегда привязаны к самому сотруднику.
    const ownerId = ownerType === "inbox" ? session.userId : String(form.get("ownerId") ?? "").trim();
    if (!ownerType || !ownerId) return fail("bad_request", "Не указан владелец файла", 400);

    const kind = String(form.get("kind") ?? "").trim() || "Прочее";
    const title = String(form.get("title") ?? "").trim() || file.name;
    const advertiserId = String(form.get("advertiserId") ?? "").trim() || null;
    const dealId = String(form.get("dealId") ?? "").trim() || null;

    // Тип и размер проверяем ДО чтения файла в память: иначе гигабайтный файл
    // сначала целиком попадёт в память сервера и только потом будет отвергнут.
    const verdict = checkUpload(file.name, file.type, file.size);
    if (!verdict.ok) return fail("bad_file", verdict.message, 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const created = await prisma.fileAsset.create({
      data: {
        ownerType,
        ownerId,
        kind,
        title,
        fileName: file.name,
        sizeBytes: buffer.length,
        contentType: file.type || null,
        storageKey: "pending",
        advertiserId,
        dealId,
        uploadedById: session.userId,
        uploadedByName: session.name,
      },
    });
    const storageKey = `files/${ownerType}/${created.id}/${sanitizeFileName(file.name)}`;
    await getStorage().put(storageKey, buffer, file.type || "application/octet-stream");
    const saved = await prisma.fileAsset.update({ where: { id: created.id }, data: { storageKey } });
    writeAudit({
      action: "file.upload",
      userId: session.userId,
      userName: session.name,
      entityType: "file",
      entityId: saved.id,
      changedFields: [kind, `${Math.round(buffer.length / 1024)} КБ`],
      ip: clientIp(req),
    });
    return ok(saved);
  });
}
