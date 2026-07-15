import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { knowledgeCreateSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  return withSession(async () => {
    const data = knowledgeCreateSchema.parse(await req.json());
    const article = await prisma.knowledgeArticle.create({ data });
    return ok(article, { status: 201 });
  });
}
