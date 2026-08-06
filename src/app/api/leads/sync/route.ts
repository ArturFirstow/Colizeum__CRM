import { withSession, ok, fail } from "@/lib/api";
import { syncLeads } from "@/lib/services/leads-sync";

// Ручное обновление заявок из Google-таблицы (кнопка «Обновить» на странице).
export async function POST() {
  return withSession(async () => {
    try {
      const result = await syncLeads();
      return ok(result);
    } catch (e) {
      return fail("sheet_unavailable", e instanceof Error ? e.message : "Не удалось обновить заявки", 502);
    }
  });
}
