import "server-only";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { isLeadership } from "@/lib/scope";

// ─────────────────────────────────────────────────────────────────────────────
// Выгрузка клиентов в Excel — «передаю дела, вот всё, что есть».
//
// Одна книга, девять листов: сводка, клиенты, сделки, контакты, оплаты,
// задачи, размещения, маркировка, документы. Смысл в том, чтобы человек,
// принимающий дела, открыл файл и увидел картину целиком, не заходя в сервис.
//
// Область видимости обычная: специалист выгружает своих клиентов, руководитель
// может выгрузить весь отдел.
// ─────────────────────────────────────────────────────────────────────────────

const BRAND = "FFFCDF3B"; // фирменный жёлтый — шапка таблиц
const INK = "FF1F1F1F";

type Column = { header: string; key: string; width: number; kind?: "money" | "date" };

/** Заводит лист с шапкой: жирная строка на фирменном фоне, фильтры, закрепление. */
function addSheet(wb: ExcelJS.Workbook, name: string, columns: Column[], rows: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: INK } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  head.alignment = { vertical: "middle", wrapText: true };
  head.height = 28;

  for (const r of rows) ws.addRow(r);

  // Формат по типу колонки: деньги — с разделителями, даты — по-русски.
  columns.forEach((c, i) => {
    if (!c.kind) return;
    const col = ws.getColumn(i + 1);
    col.numFmt = c.kind === "money" ? '# ##0 ₽' : "dd.mm.yyyy";
    if (c.kind === "money") col.alignment = { horizontal: "right" };
  });

  // Фильтры ставим только когда есть что фильтровать: на пустом листе
  // Excel показывает их как поломанные.
  if (rows.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  }
  ws.getColumn(1).font = { bold: true };
  return ws;
}

function fmtList(values: (string | null | undefined)[]): string {
  return values.filter(Boolean).join(", ");
}

/**
 * Собирает книгу Excel по клиентам в области видимости сотрудника.
 * `everyone` — выгрузить весь отдел (доступно только руководителю).
 */
