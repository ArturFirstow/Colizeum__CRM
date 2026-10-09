import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { canSeeOwned, canSeeTournaments, isLeadership, isSecurity } from "@/lib/scope";
import { PublicError } from "@/lib/errors";

// ─────────────────────────────────────────────────────────────────────────────
// Проверка «эта запись вообще твоя?» для запросов к API.
//
// ЗАЧЕМ ЭТО ПОЯВИЛОСЬ. Страницы сервиса всегда проверяли владельца: открыть
// чужого клиента по прямой ссылке было нельзя. А вот ОБРАБОТЧИКИ ЗАПРОСОВ —
// те, что правят и удаляют, — проверяли не везде. Списки отдавались по области
// видимости, и это создавало ложное чувство защищённости: раз в списке чужого
// не видно, то и тронуть нельзя.
//
// Поймано живой проверкой (пункт коллег И-9): менеджер, зная идентификатор
// чужой записи маркировки, смог изменить её и удалить. Требование 5.2 говорит
// прямо: права проверяются на сервере, чужая запись не отдаётся даже по прямой
// ссылке. Проверка в интерфейсе — это удобство, а не защита.
//
// КАК УСТРОЕНО. У каждой записи есть «хозяин» — сотрудник, которому она
// принадлежит. Чаще всего это владелец клиента, к которому запись привязана:
// счёт принадлежит сделке, сделка — клиенту, клиент — сотруднику. Здесь эта
// цепочка пройдена один раз для каждого вида записей, а обработчики просто
// вызывают нужную функцию.
//
// ЧТО НЕ ЗАКРЫВАЕТСЯ ЗДЕСЬ И ПОЧЕМУ: база знаний, календарь размещений,
// заявки с сайта и мессенджер — общие для отдела по замыслу, у них нет
// «своего» сотрудника. Их проверки живут в своих обработчиках.
// ─────────────────────────────────────────────────────────────────────────────

/** Отказ в доступе. Текст одинаковый для «не найдено» и «не твоё» намеренно:
 *  иначе по разнице ответов можно перебором узнать, какие записи существуют. */
function deny(): never {
  throw new PublicError("Запись не найдена или у вас нет к ней доступа", {
    code: "forbidden",
    status: 404,
  });
}

/** Безопасник не работает с клиентскими данными вовсе. */
function denySecurity(session: SessionPayload): void {
  if (isSecurity(session)) deny();
}

// ── Клиент и всё, что к нему привязано ───────────────────────────────────────

/** Клиент. Возвращает его владельца — пригодится вызывающему. */
export async function guardAdvertiser(session: SessionPayload, advertiserId: string) {
  denySecurity(session);
  const a = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    select: { id: true, ownerId: true },
  });
  if (!a || !canSeeOwned(session, a.ownerId)) deny();
  return a;
}

/** Сделка — через клиента, которому она принадлежит. */
export async function guardDeal(session: SessionPayload, dealId: string) {
  denySecurity(session);
  const d = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, advertiserId: true, advertiser: { select: { ownerId: true } } },
  });
  if (!d || !canSeeOwned(session, d.advertiser.ownerId)) deny();
  return d;
}

/** Документ. */
export async function guardDocument(session: SessionPayload, documentId: string) {
  denySecurity(session);
  const d = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, advertiserId: true, advertiser: { select: { ownerId: true } } },
  });
  if (!d || !canSeeOwned(session, d.advertiser.ownerId)) deny();
  return d;
}

/** Версия документа — через сам документ. */
export async function guardDocumentVersion(session: SessionPayload, versionId: string) {
  denySecurity(session);
  const v = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    select: { id: true, document: { select: { advertiser: { select: { ownerId: true } } } } },
  });
  if (!v || !canSeeOwned(session, v.document.advertiser.ownerId)) deny();
  return v;
}

/** Счёт — через сделку. */
export async function guardInvoice(session: SessionPayload, invoiceId: string) {
  denySecurity(session);
  const i = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, dealId: true, deal: { select: { advertiser: { select: { ownerId: true } } } } },
  });
  if (!i || !canSeeOwned(session, i.deal.advertiser.ownerId)) deny();
  return i;
}

/** Запись маркировки ОРД — через сделку. Именно здесь нашлась дыра. */
export async function guardOrd(session: SessionPayload, ordId: string) {
  denySecurity(session);
  const o = await prisma.ordMarking.findUnique({
    where: { id: ordId },
    select: { id: true, dealId: true, deal: { select: { advertiser: { select: { ownerId: true } } } } },
  });
  if (!o || !canSeeOwned(session, o.deal.advertiser.ownerId)) deny();
  return o;
}

