import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// ─────────────────────────────────────────────────────────────────────────────
// Общий заслон перед всеми запросами. Делает три вещи:
//
//   1. Проверяет, что запрос пришёл с нашей же страницы (защита от подделки
//      запросов, CSRF — требование 5.6).
//   2. Ограничивает частоту обращений к API (требование 5.6).
//   3. Держит белый список разделов для роли «Безопасность» (требование 5.2).
//
// Почему здесь, а не в каждом обработчике: про новый раздел легко забыть, и он
// молча окажется без защиты. В одном месте забыть нельзя.
// ─────────────────────────────────────────────────────────────────────────────

const COOKIE_NAME = "colizeum_session";

// ── 1. Защита от подделки запросов (CSRF) ────────────────────────────────────
//
// Суть опасности: человек вошёл в сервис, а потом открыл постороннюю страницу,
// и та отправила на наш адрес запрос «удалить клиента». Браузер приложил бы к
// нему куку сессии, и сервис выполнил бы чужую команду как свою.
//
// Защита: браузер сам сообщает, с какой страницы отправлен запрос (заголовок
// Origin, в старых случаях Referer). Чужую страницу подделать нельзя — скрипт
// не может переписать этот заголовок. Поэтому сверяем его с адресом сервиса и
// отказываем, если не совпало.
//
// Проверяем только изменяющие запросы: чтение по GET куку не тронет.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Адрес, с которого сейчас работает сервис. */
function selfOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

function sameSite(req: NextRequest): boolean {
  const mine = selfOrigin(req);
  const origin = req.headers.get("origin");
  if (origin) return origin === mine;
  // Origin не прислан (редкость для изменяющих запросов) — пробуем Referer.
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === mine;
    } catch {
      return false;
    }
  }
  return false;
}

// ── 2. Ограничение частоты ───────────────────────────────────────────────────
//
// Считаем обращения, а не неудачи (неудачи входа считает src/lib/rate-limit.ts).
// Дорогие разделы ограничены жёстче: выгрузка вынимает из базы весь отдел,
// запросы к ИИ стоят денег у провайдера.
//
// Счётчик живёт в памяти процесса — для одного сервера этого достаточно; при
// переходе на несколько копий выносить в общее хранилище.

type Bucket = { count: number; startedAt: number };
const buckets = new Map<string, Bucket>();

type Limit = { name: string; limit: number; windowMs: number; human: string };

const LIMITS: { prefix: string; rule: Limit }[] = [
  {
    prefix: "/api/ai/",
    rule: { name: "ai", limit: 40, windowMs: 3600_000, human: "запросов к ИИ-напарнику" },
  },
  {
    prefix: "/api/export/",
    rule: { name: "export", limit: 10, windowMs: 3600_000, human: "выгрузок данных" },
  },
];

/** Общий предел на всё остальное — грубая защита от скриптов. */
const GENERAL: Limit = { name: "all", limit: 600, windowMs: 60_000, human: "обращений к сервису" };

function ruleFor(pathname: string): Limit {
  for (const l of LIMITS) if (pathname.startsWith(l.prefix)) return l.rule;
  return GENERAL;
}

function hit(key: string, rule: Limit): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (buckets.size > 2000) {
    for (const [k, b] of buckets) if (now - b.startedAt > 3600_000) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || now - b.startedAt > rule.windowMs) {
    buckets.set(key, { count: 1, startedAt: now });
    return { allowed: true, retryAfterSec: 0 };
  }
  b.count += 1;
  if (b.count > rule.limit) {
    return { allowed: false, retryAfterSec: Math.ceil((b.startedAt + rule.windowMs - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** «45 секунд», «20 минут», «2 часа» — без точки, её ставит само предложение. */
function retryPhrase(sec: number): string {
  if (sec < 90) return `${sec} секунд`;
  const min = Math.ceil(sec / 60);
  return min < 90 ? `${min} минут` : `${Math.ceil(min / 60)} часов`;
}

// ── 3. Белый список для роли «Безопасность» ──────────────────────────────────
//
// Когда сервис переедет на серверы компании, журнал, логи и доступы будут
// смотреть другие люди — ИБ и техническая эксплуатация. Для их работы
// коммерческие данные отдела не нужны, а по требованию 5.2 «каждый видит
// только то, что нужно для его работы».
//
// Список именно белый: про новый раздел легко забыть, и в чёрном списке он
// молча оказался бы доступен.

const SECURITY_ALLOWED = [
  "/leadership/audit", // журнал действий
  "/leadership/privacy", // запросы по персональным данным
  "/team", // список доступов — требование 6.3
  "/legal", // правовые документы
  "/api/privacy",
  "/api/users", // смена своего пароля
  "/api/auth",
  "/api/consent",
  "/api/notifications",
];

const SECURITY_HOME = "/leadership/audit";

function allowedForSecurity(pathname: string): boolean {
  return SECURITY_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// ── Сам заслон ───────────────────────────────────────────────────────────────

function denyJson(message: string, code: string, status: number, retryAfterSec?: number) {
  return NextResponse.json(
    { error: { code, message } },
    {
      status,
      headers: retryAfterSec ? { "Retry-After": String(retryAfterSec) } : undefined,
    },
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // Кто обратился: по возможности сотрудник, иначе адрес.
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const secret = process.env.AUTH_SECRET;
  let role: string | undefined;
  let userId: string | undefined;
  if (token && secret) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
      role = typeof payload.role === "string" ? payload.role : undefined;
      userId = typeof payload.userId === "string" ? payload.userId : undefined;
    } catch {
      // Просроченная или испорченная сессия — пусть разбирается обычный вход.
    }
  }
  const who = userId ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "аноним";

  // 1. Запрос с чужой страницы.
  if (!SAFE_METHODS.has(req.method) && !sameSite(req)) {
    return denyJson(
      "Запрос пришёл не со страницы сервиса и отклонён. Откройте сервис заново и повторите.",
      "bad_origin",
      403,
    );
  }

  // 2. Частота. Считаем только обращения к API: страницы тянут за собой
  //    десятки служебных запросов, и общий счётчик на них смысла не имеет.
  if (isApi) {
    const rule = ruleFor(pathname);
    const verdict = hit(`${rule.name}|${who}`, rule);
    if (!verdict.allowed) {
      return denyJson(
        `Слишком часто: предел — ${rule.limit} ${rule.human} за ${retryPhrase(
          Math.round(rule.windowMs / 1000),
        )}. Повторите через ${retryPhrase(verdict.retryAfterSec)}.`,
        "too_many_requests",
        429,
        verdict.retryAfterSec,
      );
    }
  }

  // 3. Роль «Безопасность» — только свои разделы.
  if (role === "Security" && !allowedForSecurity(pathname)) {
    // Запросы к API закрываем ответом, страницы — переводом на журнал:
    // иначе на экране вместо понятной страницы появился бы кусок JSON.
    if (isApi) {
      return denyJson("Роли «Безопасность» этот раздел недоступен", "forbidden", 403);
    }
    return NextResponse.redirect(new URL(SECURITY_HOME, req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Статику и картинки не трогаем — незачем проверять токен на каждый файл.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|login).*)"],
};
