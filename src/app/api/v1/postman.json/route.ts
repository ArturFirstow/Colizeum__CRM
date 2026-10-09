import { NextRequest, NextResponse } from "next/server";
import { buildPostmanCollection } from "@/lib/services/api-openapi";

// Готовая коллекция для Postman: скачать и импортировать. Данных не содержит,
// поэтому тоже без ключа — ключ подставляется переменной коллекции.
export async function GET(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  return NextResponse.json(buildPostmanCollection(`${proto}://${host}`), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="colizeum-agency-api.postman_collection.json"',
    },
  });
}
