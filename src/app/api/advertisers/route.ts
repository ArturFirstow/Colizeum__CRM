import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { advertiserCreateSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  return withSession(async () => {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? undefined;
    const q = searchParams.get("q")?.trim();
    const advertisers = await prisma.advertiser.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(q
          ? {
              OR: [
                { nameRu: { contains: q } },
                { nameEn: { contains: q } },
                { legalEntity: { contains: q } },
                { inn: { contains: q } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { deals: true, documents: true, contacts: true } } },
      orderBy: { nameRu: "asc" },
    });
    return ok(advertisers);
  });
}

export async function POST(req: NextRequest) {
  return withSession(async () => {
    const data = advertiserCreateSchema.parse(await req.json());
    const advertiser = await prisma.advertiser.create({ data });
    return ok(advertiser, { status: 201 });
  });
}
