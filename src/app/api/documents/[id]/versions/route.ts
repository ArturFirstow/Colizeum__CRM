import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { getStorage, sha256, buildStorageKey } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

// Загрузить новую версию документа (multipart). Новая загрузка = новая версия:
// инкремент versionNo, обновление currentVersionId, старые версии остаются.
// Дубликат по sha256 — предупреждение (если не force=true).
export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNo: "desc" } } },
    });
    if (!document) return fail("not_found", "Документ не найден", 404);

    const form = await req.formData();
    const file = form.get("file");
    const changeNote = (form.get("changeNote") as string | null)?.trim() || null;
    const force = form.get("force") === "true";

    if (!file || typeof file === "string") {
      return fail("no_file", "Файл не приложен", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) return fail("empty_file", "Пустой файл", 400);

    const hash = sha256(buffer);

    // Дедуп: тот же файл уже есть среди версий.
    const dup = document.versions.find((v) => v.sha256 === hash);
    if (dup && !force) {
      return fail("duplicate", `Этот файл уже загружен как версия ${dup.versionNo}`, 409, {
        duplicateVersionNo: dup.versionNo,
      });
    }

    const nextVersionNo = (document.versions[0]?.versionNo ?? 0) + 1;
    const fileName = (file as File).name || `file-v${nextVersionNo}`;
    const mimeType = (file as File).type || "application/octet-stream";
    const storageKey = buildStorageKey(document.advertiserId, document.id, nextVersionNo, fileName);

    const storage = getStorage();
    await storage.put(storageKey, buffer, mimeType);

    const version = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNo: nextVersionNo,
        storageKey,
        fileName,
        mimeType,
        sizeBytes: buffer.length,
        sha256: hash,
        uploadedById: session.userId,
        changeNote,
      },
    });

    await prisma.document.update({
      where: { id: document.id },
      data: { currentVersionId: version.id },
    });

    return ok(version, { status: 201 });
  });
}
