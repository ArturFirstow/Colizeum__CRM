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

// ── Поиск по базе знаний ─────────────────────────────────────────────────────
// Приводим текст к единому виду: без регистра и без «ё», чтобы «Цены», «ЦЕНЫ»
// и «цены» считались одним словом.
function normalizeRu(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

const STOP_WORDS = new Set([
  "как", "что", "где", "для", "это", "или", "при", "чем", "кто", "какой", "какие",
  "на", "по", "из", "от", "до", "за", "не", "ли", "мы", "их", "его", "нас", "все",
]);

/** Отрезаем окончание: «скидки» и «скидка» должны находить одну и ту же статью.
 *  Короткие слова (ЕРИД, ОРД, ДС, УПД) не трогаем — от них останется огрызок,
 *  который начнёт совпадать с чем попало. */
function stem(w: string): string | null {
  return w.length >= 6 ? w.slice(0, 5) : null;
}

function searchWords(query: string): { word: string; stem: string | null }[] {
  return normalizeRu(query)
    .split(/[^a-zа-я0-9]+/i)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w))
    .map((w) => ({ word: w, stem: stem(w) }));
}

/** Совпадение целым словом ценится выше, чем совпадение по огрызку. */
function scoreText(text: string, words: { word: string; stem: string | null }[], weight: number): number {
  return words.reduce((acc, w) => {
    if (text.includes(w.word)) return acc + weight * 2;
    if (w.stem && text.includes(w.stem)) return acc + weight;
    return acc;
  }, 0);
}

/** Оглавление базы знаний — отдаём, когда точных совпадений нет. */
function knowledgeToc(
  arts: { title: string; category: string }[],
  files: { title: string }[],
): string {
  if (arts.length === 0) return "База знаний пока пустая.";
  const byCategory = new Map<string, string[]>();
  for (const a of arts) byCategory.set(a.category, [...(byCategory.get(a.category) ?? []), a.title]);
  const out = [...byCategory.entries()].map(([cat, titles]) => `**${cat}**: ${titles.join("; ")}`);
  if (files.length > 0) out.push(`**Файлы и шаблоны**: ${files.map((f) => f.title).join("; ")}`);
  return out.join("\n");
}

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
    description:
      "Единственный источник правды о том, как устроено агентство: цены и пакеты, конструкции договоров, форматы размещения, ОРД, промокоды, реквизиты, глоссарий, шаблоны документов. " +
      "Вызывай ВСЕГДА, когда вопрос про порядок работы, документы, цены или условия — не отвечай по памяти.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Ключевые слова, 1–3 слова" } },
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
        kind: {
          type: "string",
          enum: ["Юрист", "Дизайн", "Менеджер", "Бухгалтерия", "ОРД", "Прочее"],
          description: "Кто это делает. По умолчанию Менеджер",
        },
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

/** Человеческое описание вызова инструмента — показываем сотруднику под ответом,
 *  чтобы было видно, смотрел напарник в данные сервиса или сочинил из головы. */
export function describeToolStep(name: string, input: Record<string, unknown>): string {
  const s = (k: string) => (input[k] ? String(input[k]) : "");
  switch (name) {
    case "list_my_clients":
      return "список клиентов";
    case "get_client":
      return `карточка клиента${s("name") ? `: ${s("name")}` : ""}`;
    case "search_knowledge":
      return `база знаний${s("query") ? `: «${s("query")}»` : ""}`;
    case "list_inbox_files":
      return "входящие файлы";
    case "route_file":
      return `разложил файл${s("clientName") ? ` к клиенту ${s("clientName")}` : ""}`;
    case "create_task":
      return `создал задачу${s("title") ? `: ${s("title")}` : ""}`;
    case "add_daily_status":
      return `записал статус дня${s("clientName") ? ` по ${s("clientName")}` : ""}`;
    case "add_journal_entry":
      return "записал в дневник";
    case "ask_leader":
      return "отправил вопрос руководителю";
    default:
      return name;
  }
}

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
      // Ищем в памяти, а не запросом в базу: SQLite не умеет искать по-русски
      // без учёта регистра, поэтому «цены» не находили статью «Цены». Статей
      // пара десятков — загрузить их целиком дешевле, чем городить полнотекст.
      const [arts, files] = await Promise.all([
        prisma.knowledgeArticle.findMany({ orderBy: { orderIndex: "asc" } }),
        prisma.knowledgeFile.findMany({ orderBy: { uploadedAt: "desc" } }),
      ]);

      const words = searchWords(q);
      if (words.length === 0 || arts.length === 0) return knowledgeToc(arts, files);

      const scored = arts
        .map((a) => ({
          a,
          // Заголовок весит втрое: совпадение в нём почти всегда точнее.
          score: scoreText(normalizeRu(a.title), words, 3) + scoreText(normalizeRu(a.bodyMarkdown), words, 1),
        }))
        .filter((x) => x.score > 0)
        .sort((x, y) => y.score - x.score)
        .slice(0, 4);

      const matchedFiles = files.filter((f) => scoreText(normalizeRu(f.title), words, 1) > 0);

      if (scored.length === 0 && matchedFiles.length === 0) {
        return `По запросу «${q}» точных совпадений нет. Вот что вообще есть в базе знаний — выбери подходящее и переспроси:\n\n${knowledgeToc(arts, files)}`;
      }

      const out = scored.map((x) => `### ${x.a.title} (${x.a.category})\n${x.a.bodyMarkdown.slice(0, 1500)}`);
      if (matchedFiles.length > 0) {
        out.push(`### Файлы и шаблоны\n${matchedFiles.map((f) => `- ${f.title} (${f.fileName})`).join("\n")}`);
      }
      return out.join("\n\n");
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