/** Плановый платёж — через клиента (сделка у него необязательна). */
export async function guardPlannedPayment(session: SessionPayload, id: string) {
  denySecurity(session);
  const p = await prisma.plannedPayment.findUnique({
    where: { id },
    select: { id: true, advertiser: { select: { ownerId: true } } },
  });
  if (!p || !canSeeOwned(session, p.advertiser.ownerId)) deny();
  return p;
}

/**
 * Размещение. Календарь слотов ОБЩИЙ намеренно — физические места в клубах
 * одни на всех, и видеть занятость должен каждый. А вот ПРАВИТЬ чужую бронь
 * нельзя: иначе менеджер случайно снимет размещение соседа.
 * Бронь без клиента (черновой слот) трогать может любой.
 */
export async function guardPlacement(session: SessionPayload, id: string) {
  denySecurity(session);
  const p = await prisma.placement.findUnique({
    where: { id },
    select: { id: true, advertiserId: true, advertiser: { select: { ownerId: true } } },
  });
  if (!p) deny();
  if (p.advertiser && !canSeeOwned(session, p.advertiser.ownerId)) deny();
  return p;
}

/** Пачка промокодов — через клиента. Клиент необязателен: бывают общие акции. */
export async function guardPromo(session: SessionPayload, id: string) {
  denySecurity(session);
  const p = await prisma.promoBatch.findUnique({
    where: { id },
    select: { id: true, advertiserId: true, advertiser: { select: { ownerId: true } } },
  });
  if (!p) deny();
  if (p.advertiser && !canSeeOwned(session, p.advertiser.ownerId)) deny();
  return p;
}

/** Креатив клиента. */
export async function guardCreative(session: SessionPayload, id: string) {
  denySecurity(session);
  const c = await prisma.creative.findUnique({
    where: { id },
    select: { id: true, advertiser: { select: { ownerId: true } } },
  });
  if (!c || !canSeeOwned(session, c.advertiser.ownerId)) deny();
  return c;
}

/** Клиент агентства. */
export async function guardAgencyClient(session: SessionPayload, id: string) {
  denySecurity(session);
  const c = await prisma.agencyClient.findUnique({
    where: { id },
    select: { id: true, advertiser: { select: { ownerId: true } } },
  });
  if (!c || !canSeeOwned(session, c.advertiser.ownerId)) deny();
  return c;
}

// ── Записи, принадлежащие самому сотруднику ──────────────────────────────────

/** Задача: своя, порученная тебе, или по твоему клиенту. */
export async function guardTask(session: SessionPayload, id: string) {
  denySecurity(session);
  const t = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      assigneeId: true,
      assignedById: true,
      advertiser: { select: { ownerId: true } },
    },
  });
  if (!t) deny();
  const mine =
    isLeadership(session) ||
    t.ownerId === session.userId ||
    t.assigneeId === session.userId ||
    t.assignedById === session.userId ||
    (t.advertiser ? t.advertiser.ownerId === session.userId : false);
  if (!mine) deny();
  return t;
}

/** Запись дневника — личная. */
export async function guardJournalEntry(session: SessionPayload, id: string) {
  denySecurity(session);
  const j = await prisma.journalEntry.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!j || !canSeeOwned(session, j.ownerId)) deny();
  return j;
}

/** Статус дня: свой или по своему клиенту. */
export async function guardDailyStatus(session: SessionPayload, id: string) {
  denySecurity(session);
  const d = await prisma.dailyStatus.findUnique({
    where: { id },
    select: { id: true, authorId: true, advertiser: { select: { ownerId: true } } },
  });
  if (!d) deny();
  const mine =
    isLeadership(session) ||
    d.authorId === session.userId ||
    d.advertiser.ownerId === session.userId;
  if (!mine) deny();
  return d;
}

/**
 * Вопрос руководителю: видит автор и руководитель. Отвечать может только
 * руководитель — это проверяется отдельно в самом обработчике.
 */
export async function guardDecision(session: SessionPayload, id: string) {
  denySecurity(session);
  const d = await prisma.decisionRequest.findUnique({
    where: { id },
    select: { id: true, requesterId: true },
  });
  if (!d) deny();
  if (!isLeadership(session) && d.requesterId !== session.userId) deny();
  return d;
}

// ── Турнирное направление ────────────────────────────────────────────────────

/** Турнир. Турнирный контур видят сам турнирщик и руководитель. */
export async function guardTournament(session: SessionPayload, id: string) {
  denySecurity(session);
  const t = await prisma.tournament.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!t || !canSeeOwned(session, t.ownerId)) deny();
  return t;
}

