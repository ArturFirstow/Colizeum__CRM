import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { knowledgeUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    const data = knowledgeUpdateSchema.parse(await req.json());
    const article = await prisma.knowledgeArticle.update({ where: { id }, data });
    return ok(article);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    await prisma.knowledgeArticle.delete({ where: { id } });
    return ok({ ok: true });
  });
}
