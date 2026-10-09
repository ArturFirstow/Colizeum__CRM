import { NextRequest, NextResponse } from "next/server";
import { serveList } from "@/lib/services/api-v1";
import { entityByPath, API_REGISTRY } from "@/lib/services/api-registry";

// Один обработчик на все разделы API. Что именно отдаёт каждый — в
// src/lib/services/api-registry.ts: там же описание полей, из которого
// строится машинное описание OpenAPI. Разъехаться они не могут.

export async function GET(req: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  const spec = entityByPath(entity);
  if (!spec) {
    return NextResponse.json(
      {
        error: {
          code: "not_found",
          message: `Раздела «${entity}» нет. Доступны: ${Object.keys(API_REGISTRY).join(", ")}`,
        },
      },
      { status: 404 },
    );
  }
  return serveList(req, spec);
}
