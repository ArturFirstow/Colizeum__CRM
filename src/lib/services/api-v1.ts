import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkApiKey, type ApiScope } from "@/lib/services/api-keys";
import { logTransfer } from "@/lib/services/transfers";
import { writeAudit, clientIp } from "@/lib/audit";

// ─────────────────────────────────────────────────────────────────────────────
// Публичный контур чтения — /api/v1 (требование Влада 9.1).
//
// Отличается от внутреннего API сервиса тремя вещами, и каждая здесь по делу:
//
//  1. ВЕРСИЯ в адресе. Внутренний фронтенд правится вместе с сервером, и ломать
//     его можно хоть каждый день. У коннектора Aspro свой график обновлений:
//     меняется формат — выпускается /api/v2, а /api/v1 продолжает отвечать,
//     пока коннектор не переедет.
//
//  2. ПОСТРАНИЧНО через «курсор», а не через «страница №3». Нумерованные
//     страницы ломаются, когда во время перебора кто-то добавил запись: часть
//     строк показывается дважды, часть пропускается. Курсор — это «продолжи с
//     вот этой записи», и такого не случается.
//
//  3. ОТБОР ПО ДАТЕ ИЗМЕНЕНИЯ (updatedSince). Коннектор не перекачивает всё
//     каждый раз: он спрашивает «что поменялось с прошлой синхронизации».
//     Поэтому сортировка идёт по updatedAt по возрастанию — порядок устойчив,
//     и синхронизацию можно продолжить с того места, где прервались.
//
// Чего здесь намеренно НЕТ: записи. Задание говорит «передача из Colizeum
// Agency в Aspro.Cloud, обратная синхронизация не требуется» — значит контур
// только на чтение, и это снимает целый класс рисков.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export type ApiError = { code: string; message: string };

function apiFail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Что отдаём наружу: только эти поля, и ни полем больше. */
export type Shape<T> = (row: T) => Record<string, unknown>;

type ListArgs = {
  where?: Record<string, unknown>;
  orderBy: { updatedAt: "asc" }[];
  take: number;
  skip?: number;
  cursor?: { id: string };
};

/**
 * Общая обвязка на все сущности: проверка ключа, разбор параметров, выборка,
 * ответ и запись в журналы. Каждый новый раздел — три строки в своём route.ts,
 * а правила одни на всех и правятся в одном месте.
 */
export async function serveList<T extends { id: string; updatedAt: Date }>(
  req: NextRequest,
  opts: {
    scope: ApiScope;
    /** Человеческое название для журнала передач. */
    title: string;
    /** Категории данных, которые уходят — для журнала передач (без значений). */
    dataKinds: string[];
    find: (args: ListArgs) => Promise<T[]>;
    count: (where: Record<string, unknown> | undefined) => Promise<number>;
    shape: Shape<T>;
  },
): Promise<NextResponse> {
  const check = await checkApiKey(req.headers.get("authorization"));
  if (!check.ok) {
    writeAudit({
      action: "api.denied",
      userName: "служебный ключ",
      entityType: "api",
      entityId: opts.scope,
      changedFields: [check.reason],
      ip: clientIp(req),
      ok: false,
    });
    return apiFail("unauthorized", check.reason, 401);
  }
  if (!check.scopes.includes(opts.scope)) {
    writeAudit({
      action: "api.denied",
      userName: `ключ «${check.name}»`,
      entityType: "api",
      entityId: opts.scope,
      changedFields: ["раздел не входит в разрешения ключа"],
      ip: clientIp(req),
      ok: false,
    });
    return apiFail("forbidden", `Этому ключу раздел «${opts.scope}» не открыт`, 403);
  }

  const sp = req.nextUrl.searchParams;

  const limitRaw = Number(sp.get("limit") ?? DEFAULT_LIMIT);
  if (!Number.isFinite(limitRaw) || limitRaw < 1) {
    return apiFail("bad_request", "limit должен быть числом больше нуля", 400);
  }
  const limit = Math.min(Math.floor(limitRaw), MAX_LIMIT);

  const where: Record<string, unknown> = {};
  const since = sp.get("updatedSince");
  if (since) {
    const d = new Date(since);
    if (Number.isNaN(d.getTime())) {
      return apiFail("bad_request", "updatedSince должен быть датой, например 2026-10-01 или 2026-10-01T12:00:00Z", 400);
    }
    where.updatedAt = { gt: d };
  }
  // Передаются не все записи, а помеченные к передаче — так решено в схеме
  // (syncEnabled). Параметр all=1 снимает отбор: нужен на первой выгрузке и
  // при разборе расхождений.
  if (sp.get("all") !== "1") where.syncEnabled = true;

  const cursor = sp.get("cursor");
  const rows = await opts.find({
    where: Object.keys(where).length ? where : undefined,
    orderBy: [{ updatedAt: "asc" }],
    take: limit + 1, // +1 — чтобы понять, есть ли ещё, не делая второй запрос
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const total = await opts.count(Object.keys(where).length ? where : undefined);

  // Данные ушли во внешнюю систему — это передача, и она записывается
  // (требование 4.12). В журнал идут категории и количество, не содержимое.
  if (page.length > 0) {
    logTransfer("api", {
      userName: `ключ «${check.name}»`,
      purpose: `Выгрузка раздела «${opts.title}» по API`,
      dataKinds: [...opts.dataKinds, `записей отдано: ${page.length}`],
    });
  }
  writeAudit({
    action: "api.read",
    userName: `ключ «${check.name}»`,
    entityType: "api",
    entityId: opts.scope,
    changedFields: [`отдано: ${page.length}`, since ? `с ${since}` : "без отбора по дате"],
    ip: clientIp(req),
  });

  return NextResponse.json(
    {
      data: page.map(opts.shape),
      // nextCursor передаётся в следующий запрос как ?cursor=…
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      hasMore,
      total,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Дата в ответ всегда в одном виде — ISO, иначе на стороне коннектора каша. */
export function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export { prisma };
