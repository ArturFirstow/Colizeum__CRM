import "server-only";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import type { AiTool } from "@/lib/ai";
import type { SessionPayload } from "@/lib/auth";
import { ownScope } from "@/lib/scope";

// ─────────────────────────────────────────────────────────────────────────────
// Инструменты напарника ИИ. Делятся на две группы:
//   • читающие  — посмотреть портфель, клиента, базу знаний, «корзину входящих»;
//   • пишущие   — разложить файл по разделам, поставить задачу, записать
//                 статус дня, отправить вопрос руководителю.
// Всё работает строго в области видимости сотрудника (ownScope): чужих
// клиентов ассистент не видит и не трогает.
// ─────────────────────────────────────────────────────────────────────────────

export const aiTools: AiTool[] = [
  {
    name: "list_my_clients",
    description: "Список клиентов сотрудника с краткой сводкой (стадия сделок, блокер, следующий шаг). Вызывай, чтобы увидеть портфель или найти нужного клиента.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_client",
    description: "Подробности по одному клиенту: сделки (сумма, стадия, блокер, платежи), статусы дня за месяц, открытые задачи, приложенные файлы.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "Имя клиента или его часть" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "search_knowledge",
    description: "Поиск по базе знаний агентства (регламенты, документооборот, форматы, цены, правила).",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Ключевые слова" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_inbox_files",
    description:
      "Файлы, которые сотрудник закинул в чат и которые ещё не разложены по разделам. Вызывай ВСЕГДА, когда сотрудник говорит про приложенный файл, счёт, макет, медиаплан или документ.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "route_file",
    description:
      "Разложить файл из «входящих» в нужное место сервиса: к клиенту или в сделку, с указанием типа (Счёт, Медиаплан, Креатив, Документ, Акт). После этого файл виден в карточке сделки и в «Документах» клиента.",
    input_schema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "id файла из list_inbox_files" },
        clientName: { type: "string", description: "Клиент, к которому относится файл" },
        dealTitle: { type: "string", description: "Название сделки, если файл относится к конкретной сделке" },
        kind: {
          type: "string",
          enum: ["Счёт", "Медиаплан", "Креатив", "Документ", "Акт", "Прочее"],
          description: "Что это за файл",
        },
      },
      required: ["fileId", "clientName", "kind"],
      additionalProperties: false,
    },
  },
  {
    name: "create_task",
    description: "Поставить задачу в трекер сотрудника. Используй, когда из письма, счёта или разговора следует конкретное действие со сроком.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Что нужно сделать" },
        clientName: { type: "string", description: "Клиент, если задача по нему" },
        dueDate: { type: "string", description: "Срок в формате ГГГГ-ММ-ДД" },
        kind: { type: "string", description: "Юрист | Дизайн | Менеджер | Финансы | Прочее" },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "add_daily_status",
    description: "Записать статус дня по клиенту — короткую строку о том, что происходит по проекту сегодня.",
    input_schema: {
      type: "object",
      properties: {
        clientName: { type: "string", description: "Клиент" },
        text: { type: "string", description: "Что по проекту за сегодня" },
      },
      required: ["clientName", "text"],
      additionalProperties: false,
    },
  },
  {
    name: "add_journal_entry",
    description: "Сохранить в дневник расшифровку встречи или заметку, чтобы договорённости не потерялись.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Текст записи или краткое резюме встречи" },
        meetingWith: { type: "string", description: "С кем была встреча" },
        clientName: { type: "string", description: "Клиент, если встреча по нему" },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "ask_leader",
    description: "Отправить вопрос руководителю — когда решение вне полномочий сотрудника (согласовать скидку, выдать доступ, утвердить макет).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Что нужно решить" },
        details: { type: "string", description: "Подробности и срок" },
        kind: { type: "string", enum: ["Согласование", "Доступ", "Деньги", "Другое"] },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
];

