import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { isLeadership, ownScope } from "@/lib/scope";
import { PublicError } from "@/lib/errors";
import { taskAdvertiserId, taskScope } from "@/lib/task-scope";

// ─────────────────────────────────────────────────────────────────────────────
// Недельный разбор по клиентам — вид «По клиентам» в разделе «Задачи»
// (`/tasks?view=clients`). Прозрачная постановка дел между руководителем
// проекта и проектным менеджером.
//
// ⚠️ Раньше это был отдельный раздел «Рабочий лист». Его убрали по решению
// пользователя: в меню стояли два пункта про ОДИН И ТОТ ЖЕ список задач —
// доска отвечала «на чьей стороне мяч», лист «что по клиентам на неделю».
// Данные и так были общие, поэтому разделять пришлось не данные, а экраны.
//
// ОТКУДА ВЗЯЛОСЬ. До этого лист вели в Google-документе: по каждому клиенту
// абзац обстановки и список пунктов, напротив которых менеджер дописывал
// «ГОТОВО» или «ЖДЁМ КЛИЕНТА». Документ работал, но у него три беды: статус
// правился поверх текста (историю не восстановить), сроки нигде не считались
// (просрочку замечали глазами), и всё это жило отдельно от сервиса, где уже
// есть те же клиенты, сделки и задачи.
//
// ЧТО ЗДЕСЬ. Лист НЕ заводит вторую систему задач: он собирает существующие
// задачи сервиса в тот же вид, что был в документе — по клиентам, с группами
// внутри клиента, со сводкой недели сверху. Поэтому задача, поставленная в
// листе, сразу видна на доске задач и в «Сегодня», а просрочка считается один
// раз и одинаково везде.
// ─────────────────────────────────────────────────────────────────────────────

/** Понедельник недели, в которую попадает дата. Время обнуляется. */
export function weekStartOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // getDay(): 0 — воскресенье. Нам нужен понедельник, поэтому воскресенье
  // относится к НАЧАВШЕЙСЯ неделе, а не к следующей.
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return d;
}

/** Воскресенье той же недели, конец дня. */
export function weekEndOf(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** «2026-10-12» → Date. Нужен для ссылок вида ?week=…, приходящих из адреса. */
export function parseWeek(value: string | undefined): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return weekStartOf(d);
  }
  return weekStartOf(new Date());
}

/** Date → «2026-10-12» (для адресной строки и формы). */
export function weekKey(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/**
 * Чей это лист. Лист принадлежит РУКОВОДИТЕЛЮ ПРОЕКТА: менеджер открывает лист
 * своего руководителя, а не заводит собственный — иначе получилось бы два
 * списка дел по одним и тем же клиентам.
 */
export async function worksheetOwnerId(session: SessionPayload): Promise<string> {
  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { leadId: true },
  });
  return me?.leadId ?? session.userId;
}

export type WorksheetTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  groupLabel: string | null;
  asproUrl: string | null;
  notes: string | null;
  assigneeName: string | null;
  assigneeId: string | null;
  dealTitle: string | null;
  comments: { id: string; text: string; authorName: string | null; createdAt: Date }[];
};

export type WorksheetClient = {
  advertiserId: string;
  name: string;
  note: string | null;
  /**
   * Три части — ровно те вопросы, которые задают на недельной сверке:
   * что сделано → что делаем → что дальше. Раньше внутри клиента стояли
   * группы «Документы»/«Креативы», но разговор идёт не по группам, а по
   * времени; сама группа осталась подписью на строке задачи.
   */
  done: WorksheetTask[];
  now: WorksheetTask[];
  next: WorksheetTask[];
  overdue: number;
  openCount: number;
};

export type Worksheet = {
  weekStart: Date;
  weekEnd: Date;
  ownerId: string;
  ownerName: string;
  /** Кто ещё в паре (менеджеры руководителя или сам руководитель). */
  pair: { id: string; name: string }[];
  generalNote: string | null;
  clients: WorksheetClient[];
  /** Сводка недели — считается, а не пишется руками. */
  done: WorksheetTask[];
  red: WorksheetTask[];
};

const DONE = "Готова";

/** Задача просрочена: срок в прошлом, а работа не закрыта. */
export function isOverdue(t: { dueDate: Date | null; status: string }, now = new Date()): boolean {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return !!t.dueDate && t.status !== DONE && t.dueDate < today;
}

function shape(t: {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  groupLabel: string | null;
  asproUrl: string | null;
  notes: string | null;
  assigneeId: string | null;
  assignee: { name: string } | null;
  deal: { title: string } | null;
  comments: { id: string; text: string; createdAt: Date; author: { name: string } | null }[];
}): WorksheetTask {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    groupLabel: t.groupLabel,
    asproUrl: t.asproUrl,
    notes: t.notes,
    assigneeId: t.assigneeId,
    assigneeName: t.assignee?.name ?? null,
    dealTitle: t.deal?.title ?? null,
    comments: t.comments.map((c) => ({
      id: c.id,
      text: c.text,
      authorName: c.author?.name ?? null,
      createdAt: c.createdAt,
    })),
  };
}

