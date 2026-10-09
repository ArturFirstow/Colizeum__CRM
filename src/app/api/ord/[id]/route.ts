import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { ORD_ROLES } from "@/lib/enums";
import { guardOrd } from "@/lib/guard";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  erid: z.string().optional(),
  role: z.string().refine((v) => (ORD_ROLES as readonly string[]).includes(v)).optional(),
  finalClient: z.string().optional(),
  platform: z.string().optional(),
  status: z.string().optional(),
  urgent: z.boolean().optional(),
  monthlyClosing: z.boolean().optional(),
  // Ссылка на процесс в Aspro (И-5): пустая строка снимает ссылку.
  asproUrl: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), {
      message: "Ссылка должна начинаться с http:// или https://",
    }),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardOrd(session, id);
    const data = patchSchema.parse(await req.json());
    const ord = await prisma.ordMarking.update({ where: { id }, data });
    return ok(ord);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    await guardOrd(session, id);
    await prisma.ordMarking.delete({ where: { id } });
    return ok({ ok: true });
  });
}
