import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// ─────────────────────────────────────────────────────────────────────────────
// Центральная проверка доступа для роли «Безопасность».
//
// Зачем отдельный слой. Когда сервис переедет на серверы компании, журнал,
// логи и доступы будут смотреть другие люди — ИБ и техническая эксплуатация.
// Для их работы коммерческие данные отдела не нужны, а по требованию 5.2
// «каждый видит только то, что нужно для его работы».
//
// Здесь БЕЛЫЙ список: роли «Безопасность» открыто ровно перечисленное, всё
// остальное закрыто. Чёрный список был бы опаснее — про новый раздел легко
// забыть, и он молча оказался бы доступен.
//
// Это второй рубеж, а не единственный: данные клиентов и так не отдаются,
// потому что у безопасника нет своих клиентов (см. ownScope в scope.ts).
// Проверка здесь нужна, чтобы человек не упирался в пустые экраны и не видел
// общих разделов вроде базы знаний, где лежат цены и правила работы.
// ─────────────────────────────────────────────────────────────────────────────

const COOKIE_NAME = "colizeum_session";

/** Что открыто роли «Безопасность». Сравнение — по началу пути. */
const SECURITY_ALLOWED = [
  "/leadership/audit", // журнал действий
  "/leadership/privacy", // запросы по персональным данным
  "/team", // список доступов — требование 6.3
  "/legal", // правовые документы
  "/api/privacy",
  "/api/users", // смена своего пароля
  "/api/auth",
  "/api/notifications",
];

/** Куда отправляем безопасника с закрытой страницы. */
const SECURITY_HOME = "/leadership/audit";

function allowedForSecurity(pathname: string): boolean {
  return SECURITY_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.next();

  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.next();

  let role: string | undefined;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    role = typeof payload.role === "string" ? payload.role : undefined;
  } catch {
    // Просроченная или испорченная сессия — пусть разбирается обычный вход.
    return NextResponse.next();
  }

  if (role !== "Security") return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (allowedForSecurity(pathname)) return NextResponse.next();

  // Запросы к API закрываем ответом, страницы — переводом на журнал:
  // иначе на экране вместо понятной страницы появился бы кусок JSON.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Роли «Безопасность» этот раздел недоступен" } },
      { status: 403 },
    );
  }
  return NextResponse.redirect(new URL(SECURITY_HOME, req.url));
}

export const config = {
  // Статику и картинки не трогаем — незачем проверять токен на каждый файл.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|login).*)"],
};
