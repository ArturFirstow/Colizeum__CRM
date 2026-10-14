import { withSession, ok, fail } from "@/lib/api";
import { syncLeads, sheetSyncEnabled } from "@/lib/services/leads-sync";

// Ручное обновление заявок из Google-таблицы (кнопка «Обновить» на странице).
export async function POST() {
  return withSession(async () => {
    if (!sheetSyncEnabled()) {
      return fail(
        "sheet_disabled",
        "Чтение Google-таблицы выключено: заявки приходят с сайта напрямую. " +
          "Включить обратно — строка LEADS_SHEET_SYNC в настройках сервера.",
        409,
      );
    }
    try {
      const result = await syncLeads();
      return ok(result);
    } catch (e) {
      return fail("sheet_unavailable", e instanceof Error ? e.message : "Не удалось обновить заявки", 502);
    }
  });
}
