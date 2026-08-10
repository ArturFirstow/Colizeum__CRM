import { NextRequest } from "next/server";
import { withSession, ok, fail } from "@/lib/api";
import { aiComplete, aiConfigured, aiErrorMessage, AI_NO_KEY_MESSAGE } from "@/lib/ai";

// Разбор транскрипта: ИИ достаёт показатели встречи для таблицы учёта.
// Возвращает только данные — сохраняет их пользователь, проверив глазами.
export async function POST(req: NextRequest) {
  return withSession(async () => {
    if (!aiConfigured()) return fail("ai_not_configured", AI_NO_KEY_MESSAGE, 400);

    const { transcript } = (await req.json()) as { transcript?: string };
    if (!transcript || transcript.trim().length < 20) {
      return fail("bad_request", "Вставьте расшифровку встречи", 400);
    }

    const today = new Date().toISOString().slice(0, 10);
    const system = [
      "Ты помощник менеджера рекламного агентства. Из расшифровки встречи достань показатели для таблицы учёта.",
      "Отвечай ТОЛЬКО JSON-объектом, без пояснений и без markdown-обёртки.",
      "Поля:",
      '  "meetingDate" — дата встречи, формат YYYY-MM-DD;',
      '  "startTime" — время начала, формат HH:MM;',
      '  "endTime" — время окончания, формат HH:MM;',
      '  "participants" — участники встречи через запятую, только имена и компании;',
      '  "meetingWith" — с кем встреча: главный собеседник или компания;',
      '  "protocolUrl" — ссылка на протокол или расшифровку, если она есть в тексте;',
      '  "meetingUrl" — ссылка на саму встречу или запись, если она есть в тексте;',
      '  "summary" — итоги встречи и договорённости, 1–3 предложения по-русски.',
      "Чего в тексте нет — ставь null, не выдумывай.",
      `Если дата не названа прямо, но есть «сегодня»/«вчера» — считай от ${today}.`,
    ].join("\n");

    try {
      const raw = await aiComplete({
        system,
        user: transcript.slice(0, 40_000),
        maxTokens: 800,
      });

      // Модели любят обернуть JSON в ```json … ``` — вырезаем сам объект.
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return fail("ai_bad_answer", "ИИ ответил не по формату, заполните поля вручную", 502);
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;

      const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
      return ok({
        meetingDate: str(parsed.meetingDate),
        startTime: str(parsed.startTime),
        endTime: str(parsed.endTime),
        participants: str(parsed.participants),
        meetingWith: str(parsed.meetingWith),
        protocolUrl: str(parsed.protocolUrl),
        meetingUrl: str(parsed.meetingUrl),
        summary: str(parsed.summary),
      });
    } catch (e) {
      return fail("ai_error", aiErrorMessage(e), 502);
    }
  });
}
