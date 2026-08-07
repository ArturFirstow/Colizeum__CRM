import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";

// Файлы, закинутые в напарника и ещё не разложенные по разделам.
export async function GET() {
  return withSession(async (session) => {
    const files = await prisma.fileAsset.findMany({
      where: { ownerType: "inbox", ownerId: session.userId },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, title: true, fileName: true, sizeBytes: true },
    });
    return ok(files);
  });
}
