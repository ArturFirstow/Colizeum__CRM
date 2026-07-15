import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { buildWeeklyReport } from "@/lib/services/weekly-report";

// GET /api/reports/weekly           → JSON { markdown, filename } (для превью)
// GET /api/reports/weekly?download=1 → файл .md на скачивание
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return fail("unauthorized", "Требуется вход", 401);

  const { markdown, filename } = await buildWeeklyReport();
  const download = new URL(req.url).searchParams.get("download");

  if (download) {
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  }
  return ok({ markdown, filename });
}
