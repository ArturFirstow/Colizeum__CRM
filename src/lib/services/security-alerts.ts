import "server-only";
import { prisma } from "@/lib/prisma";
import { notifySecurity } from "@/lib/services/notify";

// ─────────────────────────────────────────────────────────────────────────────
// Сигналы о подозрительной активности (требование 6.7).
//
// Журнал действий уже пишет всё подряд, но читать его каждый день никто не
// будет. Поэтому несколько событий считаются ТРЕВОЖНЫМИ и сами идут к тем,
// кто отвечает за безопасность: в Telegram и всплывающим окном в сервисе.
//
// Что считаем тревожным — ниже в ALERT_LABELS. Это не «взлом обнаружен», а
// «посмотрите, так ли это должно быть»: вход ночью может быть и обычной
// переработкой, но ответственный за ИБ должен о нём узнать, а не выяснять
// задним числом.
//
// Сигнал — это строка журнала с действием «security.alert». Отдельной таблицы
// нет намеренно: тревоги хранятся столько же, сколько журнал, и видны в том же
// разделе, где их и будут искать.
// ─────────────────────────────────────────────────────────────────────────────

export type AlertKind =
  | "bruteforce"
  | "new-ip"
  | "night-login"
  | "totp-off"
  | "mass-export"
  | "password-reset"
  | "role-change";

export const ALERT_LABELS: Record<AlertKind, string> = {
  bruteforce: "Подбор пароля",
  "new-ip": "Вход с нового адреса",
  "night-login": "Вход в нерабочее время",
  "totp-off": "Отключён вход по коду",
  "mass-export": "Выгрузка данных всего отдела",
  "password-reset": "Администратор сменил пароль сотруднику",
  "role-change": "Изменена роль сотрудника",
};

/** Насколько серьёзно. Влияет только на значок в сообщении. */
const SEVERITY: Record<AlertKind, "высокая" | "средняя"> = {
  bruteforce: "высокая",
  "totp-off": "высокая",
  "password-reset": "высокая",
  "role-change": "высокая",
  "mass-export": "средняя",
  "new-ip": "средняя",
  "night-login": "средняя",
};

/**
 * Один и тот же сигнал с того же адреса не повторяем 6 часов. Иначе подбор
 * пароля на тысячу попыток превратится в тысячу сообщений, бот уйдёт в mute и
 * следующую настоящую тревогу никто не увидит.
 */
const QUIET_HOURS = 6;

/** Ночь по Москве: с 23:00 до 07:00. Рабочий день отдела в эти часы не идёт. */
const NIGHT_FROM = 23;
const NIGHT_TO = 7;

function moscowTime(at: Date): { hour: number; clock: string } {
  const clock = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
  return { hour: Number(clock.slice(0, 2)), clock };
}

export type AlertInput = {
  kind: AlertKind;
  /** Кого касается. Для неудачных попыток входа может быть неизвестен. */
  userId?: string | null;
  userName?: string | null;
  ip?: string | null;
  /** Короткое пояснение человеку: что именно произошло. */
  detail?: string | null;
};

/**
 * Поднимает тревогу: пишет строку в журнал и уведомляет ответственных.
 *
 * В Telegram уходит без ожидания — недоступный бот не должен задерживать вход
 * сотрудника. Даже если сообщение не дойдёт, тревога останется в журнале и
 * всплывёт в сервисе.
 */
export async function raiseAlert(input: AlertInput): Promise<void> {
  try {
    const since = new Date(Date.now() - QUIET_HOURS * 3600_000);
    const recent = await prisma.auditLog.findFirst({
      where: {
        action: "security.alert",
        entityId: input.kind,
        userId: input.userId ?? null,
        ip: input.ip ?? null,
        createdAt: { gt: since },
      },
      select: { id: true },
    });
    if (recent) return;

    await prisma.auditLog.create({
      data: {
        action: "security.alert",
        userId: input.userId ?? null,
        userName: input.userName ?? null,
        entityType: "security",
        entityId: input.kind,
        changedFields: input.detail ?? ALERT_LABELS[input.kind],
        ip: input.ip ?? null,
        ok: false,
      },
    });

    const lines = [
      `🚨 <b>${ALERT_LABELS[input.kind]}</b>`,
      ``,
      input.userName ? `Кто: ${input.userName}` : "",
      input.ip ? `Адрес: ${input.ip}` : "",
      input.detail ? `\n${input.detail}` : "",
      `\nВажность: ${SEVERITY[input.kind]}`,
    ].filter(Boolean);
    void notifySecurity(lines.join("\n"), "/leadership/audit", "Открыть журнал действий");
  } catch (e) {
    // Тревога — наблюдатель. Её сбой не отменяет действие, которое её вызвало.
    console.error("[security-alerts] не удалось поднять тревогу:", e);
  }
}

/**
 * Проверки по факту успешного входа: новый адрес и ночное время.
 *
 * «Новый адрес» определяем по журналу: если с этого адреса этот человек ещё
 * ни разу не входил — сигнал. У сотрудника, работающего из дома и из офиса,
 * так будет два «новых адреса» за первую неделю и тишина дальше.
 */
export async function checkLoginSignals(opts: {
  userId: string;
  userName: string;
  ip: string | null;
  at?: Date;
}): Promise<void> {
  const at = opts.at ?? new Date();

  if (opts.ip && opts.ip !== "неизвестен") {
    const seen = await prisma.auditLog.findFirst({
      where: { userId: opts.userId, action: "login.ok", ip: opts.ip, createdAt: { lt: at } },
      select: { id: true },
    });
    if (!seen) {
      // Первый вход вообще (сразу после создания доступа) тревогой не считаем:
      // иначе каждый новый сотрудник начинался бы с сообщения о взломе.
      const everLoggedIn = await prisma.auditLog.findFirst({
        where: { userId: opts.userId, action: "login.ok", createdAt: { lt: at } },
        select: { id: true },
      });
      if (everLoggedIn) {
        await raiseAlert({
          kind: "new-ip",
          userId: opts.userId,
          userName: opts.userName,
          ip: opts.ip,
          detail: "Раньше с этого адреса этот сотрудник не входил. Если это не он — смените пароль.",
        });
      }
    }
  }

  const { hour, clock } = moscowTime(at);
  if (hour >= NIGHT_FROM || hour < NIGHT_TO) {
    await raiseAlert({
      kind: "night-login",
      userId: opts.userId,
      userName: opts.userName,
      ip: opts.ip,
      detail: `Вход в ${clock} по Москве — вне рабочего времени отдела.`,
    });
  }
}

export type SecurityAlert = {
  id: string;
  kind: string;
  label: string;
  detail: string | null;
  userName: string | null;
  ip: string | null;
  at: Date;
};

/** Последние тревоги — для всплывающих уведомлений и раздела журнала. */
export async function recentAlerts(since: Date, take = 10): Promise<SecurityAlert[]> {
  const rows = await prisma.auditLog.findMany({
    where: { action: "security.alert", createdAt: { gt: since } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.entityId ?? "",
    label: ALERT_LABELS[(r.entityId ?? "") as AlertKind] ?? "Подозрительная активность",
    detail: r.changedFields,
    userName: r.userName,
    ip: r.ip,
    at: r.createdAt,
  }));
}