export async function buildClientsWorkbook(
  session: SessionPayload,
  everyone = false,
): Promise<{ buffer: Buffer; fileName: string; clientCount: number }> {
  const wholeDepartment = everyone && isLeadership(session);
  const where = wholeDepartment ? {} : { ownerId: session.userId };

  const advertisers = await prisma.advertiser.findMany({
    where,
    include: {
      owner: { select: { name: true } },
      contacts: { orderBy: { isPrimary: "desc" } },
      deals: {
        include: {
          owner: { select: { name: true } },
          assignee: { select: { name: true } },
          ordMarkings: true,
        },
        orderBy: { updatedAt: "desc" },
      },
      tasks: { include: { assignee: { select: { name: true } }, deal: { select: { title: true } } } },
      plannedPayments: { include: { deal: { select: { title: true } } }, orderBy: { periodMonth: "asc" } },
      placements: { include: { deal: { select: { title: true } } }, orderBy: { startDate: "asc" } },
      documents: {
        include: { versions: { orderBy: { versionNo: "desc" }, take: 1 }, deal: { select: { title: true } } },
        orderBy: { type: "asc" },
      },
    },
    orderBy: [{ archived: "asc" }, { nameRu: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Colizeum Agency";
  wb.created = new Date();

  // Сводку заводим первой, чтобы книга открывалась с неё, а наполняем в конце —
  // когда посчитаны все листы. Переставлять листы местами ExcelJS не даёт.
  const summary = wb.addWorksheet("Сводка", { views: [{ state: "frozen", ySplit: 1 }] });

  // ── Клиенты ────────────────────────────────────────────────────────────────
  addSheet(
    wb,
    "Клиенты",
    [
      { header: "Клиент", key: "name", width: 30 },
      { header: "Юрлицо", key: "legal", width: 28 },
      { header: "ИНН", key: "inn", width: 14 },
      { header: "КПП", key: "kpp", width: 12 },
      { header: "Юр. адрес", key: "address", width: 34 },
      { header: "Подписант", key: "signatory", width: 22 },
      { header: "Тип", key: "type", width: 14 },
      { header: "Статус", key: "status", width: 14 },
      { header: "Ответственный", key: "owner", width: 18 },
      { header: "Основной контакт", key: "contact", width: 22 },
      { header: "Телефон", key: "phone", width: 16 },
      { header: "Почта", key: "email", width: 24 },
      { header: "Телеграм", key: "tg", width: 18 },
      { header: "Сделок", key: "deals", width: 8 },
      { header: "Сумма по договорам", key: "total", width: 18, kind: "money" },
      { header: "Стадии сделок", key: "stages", width: 30 },
      { header: "Блокеры", key: "blockers", width: 36 },
      { header: "Следующий шаг", key: "next", width: 36 },
      { header: "Цель / заметки", key: "notes", width: 36 },
    ],
    advertisers.map((a) => {
      const primary = a.contacts[0];
      const live = a.deals.filter((d) => d.stage !== "Закрытие");
      return {
        name: a.archived ? `${a.nameRu} (архив)` : a.nameRu,
        legal: a.legalEntity,
        inn: a.inn,
        kpp: a.kpp,
        address: a.address,
        signatory: a.signatory,
        type: a.type,
        status: a.status,
        owner: a.owner?.name,
        contact: primary?.fio,
        phone: primary?.phone,
        email: primary?.email,
        tg: primary?.telegram,
        deals: a.deals.length,
        total: a.deals.reduce((s, d) => s + (d.contractTotal ?? d.amount ?? 0), 0) || null,
        stages: fmtList(live.map((d) => `${d.title}: ${d.stage}`)),
        // Блокером считаем только поднятый флажок — так же, как в сводках.
        blockers: fmtList(a.deals.filter((d) => d.blockerActive).map((d) => d.blocker)),
        next: fmtList(live.map((d) => d.nextStep)),
        notes: fmtList([a.goals, a.notes]),
      };
    }),
  );

  // ── Сделки ─────────────────────────────────────────────────────────────────
  const deals = advertisers.flatMap((a) => a.deals.map((d) => ({ a, d })));
  addSheet(
    wb,
    "Сделки",
    [
      { header: "Клиент", key: "client", width: 26 },
      { header: "Сделка", key: "title", width: 34 },
      { header: "Стадия", key: "stage", width: 18 },
      { header: "Срочность", key: "urgency", width: 14 },
      { header: "Тип", key: "type", width: 14 },
      { header: "Конечный бренд", key: "brand", width: 20 },
      { header: "Сумма по договору", key: "total", width: 18, kind: "money" },
      { header: "Сумма МП", key: "amount", width: 16, kind: "money" },
      { header: "НДС", key: "vat", width: 10 },
      { header: "Договор №", key: "cnum", width: 22 },
      { header: "Дата договора", key: "cdate", width: 14, kind: "date" },
      { header: "Период", key: "period", width: 26 },
      { header: "Запуск", key: "launch", width: 14, kind: "date" },
      { header: "Условия оплаты", key: "pay", width: 26 },
      { header: "Юрист", key: "legal", width: 18 },
      { header: "Блокер", key: "blocker", width: 34 },
      { header: "Срочное / ситуативное", key: "situational", width: 34 },
      { header: "Следующий шаг", key: "next", width: 34 },
      { header: "Срок шага", key: "nextDate", width: 14, kind: "date" },
      { header: "Ответственный", key: "owner", width: 18 },
      { header: "Заметки", key: "notes", width: 40 },
    ],
    deals.map(({ a, d }) => ({
      client: a.nameRu,
      title: d.title,
      stage: d.stage,
      urgency: d.urgency,
      type: d.dealType,
      brand: d.finalBrand,
      total: d.contractTotal,
      amount: d.amount,
      vat: d.vatIncluded ? "с НДС" : "без НДС",
      cnum: d.contractNumber,
      cdate: d.contractDate,
      period: d.periodText,
      launch: d.launchDate,
      pay: d.paymentTerms,
      legal: d.legalResponsible,
      blocker: d.blockerActive ? d.blocker : null,
      situational: d.situational,
      next: d.nextStep,
      nextDate: d.nextStepDate,
      owner: d.owner?.name ?? d.assignee?.name,
      notes: d.notes,
    })),
  );

  // ── Контакты ───────────────────────────────────────────────────────────────
  addSheet(
    wb,
    "Контакты",
    [
      { header: "Клиент", key: "client", width: 26 },
      { header: "ФИО", key: "fio", width: 26 },
      { header: "Роль", key: "role", width: 24 },
      { header: "Телефон", key: "phone", width: 18 },
      { header: "Почта", key: "email", width: 28 },
      { header: "Телеграм", key: "tg", width: 20 },
      { header: "Основной", key: "primary", width: 12 },
    ],
    advertisers.flatMap((a) =>
      a.contacts.map((c) => ({
        client: a.nameRu,
        fio: c.fio,
        role: c.role,
        phone: c.phone,
        email: c.email,
        tg: c.telegram,
        primary: c.isPrimary ? "да" : "",
      })),
    ),
  );

  // ── Оплаты ─────────────────────────────────────────────────────────────────
  addSheet(
    wb,
    "Оплаты",
    [
      { header: "Клиент", key: "client", width: 26 },
      { header: "Сделка", key: "deal", width: 32 },
      { header: "Месяц", key: "month", width: 12 },
      { header: "Сумма", key: "amount", width: 16, kind: "money" },
      { header: "Статус", key: "status", width: 14 },
      { header: "Оплачено", key: "paidAt", width: 14, kind: "date" },
      { header: "Примечание", key: "note", width: 34 },
    ],
    advertisers.flatMap((a) =>
      a.plannedPayments.map((p) => ({
        client: a.nameRu,
        deal: p.deal?.title,
        month: p.periodMonth,
        amount: p.amount,
        status: p.status,
        paidAt: p.paidAt,
        note: p.note,
      })),
    ),
  );

  // ── Задачи (только незакрытые: закрытые принимающему не нужны) ─────────────
  addSheet(
    wb,
    "Задачи",
    [
      { header: "Клиент", key: "client", width: 26 },
      { header: "Сделка", key: "deal", width: 30 },
      { header: "Задача", key: "title", width: 40 },
      { header: "Тип", key: "kind", width: 14 },
      { header: "Статус", key: "status", width: 12 },
      { header: "На чьей стороне", key: "side", width: 16 },
      { header: "Срок", key: "due", width: 14, kind: "date" },
      { header: "Исполнитель", key: "assignee", width: 18 },
      { header: "Заметки", key: "notes", width: 40 },
    ],
    advertisers.flatMap((a) =>
      a.tasks
        .filter((t) => t.status !== "Готова")
        .map((t) => ({
          client: a.nameRu,
          deal: t.deal?.title,
          title: t.title,
          kind: t.kind,
          status: t.status,
          side: t.side,
          due: t.dueDate,
          assignee: t.assignee?.name,
          notes: t.notes,
        })),
    ),
  );

  // ── Размещения ─────────────────────────────────────────────────────────────
  addSheet(
    wb,
    "Размещения",
    [
      { header: "Клиент", key: "client", width: 26 },
      { header: "Сделка", key: "deal", width: 30 },
      { header: "Слот / формат", key: "slot", width: 34 },
      { header: "Начало", key: "start", width: 14, kind: "date" },
      { header: "Конец", key: "end", width: 14, kind: "date" },
      { header: "Статус", key: "status", width: 16 },
      { header: "Ответственный", key: "resp", width: 20 },
      { header: "Заметки", key: "notes", width: 34 },
    ],
    advertisers.flatMap((a) =>
      a.placements.map((p) => ({
        client: a.nameRu,
        deal: p.deal?.title,
        slot: p.slot,
        start: p.startDate,
        end: p.endDate,
        status: p.status,
        resp: p.responsible,
        notes: p.notes,
      })),
    ),
  );

  // ── Маркировка ОРД ─────────────────────────────────────────────────────────
  addSheet(
    wb,
    "Маркировка ОРД",
    [
      { header: "Клиент", key: "client", width: 26 },
      { header: "Сделка", key: "deal", width: 30 },
      { header: "ЕРИД", key: "erid", width: 26 },
      { header: "Роль", key: "role", width: 20 },
      { header: "Площадка", key: "platform", width: 20 },
      { header: "Статус", key: "status", width: 14 },
      { header: "Размещение с", key: "from", width: 14, kind: "date" },
      { header: "по", key: "to", width: 14, kind: "date" },
      { header: "Истекает", key: "expires", width: 14, kind: "date" },
      { header: "Срочно", key: "urgent", width: 10 },
    ],
    advertisers.flatMap((a) =>
      a.deals.flatMap((d) =>
        d.ordMarkings.map((o) => ({
          client: a.nameRu,
          deal: d.title,
          erid: o.erid,
          role: o.role,
          platform: o.platform,
          status: o.status,
          from: o.placementStart,
          to: o.placementEnd,
          expires: o.expiresAt,
          urgent: o.urgent ? "да" : "",
        })),
      ),
    ),
  );

  // ── Документы ──────────────────────────────────────────────────────────────
  addSheet(
    wb,
    "Документы",
    [
      { header: "Клиент", key: "client", width: 26 },
      { header: "Сделка", key: "deal", width: 30 },
      { header: "Раздел", key: "type", width: 24 },
      { header: "Название", key: "title", width: 40 },
      { header: "Версия", key: "version", width: 10 },
      { header: "Файл", key: "file", width: 34 },
      { header: "Загружен", key: "at", width: 14, kind: "date" },
    ],
    advertisers.flatMap((a) =>
      a.documents.map((doc) => ({
        client: a.nameRu,
        deal: doc.deal?.title,
        type: doc.type,
        title: doc.title,
        version: doc.versions[0]?.versionNo,
        file: doc.versions[0]?.fileName,
        at: doc.versions[0]?.createdAt,
      })),
    ),
  );

  // ── Сводка (лист заведён в начале, наполняем сейчас) ───────────────────────
  const openTasks = advertisers.flatMap((a) => a.tasks.filter((t) => t.status !== "Готова"));
  const unpaid = advertisers.flatMap((a) => a.plannedPayments.filter((p) => p.status !== "Оплачено"));
  const blocked = deals.filter(({ d }) => d.blockerActive);

  summary.columns = [
    { header: "Показатель", key: "k", width: 40 },
    { header: "Значение", key: "v", width: 46 },
  ];
  const sHead = summary.getRow(1);
  sHead.font = { bold: true, color: { argb: INK } };
  sHead.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  sHead.height = 24;

  const rows: [string, string | number][] = [
    ["Выгрузку сделал", session.name],
    ["Дата выгрузки", new Date().toLocaleString("ru-RU")],
    ["Охват", wholeDepartment ? "весь отдел" : `клиенты сотрудника ${session.name}`],
    ["Клиентов", advertisers.length],
    ["из них в архиве", advertisers.filter((a) => a.archived).length],
    ["Сделок", deals.length],
    ["Сделок в работе", deals.filter(({ d }) => d.stage !== "Закрытие").length],
    ["Сделок с поднятым блокером", blocked.length],
    ["Сумма по договорам", deals.reduce((s, { d }) => s + (d.contractTotal ?? d.amount ?? 0), 0)],
    ["Открытых задач", openTasks.length],
    ["из них просроченных", openTasks.filter((t) => t.dueDate && t.dueDate < new Date()).length],
    ["Неоплаченных платежей", unpaid.length],
    ["Сумма неоплаченного", unpaid.reduce((s, p) => s + p.amount, 0)],
  ];
  // Денежные строки помечаем по названию показателя, а не по номеру: список
  // строк ещё будет меняться, и номера разъедутся незаметно.
  for (const [k, v] of rows) {
    const row = summary.addRow({ k, v });
    if (k.startsWith("Сумма")) row.getCell(2).numFmt = '# ##0 ₽';
  }
  summary.getColumn(1).font = { bold: true };

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const stamp = new Date().toISOString().slice(0, 10);
  const who = wholeDepartment ? "отдел" : session.name.split(" ")[0];
  return { buffer, fileName: `Клиенты Colizeum — ${who} — ${stamp}.xlsx`, clientCount: advertisers.length };
}