/**
 * Собирает лист за неделю.
 *
 * Какие задачи попадают в лист: открытые (их надо держать в поле зрения, даже
 * если срок позже) плюс закрытые на этой неделе (чтобы было видно сделанное).
 * Задачи без клиента в лист не идут — он устроен «по клиентам», как и прежний
 * документ; личные дела остаются на доске задач.
 */
export async function buildWorksheet(
  session: SessionPayload,
  weekStart: Date,
  forOwnerId?: string,
): Promise<Worksheet> {
  const myOwnerId = await worksheetOwnerId(session);
  const ownerId = forOwnerId ?? myOwnerId;
  if (session.role === "Security" || (!isLeadership(session) && ownerId !== myOwnerId)) {
    throw new PublicError("Нет доступа к рабочему списку", { code: "forbidden", status: 404 });
  }
  const weekEnd = weekEndOf(weekStart);

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, name: true, projectManagers: { select: { id: true, name: true } } },
  });

  // Круг людей листа: руководитель проекта и его менеджеры.
  const circle = [ownerId, ...(owner?.projectManagers.map((m) => m.id) ?? [])];
  // Руководитель смотрит выбранную пару, а не все задачи отдела сразу.
  const pairSession: SessionPayload = { ...session, userId: ownerId, role: "Manager", teamIds: circle };

  const [advertisers, tasks, notes] = await Promise.all([
    prisma.advertiser.findMany({
      where: { AND: [{ ownerId: { in: circle }, archived: false }, ownScope(session)] },
      select: { id: true, nameRu: true },
      orderBy: { nameRu: "asc" },
    }),
    prisma.task.findMany({
      where: {
        AND: [
          taskScope(pairSession),
          taskScope(session),
          { OR: [{ advertiserId: { not: null } }, { dealId: { not: null } }] },
        ],
      },
      include: {
        assignee: { select: { name: true } },
        deal: { select: { title: true, advertiserId: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true } } },
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.worksheetNote.findMany({ where: { weekStart, ownerId } }),
  ]);

  // Открытые держим целиком — их надо видеть, даже если срок позже. Закрытые
  // оставляем только те, что закрыли на этой неделе: иначе лист через месяц
  // зарастает историей и перестаёт читаться.
  const clientIds = new Set(advertisers.map((a) => a.id));
  const visible = tasks.filter((t) => {
    const advertiserId = taskAdvertiserId(t);
    return advertiserId && clientIds.has(advertiserId) &&
      (t.status !== DONE || (t.updatedAt >= weekStart && t.updatedAt <= weekEnd));
  });

  const byAdvertiser = new Map<string, typeof visible>();
  for (const t of visible) {
    const advertiserId = taskAdvertiserId(t);
    if (!advertiserId) continue;
    const list = byAdvertiser.get(advertiserId) ?? [];
    list.push(t);
    byAdvertiser.set(advertiserId, list);
  }

  const noteFor = (advertiserId: string | null) =>
    notes.find((n) => (n.advertiserId ?? null) === advertiserId)?.text ?? null;

  // Клиент показывается, даже если задач нет: пустая строка в листе — это
  // вопрос «а что у нас с ним?», и его лучше видеть, чем не видеть.
  const clients: WorksheetClient[] = advertisers.map((a) => {
    const list = byAdvertiser.get(a.id) ?? [];
    // Деление по вопросам недельной сверки:
    //   сделано  — закрытые (сюда попадают только закрытые на этой неделе);
    //   делаем   — открытые со сроком до конца недели И без срока: работа,
    //              которая идёт прямо сейчас, вместе с просрочкой;
    //   дальше   — открытые со сроком позже недели.
    // Задача без срока — это «идёт», а не «потом»: иначе половина листа
    // уезжала бы в «дальше» и на сверке её бы не обсуждали.
    return {
      advertiserId: a.id,
      name: a.nameRu,
      note: noteFor(a.id),
      done: list.filter((t) => t.status === DONE).map(shape),
      now: list.filter((t) => t.status !== DONE && (!t.dueDate || t.dueDate <= weekEnd)).map(shape),
      next: list.filter((t) => t.status !== DONE && !!t.dueDate && t.dueDate > weekEnd).map(shape),
      overdue: list.filter((t) => isOverdue(t)).length,
      openCount: list.filter((t) => t.status !== DONE).length,
    };
  });

  const done = visible.filter((t) => t.status === DONE).map(shape);
  const red = visible
    .filter((t) => isOverdue(t) || (t.status === "Ждёт" && t.priority === "Срочно"))
    .map(shape);

  return {
    weekStart,
    weekEnd,
    ownerId,
    ownerName: owner?.name ?? "",
    pair: owner?.projectManagers ?? [],
    generalNote: noteFor(null),
    clients,
    done,
    red,
  };
}

/** Чьи листы может посмотреть этот человек (руководителю отдела — все пары). */
export async function worksheetOwners(
  session: SessionPayload,
): Promise<{ id: string; name: string }[]> {
  if (!isLeadership(session)) return [];
  const leads = await prisma.user.findMany({
    where: { projectManagers: { some: {} } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return leads;
}
