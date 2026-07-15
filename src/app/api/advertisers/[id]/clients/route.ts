import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { agencyClientCreateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Добавить клиента агентства.
export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    const data = agencyClientCreateSchema.parse(await req.json());
    const client = await prisma.agencyClient.create({
      data: { ...data, advertiserId: id },
    });
    return ok(client, { status: 201 });
  });
}
