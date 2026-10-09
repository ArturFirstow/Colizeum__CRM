import "server-only";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Права человека на свои данные (требования 4.7 и 5.8).
//
// Закон даёт человеку право узнать, какие данные о нём есть, и потребовать их
// удалить. Ответить надо за 10 рабочих дней. Руками это означало бы обход всех
// разделов сервиса — здесь поиск идёт по всем таблицам, где вообще могут
// лежать данные о людях.
//
// Поиск в памяти, а не запросом в базу: SQLite сравнивает кириллицу с учётом
// регистра, и «иванов» не находил бы «Иванов». Объёмы маленькие (сотни
// записей), поэтому это безопасно.
//
// Удаление устроено по-разному и намеренно:
//   • контакт клиента и человек из справочника — удаляются целиком;
//   • заявка с сайта — обезличивается: сама заявка остаётся как факт
//     обращения, но имя, контакт и текст затираются;
//   • сотрудник — НЕ удаляется: его данные нужны для трудовых отношений,
//     это другое основание обработки;
//   • журнал действий — НЕ чистится: его хранение требует закон.
// Последние два случая объясняются человеку, а не делаются молча.
// ─────────────────────────────────────────────────────────────────────────────

export type FoundRecord = {
  id: string;
  /** Где нашли — человеческим языком. */
  where: string;
  /** Что это за запись. */
  title: string;
  /** Какие именно данные о человеке там лежат. */
  fields: string[];
  /** Можно ли удалить по запросу и что именно произойдёт. */
  erase: "delete" | "anonymize" | "keep";
  /** Почему нельзя удалить, если нельзя. */
  keepReason?: string;
};

export type PersonSearchResult = {
  query: string;
  groups: { kind: string; label: string; records: FoundRecord[] }[];
  total: number;
};

function hit(haystack: (string | null | undefined)[], needle: string): boolean {
  const q = needle.trim().toLowerCase().replace(/ё/g, "е");
  if (!q) return false;
  return haystack.some((v) => v && v.toLowerCase().replace(/ё/g, "е").includes(q));
}

