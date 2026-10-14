import { NextRequest, NextResponse } from "next/server";
import {
  acceptWebhookLead,
  keyMatches,
  webhookConfigured,
  WEBHOOK_BODY_LIMIT,
} from "@/lib/services/leads-webhook";

// ─────────────────────────────────────────────────────────────────────────────
// Приёмник заявок с сайта (вебхук Тильды).
//
//   POST https://<адрес сервиса>/api/webhooks/tilda?key=<ключ>
//
// Этот адрес вставляется в Тильде: «Настройки сайта» → «Формы» → «Webhook».
// Инструкция по шагам — docs/ВЕБХУК_ТИЛЬДА.md.
//
// ⚠️ Ключ стоит в адресе, а не в заголовке, потому что Тильда своих заголовков
// к запросу не добавляет. Поэтому адрес с ключом = доступ: его не публикуют,
// не кладут в код страницы и не отправляют в переписку. Меняется он в одну
// строку в настройках сервера.
//
// ⚠️ Отвечаем 200 почти всегда — даже на непонятное тело. Для Тильды не-200
// значит «интеграция сломана»: она покажет ошибку и может перестать слать
// заявки. Отказ отдаём только на неверный ключ, иначе о подборе никто бы не
// узнал. Что именно пришло и что сервис с этим сделал — видно в журнале
// сервера и в журнале передач.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

function reply(status: number, body: Record<string, unknown>) {
  // Тильде достаточно кода ответа; тело — для человека, который проверяет
  // настройку руками через браузер или curl.
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!webhookConfigured()) {
    console.error("[tilda] заявка пришла, но LEADS_WEBHOOK_SECRET не задан в .env");
    return reply(503, {
      ok: false,
      error: "Приём заявок не настроен: на сервере не задан ключ LEADS_WEBHOOK_SECRET.",
    });
  }

  const key = req.nextUrl.searchParams.get("key") ?? req.headers.get("x-webhook-key");
  if (!keyMatches(key)) {
    console.warn("[tilda] запрос с неверным ключом");
    return reply(401, { ok: false, error: "Неверный ключ" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await readBody(req);
  } catch (e) {
    console.error("[tilda] не разобрали тело запроса:", e);
    return reply(200, { ok: false, error: "Не удалось разобрать тело запроса" });
  }

  try {
    const result = await acceptWebhookLead(payload, {
      referer: req.headers.get("referer") ?? undefined,
    });
    // Короткая строка в журнал сервера: при разборе «а дошла ли заявка?»
    // это первое, куда смотрят (pm2 logs colizeum, искать «[tilda]»).
    console.log(`[tilda] ${result.outcome}${"id" in result ? ` ${result.id}` : ""}`);
    return reply(200, { ok: true, result: result.outcome });
  } catch (e) {
    // Заявку потерять нельзя, а 500 Тильда покажет как поломку интеграции.
    // Поэтому пишем тревогу в журнал сервера и отвечаем успехом.
    console.error("[tilda] заявка не сохранилась:", e);
    return reply(200, { ok: false, error: "Заявка не сохранена, подробности в журнале сервера" });
  }
}

/**
 * Тильда шлёт либо обычную форму (по умолчанию), либо JSON — если в настройках
 * вебхука включена соответствующая галочка. Поддерживаем оба вида и не
 * заставляем человека угадывать, какой выбрать.
 */
async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const type = (req.headers.get("content-type") ?? "").toLowerCase();

  if (type.includes("application/json")) {
    const text = await limitedText(req);
    const parsed = text ? JSON.parse(text) : {};
    if (Array.isArray(parsed)) {
      // Некоторые интеграции шлют массив из одной заявки.
      return (parsed[0] ?? {}) as Record<string, unknown>;
    }
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  }

  if (type.includes("form-data") || type.includes("x-www-form-urlencoded")) {
    const form = await req.formData();
    const out: Record<string, unknown> = {};
    for (const [k, v] of form.entries()) {
      const value = typeof v === "string" ? v : v.name;
      // Несколько галочек приходят одним именем — собираем в список.
      out[k] = k in out ? `${out[k]}, ${value}` : value;
    }
    return out;
  }

  // Content-Type не прислали: пробуем сначала как JSON, потом как форму.
  const text = await limitedText(req);
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    // не JSON — ниже разберём как строку запроса
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of new URLSearchParams(text).entries()) out[k] = v;
  return out;
}

/** Чужое тело читаем с ограничением: иначе один большой запрос съест память. */
async function limitedText(req: NextRequest): Promise<string> {
  const text = await req.text();
  if (text.length > WEBHOOK_BODY_LIMIT) {
    throw new Error(`тело запроса больше ${WEBHOOK_BODY_LIMIT} байт`);
  }
  return text;
}

/**
 * GET оставлен нарочно: человек открывает адрес в браузере и сразу видит,
 * верен ли ключ и дошёл ли запрос до сервиса. Заявок GET не создаёт.
 */
export async function GET(req: NextRequest) {
  if (!webhookConfigured()) {
    return reply(503, {
      ok: false,
      error: "Приём заявок не настроен: на сервере не задан ключ LEADS_WEBHOOK_SECRET.",
    });
  }
  const key = req.nextUrl.searchParams.get("key") ?? req.headers.get("x-webhook-key");
  if (!keyMatches(key)) return reply(401, { ok: false, error: "Неверный ключ" });
  return reply(200, {
    ok: true,
    message: "Приёмник заявок работает. Этот адрес вставляется в Тильде как Webhook URL.",
  });
}
