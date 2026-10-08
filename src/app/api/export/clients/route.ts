import { NextRequest } from "next/server";
import { withSession, handleError } from "@/lib/api";
import { buildClientsWorkbook } from "@/lib/services/client-export";
import { writeAudit, clientIp } from "@/lib/audit";
import { raiseAlert } from "@/lib/services/security-alerts";

// Выгрузка клиентов в Excel: «передаю дела, вот всё, что есть».
// ?all=1 — весь отдел (сработает только у руководителя, иначе тихо отдадим своих).
export async function GET(req: NextRequest) {
  return withSession(async (session) => {
    try {
      const everyone = req.nextUrl.searchParams.get("all") === "1";
      const { buffer, fileName, clientCount } = await buildClientsWorkbook(session, everyone);

      // Выгрузка — самое чувствительное действие: из сервиса уходит файл со
      // всеми контактами. Пишем в журнал отдельно (требование 5.3: «выгрузил»).
      writeAudit({
        action: "export.clients",
        userId: session.userId,
        userName: session.name,
        entityType: "advertiser",
        changedFields: [`клиентов: ${clientCount}`, everyone ? "весь отдел" : "свои"],
        ip: clientIp(req),
      });

      // Выгрузка всего отдела — один файл со всеми контактами всех клиентов.
      // Законное действие при передаче дел, но ответственный за ИБ должен
      // знать, что такой файл покинул сервис (требование 6.7).
      if (everyone) {
        await raiseAlert({
          kind: "mass-export",
          userId: session.userId,
          userName: session.name,
          ip: clientIp(req),
          detail: `В Excel выгружены клиенты всего отдела — ${clientCount} шт., с контактными лицами.`,
        });
      }

      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          // filename* с UTF-8: без него русское имя файла превращается в кракозябры.
          "Content-Disposition": `attachment; filename="clients.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      return handleError(err);
    }
  });
}
