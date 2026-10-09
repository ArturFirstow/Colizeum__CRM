import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { contactCreateSchema } from "@/lib/validation";
import { guardAdvertiser } from "@/lib/guard";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardAdvertiser(session, id);
    const data = contactCreateSchema.parse(await req.json());
    const contact = await prisma.contact.create({
      data: { ...data, advertiserId: id },
    });
    return ok(contact, { status: 201 });
  });
}
