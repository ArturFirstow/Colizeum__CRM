import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { documentCreateSchema } from "@/lib/validation";

// Создать логический документ (без файла — файл грузится версией отдельно).
export async function POST(req: NextRequest) {
  return withSession(async () => {
    const data = documentCreateSchema.parse(await req.json());
    const document = await prisma.document.create({ data });
    return ok(document, { status: 201 });
  });
}
