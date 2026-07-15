import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { ORD_ROLES } from "@/lib/enums";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  erid: z.string().optional(),
  role: z.string().refine((v) => (ORD_ROLES as readonly string[]).includes(v)).optional(),
  finalClient: z.string().optional(),
  platform: z.string().optional(),
  status: z.string().optional(),
  urgent: z.boolean().optional(),
  monthlyClosing: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    const data = patchSchema.parse(await req.json());
    const ord = await prisma.ordMarking.update({ where: { id }, data });
    return ok(ord);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    await prisma.ordMarking.delete({ where: { id } });
    return ok({ ok: true });
  });
}