/** Исполнитель инструментов для конкретного сотрудника. */
export function makeRunTool(session: SessionPayload) {
  const scope = ownScope(session);

  async function findClient(name: string) {
    const q = String(name ?? "").trim();
    if (!q) return null;
    return prisma.advertiser.findFirst({ where: { ...scope, nameRu: { contains: q } } });
  }

  return async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
    // ── Чтение ───────────────────────────────────────────────────────────────
    if (name === "list_my_clients") {
      const advs = await prisma.advertiser.findMany({
        where: { ...scope, archived: false },
        include: { deals: { select: { title: true, stage: true, amount: true, blocker: true, nextStep: true } } },
        orderBy: { nameRu: "asc" },
      });
      if (advs.length === 0) return "У сотрудника нет активных клиентов.";
      return advs
        .map((a) => {
          const deals = a.deals
            .map((d) => `«${d.title}» — ${d.stage}${d.amount ? `, ${formatMoney(d.amount)}` : ""}${d.blocker ? `, блокер: ${d.blocker}` : ""}`)
            .join("; ");
          return `- ${a.nameRu}${deals ? `: ${deals}` : " (без сделок)"}`;
        })
        .join("\n");
    }

    if (name === "get_client") {
      const a = await findClient(String(input.name ?? ""));
      if (!a) return `Клиент «${input.name}» не найден среди клиентов сотрудника.`;
      const [deals, statuses, tasks, files] = await Promise.all([
        prisma.deal.findMany({ where: { advertiserId: a.id }, include: { plannedPayments: true } }),
        prisma.dailyStatus.findMany({
          where: { advertiserId: a.id, date: { gte: new Date(Date.now() - 35 * 86400000) } },
          orderBy: { date: "asc" },
        }),
        prisma.task.findMany({ where: { advertiserId: a.id, status: { not: "Готова" } }, orderBy: { dueDate: "asc" } }),
        prisma.fileAsset.findMany({ where: { advertiserId: a.id }, orderBy: { uploadedAt: "desc" }, take: 20 }),
      ]);
      const out: string[] = [`Клиент: ${a.nameRu}${a.legalEntity ? ` (${a.legalEntity})` : ""}`];
      if (a.goals) out.push(`Цель: ${a.goals}`);
      for (const d of deals) {
        out.push(
          `Сделка «${d.title}»: стадия ${d.stage}` +
            `${d.contractTotal || d.amount ? `, сумма ${formatMoney(d.contractTotal || d.amount)}` : ""}` +
            `${d.blocker ? `; блокер: ${d.blocker}` : ""}${d.nextStep ? `; следующий шаг: ${d.nextStep}` : ""}`,
        );
        for (const p of d.plannedPayments) out.push(`  платёж ${p.periodMonth}: ${formatMoney(p.amount)} — ${p.status}`);
      }
      out.push(`Статусы дня: ${statuses.map((s) => `${s.date.toISOString().slice(0, 10)} — ${s.text}`).join(" | ") || "нет"}`);
      out.push(`Открытые задачи: ${tasks.map((t) => t.title + (t.dueDate ? ` (до ${t.dueDate.toISOString().slice(0, 10)})` : "")).join("; ") || "нет"}`);
      out.push(`Файлы: ${files.map((f) => `${f.title} [${f.kind}]`).join("; ") || "нет"}`);
      return out.join("\n");
    }

    if (name === "search_knowledge") {
      const q = String(input.query ?? "").trim();
      const arts = await prisma.knowledgeArticle.findMany({
        where: q ? { OR: [{ title: { contains: q } }, { bodyMarkdown: { contains: q } }] } : {},
        take: 5,
      });
      if (arts.length === 0) return `По запросу «${q}» в базе знаний ничего не найдено.`;
      return arts.map((a) => `### ${a.title}\n${a.bodyMarkdown.slice(0, 1200)}`).join("\n\n");
    }

    if (name === "list_inbox_files") {
      const files = await prisma.fileAsset.findMany({
        where: { ownerType: "inbox", ownerId: session.userId },
        orderBy: { uploadedAt: "desc" },
      });
      if (files.length === 0) return "Во «входящих» файлов нет — сотрудник ничего не прикреплял.";
      return files
        .map((f) => `- id=${f.id} · «${f.fileName}» · ${Math.round(f.sizeBytes / 1024)} КБ · тип ${f.contentType ?? "неизвестен"}`)
        .join("\n");
    }

    // ── Запись ───────────────────────────────────────────────────────────────
    if (name === "route_file") {
      const fileId = String(input.fileId ?? "");
      const file = await prisma.fileAsset.findFirst({ where: { id: fileId, ownerId: session.userId, ownerType: "inbox" } });
      if (!file) return "Файл не найден во «входящих» этого сотрудника.";
      const a = await findClient(String(input.clientName ?? ""));
      if (!a) return `Клиент «${input.clientName}» не найден — уточни название у сотрудника.`;

      let dealId: string | null = null;
      const dealTitle = String(input.dealTitle ?? "").trim();
      if (dealTitle) {
        const d = await prisma.deal.findFirst({ where: { advertiserId: a.id, title: { contains: dealTitle } } });
        dealId = d?.id ?? null;
      }

      await prisma.fileAsset.update({
        where: { id: file.id },
        data: {
          ownerType: dealId ? "deal" : "advertiser",
          ownerId: dealId ?? a.id,
          kind: String(input.kind ?? "Прочее"),
          advertiserId: a.id,
          dealId,
        },
      });
      return `Файл «${file.fileName}» разложен: клиент ${a.nameRu}${dealId ? `, сделка «${dealTitle}»` : ""}, тип ${input.kind}. Он уже виден в карточке и в «Документах».`;
    }

    if (name === "create_task") {
      const a = input.clientName ? await findClient(String(input.clientName)) : null;
      const due = String(input.dueDate ?? "").trim();
      const task = await prisma.task.create({
        data: {
          title: String(input.title ?? "").trim(),
          kind: String(input.kind ?? "Менеджер"),
          status: "Открыта",
          ownerId: session.userId,
          assigneeId: session.userId,
          advertiserId: a?.id ?? null,
          dueDate: due ? new Date(due) : null,
        },
      });
      return `Задача создана: «${task.title}»${a ? ` (клиент ${a.nameRu})` : ""}${due ? `, срок ${due}` : ""}.`;
    }

    if (name === "add_daily_status") {
      const a = await findClient(String(input.clientName ?? ""));
      if (!a) return `Клиент «${input.clientName}» не найден.`;
      await prisma.dailyStatus.create({
        data: { advertiserId: a.id, text: String(input.text ?? "").trim(), authorId: session.userId },
      });
      return `Статус дня записан по клиенту ${a.nameRu}.`;
    }

    if (name === "add_journal_entry") {
      const a = input.clientName ? await findClient(String(input.clientName)) : null;
      await prisma.journalEntry.create({
        data: {
          source: input.meetingWith ? "Транскрипт" : "EOD",
          rawText: String(input.text ?? "").trim(),
          meetingWith: input.meetingWith ? String(input.meetingWith) : null,
          advertiserId: a?.id ?? null,
          ownerId: session.userId,
          routedTo: "Трекер",
        },
      });
      return `Запись сохранена в дневник${input.meetingWith ? ` (встреча с ${input.meetingWith})` : ""}.`;
    }

    if (name === "ask_leader") {
      const r = await prisma.decisionRequest.create({
        data: {
          title: String(input.title ?? "").trim(),
          details: input.details ? String(input.details) : null,
          kind: String(input.kind ?? "Согласование"),
          requesterId: session.userId,
        },
      });
      return `Вопрос отправлен руководителю: «${r.title}». Он увидит его в блоке «Решения, которые ждут вас».`;
    }

    return `Неизвестный инструмент: ${name}`;
  };
}