export async function guardTournamentContractor(session: SessionPayload, id: string) {
  denySecurity(session);
  const c = await prisma.tournamentContractor.findUnique({
    where: { id },
    select: { id: true, ownerId: true },
  });
  if (!c || !canSeeOwned(session, c.ownerId)) deny();
  return c;
}

/**
 * Бронь арены. Своего владельца у неё нет — арена одна, календарь общий.
 * Поэтому проверяем не владельца, а направление: турнирный контур видят сам
 * турнирный специалист и руководитель.
 */
export async function guardArenaBooking(session: SessionPayload, id: string) {
  denySecurity(session);
  if (!canSeeTournaments(session)) deny();
  const b = await prisma.arenaBooking.findUnique({ where: { id }, select: { id: true } });
  if (!b) deny();
  return b;
}

// ── Деньги отдела ────────────────────────────────────────────────────────────

/**
 * Файл из общего хранилища вложений.
 *
 * У файла две приметы: к какому клиенту он привязан и кто его загрузил.
 * Привязан к клиенту — решает владелец клиента. Не привязан (база знаний,
 * входящие напарника, свой дневник) — решает тот, кто загрузил.
 */
export async function guardFileAsset(session: SessionPayload, id: string) {
  denySecurity(session);
  const f = await prisma.fileAsset.findUnique({
    where: { id },
    select: { id: true, ownerType: true, advertiserId: true, uploadedById: true, storageKey: true },
  });
  if (!f) deny();

  // База знаний — общий раздел отдела, её файлы видны всем сотрудникам.
  if (f.ownerType === "knowledge") return f;

  if (f.advertiserId) {
    const a = await prisma.advertiser.findUnique({
      where: { id: f.advertiserId },
      select: { ownerId: true },
    });
    if (!a || !canSeeOwned(session, a.ownerId)) deny();
    return f;
  }

  if (isLeadership(session) || f.uploadedById === session.userId || !f.uploadedById) return f;
  deny();
}

/** Передача дел: касается того, кто передаёт, и того, кто принимает. */
export async function guardHandover(session: SessionPayload, id: string) {
  denySecurity(session);
  const h = await prisma.handover.findUnique({
    where: { id },
    select: { id: true, fromUserId: true, toUserId: true },
  });
  if (!h) deny();
  const mine =
    isLeadership(session) || h.fromUserId === session.userId || h.toUserId === session.userId;
  if (!mine) deny();
  return h;
}

// ── Мессенджер ───────────────────────────────────────────────────────────────

/**
 * Доступ к каналу. Общие каналы открыты всем сотрудникам — в этом их смысл.
 * Личка — только двум её участникам: это личная переписка, и то, что человек
 * знает идентификатор чужого диалога, не делает его собеседником.
 */
export async function guardChannel(session: SessionPayload, channelId: string) {
  const c = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, isDm: true, isGeneral: true, createdById: true },
  });
  if (!c) deny();
  if (c.isDm) {
    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: session.userId } },
      select: { userId: true },
    });
    if (!member) deny();
  }
  return c;
}

/**
 * Вложение чата — через канал, в котором оно лежит.
 * Раньше файл отдавался любому вошедшему по прямой ссылке: зная
 * идентификатор, можно было скачать вложение из чужой переписки.
 */
export async function guardChatAttachment(session: SessionPayload, attachmentId: string) {
  const a = await prisma.chatAttachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, storageKey: true, fileName: true, contentType: true, message: { select: { channelId: true } } },
  });
  if (!a) deny();
  await guardChannel(session, a.message.channelId);
  return a;
}

/**
 * Удаление канала. Личку сносит только её участник — иначе посторонний стирает
 * чужую переписку целиком. Общий канал убирает тот, кто его завёл, или админ.
 */
export async function guardChannelDelete(session: SessionPayload, channelId: string) {
  const c = await guardChannel(session, channelId);
  if (c.isGeneral) {
    throw new PublicError("«Общий» канал удалить нельзя", { code: "forbidden", status: 400 });
  }
  if (!c.isDm && c.createdById && c.createdById !== session.userId && session.role !== "Owner") {
    throw new PublicError("Удалить канал может тот, кто его создал, или администратор", {
      code: "forbidden",
      status: 403,
    });
  }
  return c;
}

/** Бюджет отдела — только руководитель. */
export function guardLeadership(session: SessionPayload): void {
  if (!isLeadership(session)) deny();
}
