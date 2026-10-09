import { NextRequest, NextResponse } from "next/server";
import { buildOpenApi } from "@/lib/services/api-openapi";

// Машинное описание контура (требование 9.1).
//
// Отдаётся БЕЗ ключа намеренно: здесь нет ни одной записи из базы — только
// список адресов и названия полей, то же самое, что в docs/API.md. Требовать
// ключ, чтобы прочитать инструкцию, значит мешать тому, кто подключается.
export async function GET(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  return NextResponse.json(buildOpenApi(`${proto}://${host}`), {
    headers: { "Cache-Control": "no-store" },
  });
}
