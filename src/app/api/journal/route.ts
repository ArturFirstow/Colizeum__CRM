import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { journalCreateSchema } from "@/lib/validation";

// MVP: ручная запись без AI-разбора (AI-ingest — фаза v2, блупринт 6.11).
export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const data = journalCreateSchema.parse(await req.json());
    const entry = await prisma.journalEntry.create({ data: { ...data, ownerId: session.userId } });
    return ok(entry, { status: 201 });
  });
}
