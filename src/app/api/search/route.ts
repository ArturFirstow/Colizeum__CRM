import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { ownScope } from "@/lib/scope";

// ─────────────────────────────────────────────────────────────────────────────
// Общий поиск по сервису — то, что открывается по Ctrl + K.
//
// ЗАЧЕМ. Менеджер за день открывает карточку клиента десятки раз, и каждый раз
// шёл одним путём: меню → раздел → список → поиск внутри раздела. Теперь любой
// объект достаётся из любого места по первым буквам.
//
// ⚠️ Отбор идёт В ПАМЯТИ, а не запросом в базу. У SQLite `contains`
// регистрозависим для кириллицы: «алабуга» не находит «Алабуга». На этом уже
// обжигались в поиске по базе знаний (search_knowledge) — здесь то же решение.
// Объёмы отдела это выдерживает: берём ограниченные выборки и фильтруем.
//
// ⚠️ Видимость обычная: `ownScope` — свои клиенты (и клиенты связки
// руководитель-менеджер). Чужого поиск не покажет, как и списки разделов.
// ─────────────────────────────────────────────────────────────────────────────

export type SearchHit = {
  kind: "client" | "deal" | "document" | "task" | "lead";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

/** Регистр и «ё» в сторону — сравниваем по одинаковым правилам. */
function norm(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").trim();
}

export async function GET(req: NextRequest) {
  return withSession(async (session) => {
    const q = norm(req.nextUrl.searchParams.get("q") ?? "");
    if (q.length < 2) return ok<SearchHit[]>([]);

    const mine = ownScope(session);
    const [advertisers, deals, documents, tasks, leads] = await Promise.all([
      prisma.advertiser.findMany({
        where: mine,
        select: { id: true, nameRu: true, nameEn: true, legalEntity: true, inn: true, type: true, archived: true },
        take: 400,
      }),
      prisma.deal.findMany({
        where: { advertiser: mine },
        select: {
          id: true,
          title: true,
          stage: true,
          contractNumber: true,
          advertiser: { select: { nameRu: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 400,
      }),
      prisma.document.findMany({
        where: { advertiser: mine },
        select: {
          id: true,
          title: true,
          type: true,
          advertiserId: true,
          advertiser: { select: { nameRu: true } },
        },
        take: 600,
      }),
      prisma.task.findMany({
        where: { ...ownScope(session), status: { not: "Готова" } },
        select: {
          id: true,
          title: true,
          status: true,
          advertiser: { select: { nameRu: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 400,
      }),
      prisma.lead.findMany({
        select: { id: true, name: true, company: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

    const hits: SearchHit[] = [];
    const hit = (h: SearchHit) => hits.push(h);

    for (const a of advertisers) {
      if (norm(`${a.nameRu} ${a.nameEn ?? ""} ${a.legalEntity ?? ""} ${a.inn ?? ""}`).includes(q)) {
        hit({
          kind: "client",
          id: a.id,
          title: a.nameRu,
          subtitle: a.archived ? `${a.type} · в архиве` : a.type,
          href: `/advertisers/${a.id}`,
        });
      }
    }
    for (const d of deals) {
      if (norm(`${d.title} ${d.advertiser.nameRu} ${d.contractNumber ?? ""}`).includes(q)) {
        hit({
          kind: "deal",
          id: d.id,
          title: d.title,
          subtitle: `${d.advertiser.nameRu} · ${d.stage}`,
          href: `/deals/${d.id}`,
        });
      }
    }
    for (const doc of documents) {
      if (norm(`${doc.title} ${doc.type} ${doc.advertiser.nameRu}`).includes(q)) {
        hit({
          kind: "document",
          id: doc.id,
          title: doc.title,
          subtitle: `${doc.type} · ${doc.advertiser.nameRu}`,
          href: `/documents?advertiser=${doc.advertiserId}`,
        });
      }
    }
    for (const t of tasks) {
      if (norm(`${t.title} ${t.advertiser?.nameRu ?? ""}`).includes(q)) {
        hit({
          kind: "task",
          id: t.id,
          title: t.title,
          subtitle: `${t.advertiser?.nameRu ?? "без клиента"} · ${t.status}`,
          href: "/tasks",
        });
      }
    }
    for (const l of leads) {
      if (norm(`${l.name ?? ""} ${l.company ?? ""}`).includes(q)) {
        hit({
          kind: "lead",
          id: l.id,
          title: l.company || l.name || "Заявка",
          subtitle: `заявка с сайта · ${l.status}`,
          href: "/leads",
        });
      }
    }

    // Точное совпадение с начала названия важнее совпадения в середине.
    const score = (h: SearchHit) => (norm(h.title).startsWith(q) ? 0 : 1);
    hits.sort((a, b) => score(a) - score(b));

    return ok(hits.slice(0, 24));
  });
}