/** Ищет человека во всех таблицах, где могут быть его данные. */
export async function findPersonData(query: string): Promise<PersonSearchResult> {
  const q = query.trim();
  if (q.length < 3) return { query: q, groups: [], total: 0 };

  const [contacts, people, leads, users, journal, requests] = await Promise.all([
    prisma.contact.findMany({ include: { advertiser: { select: { nameRu: true } } } }),
    prisma.person.findMany(),
    prisma.lead.findMany(),
    prisma.user.findMany({ select: { id: true, name: true, email: true, telegramChatId: true, role: true } }),
    prisma.journalEntry.findMany({ where: { meetingWith: { not: null } }, select: { id: true, meetingWith: true, date: true } }),
    // Запросы юристу и на размещение: в тексте стоит подписант со стороны
    // клиента, то есть живой человек. Поэтому они тоже попадают в поиск.
    prisma.requestRecord.findMany({
      select: { id: true, kind: true, body: true, createdAt: true, advertiser: { select: { nameRu: true } } },
    }),
  ]);

  const groups: PersonSearchResult["groups"] = [];

  const c = contacts
    .filter((x) => hit([x.fio, x.email, x.phone, x.telegram], q))
    .map<FoundRecord>((x) => ({
      id: x.id,
      where: `Контакты клиента «${x.advertiser.nameRu}»`,
      title: x.fio,
      fields: [
        x.role ? `должность: ${x.role}` : null,
        x.phone ? "телефон" : null,
        x.email ? "почта" : null,
        x.telegram ? "телеграм" : null,
      ].filter(Boolean) as string[],
      erase: "delete",
    }));
  if (c.length) groups.push({ kind: "contact", label: "Контактные лица клиентов", records: c });

  const p = people
    .filter((x) => hit([x.name, x.email, x.telegram], q))
    .map<FoundRecord>((x) => ({
      id: x.id,
      where: "Справочник «кто за что отвечает»",
      title: `${x.name} — ${x.role}`,
      fields: [x.email ? "почта" : null, x.telegram ? "телеграм" : null].filter(Boolean) as string[],
      erase: "delete",
    }));
  if (p.length) groups.push({ kind: "person", label: "Справочник ролей", records: p });

  const l = leads
    .filter((x) => hit([x.name, x.company, x.contact, x.message], q))
    .map<FoundRecord>((x) => ({
      id: x.id,
      where: "Заявки с сайта",
      title: `${x.name ?? "без имени"}${x.company ? ` · ${x.company}` : ""}`,
      fields: ["имя", x.contact ? "контакт" : null, x.message ? "текст обращения" : null].filter(
        Boolean,
      ) as string[],
      erase: "anonymize",
    }));
  if (l.length) groups.push({ kind: "lead", label: "Обращения с сайта", records: l });

  const u = users
    .filter((x) => hit([x.name, x.email], q))
    .map<FoundRecord>((x) => ({
      id: x.id,
      where: "Сотрудники сервиса",
      title: `${x.name} (${x.email})`,
      fields: ["имя", "служебная почта", x.telegramChatId ? "телеграм" : null].filter(Boolean) as string[],
      erase: "keep",
      keepReason:
        "Данные работника обрабатываются для трудовых отношений — это другое основание, " +
        "и удаление по запросу к нему не применяется. Доступ отключается на странице «Команда».",
    }));
  if (u.length) groups.push({ kind: "user", label: "Сотрудники", records: u });

  const j = journal
    .filter((x) => hit([x.meetingWith], q))
    .map<FoundRecord>((x) => ({
      id: x.id,
      where: "Дневник — участники встреч",
      title: `Встреча ${x.date.toLocaleDateString("ru-RU")}: ${x.meetingWith}`,
      fields: ["имя участника встречи"],
      erase: "anonymize",
    }));
  if (j.length) groups.push({ kind: "journal", label: "Записи встреч", records: j });

  const r = requests
    .filter((x) => hit([x.body], q))
    .map<FoundRecord>((x) => ({
      id: x.id,
      where: `Запросы по клиенту «${x.advertiser.nameRu}»`,
      title: `${x.kind}, ${x.createdAt.toLocaleDateString("ru-RU")}`,
      fields: ["имя в тексте запроса"],
      erase: "delete",
    }));
  if (r.length) groups.push({ kind: "request", label: "Запросы юристу и на размещение", records: r });

  return { query: q, groups, total: groups.reduce((s, g) => s + g.records.length, 0) };
}

export type EraseResult = { deleted: number; anonymized: number; kept: number };

/** Удаляет или обезличивает найденные записи. Сотрудников и журнал не трогает. */
export async function erasePersonData(
  items: { kind: string; id: string }[],
): Promise<EraseResult> {
  let deleted = 0;
  let anonymized = 0;
  let kept = 0;
  const MARK = "удалено по запросу субъекта";

  for (const it of items) {
    switch (it.kind) {
      case "contact":
        await prisma.contact.delete({ where: { id: it.id } }).catch(() => {});
        deleted++;
        break;
      case "person":
        await prisma.person.delete({ where: { id: it.id } }).catch(() => {});
        deleted++;
        break;
      case "lead":
        // Саму заявку оставляем: факт обращения — наша отчётность. Стираем
        // только то, по чему человека можно опознать.
        await prisma.lead
          .update({ where: { id: it.id }, data: { name: MARK, contact: null, message: null, company: null } })
          .catch(() => {});
        anonymized++;
        break;
      case "request":
        // Текст запроса — рабочий черновик письма, его можно удалить целиком:
        // сама сделка и её документы от этого не страдают.
        await prisma.requestRecord.delete({ where: { id: it.id } }).catch(() => {});
        deleted++;
        break;
      case "journal":
        await prisma.journalEntry
          .update({ where: { id: it.id }, data: { meetingWith: MARK } })
          .catch(() => {});
        anonymized++;
        break;
      default:
        // Сотрудники и журнал действий сюда не попадают намеренно.
        kept++;
    }
  }
  return { deleted, anonymized, kept };
}
