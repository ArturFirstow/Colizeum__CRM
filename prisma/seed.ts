/**
 * Сид первичного наполнения (блупринт, раздел 15).
 * Запуск: npm run db:seed  (или npm run setup).
 * Идемпотентен: чистит таблицы и наполняет заново.
 *
 * Пишет несколько placeholder-файлов в локальное хранилище, чтобы во вкладке
 * «Документы» сразу были документы с версиями и рабочим скачиванием.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const STORAGE_DIR = process.env.STORAGE_LOCAL_DIR ?? "./storage";

function hash(plain: string) {
  return bcrypt.hashSync(plain, 10);
}

function sanitize(name: string) {
  return name.replace(/[/\\]/g, "_").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 200) || "file";
}

// Пишет placeholder-файл версии в хранилище, возвращает метаданные для БД.
function writeVersionFile(
  advertiserId: string,
  documentId: string,
  versionNo: number,
  fileName: string,
  content: string,
) {
  const key = `advertisers/${advertiserId}/documents/${documentId}/v${versionNo}/${sanitize(fileName)}`;
  const full = path.resolve(process.cwd(), STORAGE_DIR, key);
  mkdirSync(path.dirname(full), { recursive: true });
  const buf = Buffer.from(content, "utf-8");
  writeFileSync(full, buf);
  return {
    storageKey: key,
    fileName,
    mimeType: "text/plain",
    sizeBytes: buf.length,
    sha256: createHash("sha256").update(buf).digest("hex"),
  };
}

async function main() {
  console.log("🌱 Очистка таблиц…");
  // Порядок: от зависимых к корневым.
  await prisma.dailyStatus.deleteMany();
  await prisma.placement.deleteMany();
  await prisma.plannedPayment.deleteMany();
  await prisma.agencyClient.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.closingDoc.deleteMany();
  await prisma.ordMarking.deleteMany();
  await prisma.promoBatch.deleteMany();
  await prisma.mediaPlanLine.deleteMany();
  await prisma.mediaPlan.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.document.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.advertiser.deleteMany();
  await prisma.person.deleteMany();
  await prisma.knowledgeArticle.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.user.deleteMany();

  // ── Пользователи (2 аккаунта, блупринт 3, 11) ──────────────────────────────
  console.log("👤 Пользователи…");
  const owner = await prisma.user.create({
    data: {
      email: (process.env.SEED_OWNER_EMAIL ?? "owner@colizeum.ru").toLowerCase(),
      name: "Ведущий менеджер",
      role: "Owner",
      passwordHash: hash(process.env.SEED_OWNER_PASSWORD ?? "colizeum"),
    },
  });
  const manager = await prisma.user.create({
    data: {
      email: (process.env.SEED_MANAGER_EMAIL ?? "manager@colizeum.ru").toLowerCase(),
      name: "Младший менеджер",
      role: "Manager",
      passwordHash: hash(process.env.SEED_MANAGER_PASSWORD ?? "colizeum"),
    },
  });

  // ── Директория людей (блупринт 15) ─────────────────────────────────────────
  console.log("🧑‍💼 Директория людей…");
  await prisma.person.createMany({
    data: [
      { role: "Директор по маркетингу", name: "Рома Измайлов", telegram: "@izovsehsil13", scope: "чек B2C ⚠️ хендл выверить" },
      { role: "Арт-директор", name: "Милана Умерова", scope: "дизайн" },
      { role: "Баннер-менеджер", name: "Милана", telegram: "@melscrim", scope: "запуск размещений ⚠️ две «Миланы»" },
      { role: "Размещение / согласование", name: "Александр Иванушкин", telegram: "@alexandr_ivanushkin" },
      { role: "Передача на размещение", name: "Милана Захарова" },
      { role: "Операционный директор", name: "Руслан", scope: "чек B2B" },
      { role: "Руководитель СММ", name: "Аня", telegram: "@danna35" },
      { role: "Юрист — договоры", name: "Екатерина", scope: "маршрут согласования" },
      { role: "Юрист — маркировка/ОРД", name: "Полина", telegram: "@ppachkova_law" },
      { role: "Главный бухгалтер", name: "Ольга", scope: "финансы, порог 3 млн → СЕО" },
      { role: "УПД по промокодам", name: "Ирина" },
      { role: "Рассылки промокодов", name: "Анна Дамер" },
      { role: "Снабжение / склад", name: "Андрей Листратов", telegram: "@Listratov92" },
      { role: "Управляющий клуба (Афимолл)", name: "Галина", telegram: "@aphrodiiite" },
      { role: "Управляющий клуба (Шелепиха)", name: "Марат", telegram: "@PM_Marat_Colizeum", scope: "обкатка T-Pay" },
      { role: "Управляющий (клубы 50+)", name: "Люба", telegram: "@sushintseva" },
    ],
  });

  // ── Рекламодатели + сделки + контакты (блупринт 15) ────────────────────────
  console.log("🏢 Рекламодатели и сделки…");

  const tbank = await prisma.advertiser.create({
    data: {
      nameRu: "Т-Банк",
      nameEn: "T-Bank",
      legalEntity: "АО «ТБанк»",
      type: "Рекламодатель",
      status: "Активный",
      goals: "Реклама в клубах, эквайринг T-Pay, партнёрство Colizeum Fest.",
      notes: "Многотрековый клиент. Приложения к договору согласуются строго по очереди через бухгалтерию.",
      contacts: {
        create: [
          { fio: "Дарья Гурьева", role: "Colizeum Fest / запуск", isPrimary: true },
        ],
      },
    },
  });

  const mts = await prisma.advertiser.create({
    data: {
      nameRu: "МТС",
      nameEn: "MTS",
      legalEntity: "ПАО «МТС»",
      inn: "7740000076",
      type: "Рекламодатель",
      status: "Активный",
      goals: "Рамочный договор + Заказы. Номер D260183187.",
      notes: "⚠️ КПП в документах разный: 770901001 / 997750001. Подписант Белоусова Н.А. по МЧД.",
      contacts: { create: [{ fio: "Белоусова Н.А.", role: "Подписант (МЧД)", isPrimary: true }] },
    },
  });

  const alabuga = await prisma.advertiser.create({
    data: {
      nameRu: "Алабуга",
      legalEntity: "АО «ОЭЗ ППТ Алабуга»",
      type: "Рекламодатель",
      status: "Активный",
      goals: "Размещение по договору 10/06/2026-РИМ (их номер ОЭЗ-12426/26).",
      notes: "Тело договора править НЕЛЬЗЯ — только через ДС. ⚠️ сумма 9 955 200 vs 9 555 200 в тексте ДС (опечатка).",
    },
  });

  const samokat = await prisma.advertiser.create({
    data: {
      nameRu: "Самокат",
      legalEntity: "ООО «Умный ритейл»",
      type: "Рекламодатель",
      status: "Активный",
      goals: "Партнёр Colizeum Fest 2026.",
      notes: "Договор 09/06/2026-РМ-fest. Счета/УПД через ИП Сараева. ⚠️ р/с Самокат-fest …55743.",
    },
  });

  const kiberadvert = await prisma.advertiser.create({
    data: {
      nameRu: "Киберадверт",
      legalEntity: "ООО «КИБЕРАДВЕРТ»",
      type: "Агентство",
      status: "Активный",
      goals: "Рамочный 26/09/2025-РИМ + Спецификации №3–6.",
      notes: "Конечные клиенты: Т2 (MIXX Play Pro), ОККО. Типовая цена поста 195 200 ₽ с НДС, сплит-оплата.",
      contacts: { create: [{ fio: "Менеджер Киберадверт", role: "Агентский контакт" }] },
    },
  });

  const maccoffee = await prisma.advertiser.create({
    data: {
      nameRu: "MacCoffee",
      type: "Рекламодатель",
      status: "Активный",
      goals: "Пакеты стандарт/продвинутый, амбассадорство стримеров под TI 2026.",
      notes: "Скидка 15%.",
    },
  });

  const saraeva = await prisma.advertiser.create({
    data: {
      nameRu: "ИП Сараева Диана Сергеевна",
      legalEntity: "ИП Сараева Д.С.",
      type: "Арендатор",
      status: "Активный",
      goals: "Сервисный/промежуточный исполнитель.",
      notes: "Счета/УПД в адрес УК за техподготовку и размещение партнёров CF2026.",
    },
  });

  // Стартовые сделки — расставлены по стадиям, чтобы канбан был живым.
  const dealTbankAds = await prisma.deal.create({
    data: {
      advertiserId: tbank.id,
      title: "Т-Банк — реклама в клубах (Прил. 1/2)",
      contractConstruction: "B",
      stage: "Согласование приложений / ЭДО",
      urgency: "Высокая",
      ownerId: owner.id,
      amount: 3_200_000,
      vatIncluded: true,
      periodText: "старт после согласования Прил. №1",
      legalResponsible: "Екатерина",
      blocker: "Приложения согласуются строго по очереди через бухгалтерию.",
      nextStep: "Дождаться подписания Приложения №1, затем №2.",
      decisionPending: "Утвердить макеты для Приложения №1.",
    },
  });

  const dealTbankPay = await prisma.deal.create({
    data: {
      advertiserId: tbank.id,
      title: "Т-Банк — эквайринг T-Pay (обкатка Шелепиха)",
      contractConstruction: "D",
      stage: "Интеграция / тех. подключение",
      urgency: "Критичная",
      ownerId: owner.id,
      assigneeId: manager.id,
      periodText: "обкатка на КиберАрене Шелепиха",
      blocker: "Смена ИП на клубе сдвигает интеграцию эквайринга.",
      nextStep: "Получить API-токен, передать в ИТ-отдел.",
    },
  });

  const dealMts = await prisma.deal.create({
    data: {
      advertiserId: mts.id,
      title: "МТС — рамочный + Заказы (D260183187)",
      contractConstruction: "A",
      stage: "Оплата / предоплата",
      urgency: "Высокая",
      ownerId: owner.id,
      amount: 19_948_000,
      vatIncluded: false,
      periodText: "старт после предоплаты 40%",
      paymentTerms: "предоплата 40%",
      legalResponsible: "Екатерина",
      contractNumber: "D260183187",
      nextStep: "Согласовать схему оплаты с закупщиком → снять блокер правок договора.",
      decisionPending: "Подтвердить сумму МП v.7 (со скидкой 19 948 000 без НДС).",
    },
  });

  const dealAlabuga = await prisma.deal.create({
    data: {
      advertiserId: alabuga.id,
      title: "Алабуга — размещение (ОЭЗ-12426/26)",
      contractConstruction: "B",
      stage: "Размещение / оказание услуг",
      urgency: "Средняя",
      ownerId: owner.id,
      amount: 9_955_200,
      vatIncluded: true,
      periodText: "6 месяцев, ежемесячно",
      paymentTerms: "предоплата 1 659 200 + по 1 659 200 ежемесячно (6 мес)",
      contractNumber: "10/06/2026-РИМ / ОЭЗ-12426/26",
      legalResponsible: "Екатерина",
      blocker: "Изменения только через ДС — тело договора не правим.",
    },
  });

  const dealSamokat = await prisma.deal.create({
    data: {
      advertiserId: samokat.id,
      title: "Самокат — партнёрство CF2026",
      contractConstruction: "B",
      stage: "Закрывающие",
      urgency: "Низкая",
      ownerId: owner.id,
      amount: 2_440_000,
      vatIncluded: true,
      periodText: "CF2026 прошёл 21.06.2026",
      contractNumber: "09/06/2026-РМ-fest",
      nextStep: "Закрыть УПД через ИП Сараева.",
    },
  });

  const dealKiberadvert = await prisma.deal.create({
    data: {
      advertiserId: kiberadvert.id,
      title: "Киберадверт — Спецификации №3–6",
      contractConstruction: "C",
      stage: "Маркировка и отчётность",
      urgency: "Средняя",
      ownerId: owner.id,
      assigneeId: manager.id,
      amount: 195_200,
      vatIncluded: true,
      periodText: "посты живут до 1 мес",
      contractNumber: "26/09/2025-РИМ",
      legalResponsible: "Полина",
      nextStep: "Ежемесячное закрытие актов по маркировке.",
    },
  });

  const dealMaccoffee = await prisma.deal.create({
    data: {
      advertiserId: maccoffee.id,
      title: "MacCoffee — пакет + амбассадорство (TI 2026)",
      contractConstruction: "D",
      stage: "МП и КП",
      urgency: "Средняя",
      ownerId: manager.id,
      periodText: "под TI 2026",
      nextStep: "Собрать КП с пакетом и скидкой 15%.",
      decisionPending: "Выбрать пакет: стандарт или продвинутый.",
    },
  });

  await prisma.deal.create({
    data: {
      advertiserId: maccoffee.id,
      title: "MacCoffee — новый лид на квалификации",
      stage: "Лид / квалификация",
      ownerId: manager.id,
      nextStep: "Квалифицировать бюджет и цели.",
    },
  });

  // ── Медиаплан МТС (пример v1) ──────────────────────────────────────────────
  console.log("📊 Медиаплан…");
  await prisma.mediaPlan.create({
    data: {
      dealId: dealMts.id,
      version: 7,
      totalAmount: 19_948_000,
      vatRate: 22,
      notes: "v.7, со скидкой. Без НДS: 23 078 000; со скидкой: 19 948 000.",
      lines: {
        create: [
          { formatCode: "banner-lk", formatName: "Баннер в личном кабинете (766×473)", qty: 1, period: "1 мес", unitPrice: 5_000_000, sum: 5_000_000 },
          { formatCode: "splash-pc", formatName: "Заставки на свободных ПК (1920×1080)", qty: 1, period: "1 мес", unitPrice: 8_000_000, sum: 8_000_000 },
          { formatCode: "tv65", formatName: "Реклама на TV 65 (1920×1080)", qty: 1, period: "1 мес", unitPrice: 6_948_000, sum: 6_948_000 },
        ],
      },
    },
  });

  // ── Счёт + оплата (МТС) для демонстрации финансовой цепочки ────────────────
  console.log("💰 Финансы…");
  const inv = await prisma.invoice.create({
    data: {
      dealId: dealMts.id,
      number: "СЧ-2026/МТС-1",
      basis: "Приложение №1 к Договору D260183187",
      service: "Размещение РИМ в клубах",
      amount: 7_979_200,
      vatRate: 22,
      ourBankAccount: "40702810201300048430",
      appendixNo: "1",
      issuedAt: new Date("2026-07-01"),
    },
  });
  await prisma.payment.create({
    data: {
      invoiceId: inv.id,
      number: "ПП-1041",
      payer: "ПАО «МТС»",
      payee: "ООО «УК КОЛИЗЕУМ»",
      purpose: "Предоплата 40% по Приложению №1",
      amount: 7_979_200,
      paidAt: new Date("2026-07-05"),
    },
  });

  // ── ОРД и промокоды (примеры) ──────────────────────────────────────────────
  await prisma.ordMarking.create({
    data: {
      dealId: dealKiberadvert.id,
      role: "Агентство",
      finalClient: "Т2 (MIXX Play Pro)",
      platform: "соцсети",
      status: "Активна",
      monthlyClosing: true,
      markedAt: new Date("2026-06-20"),
      placementStart: new Date("2026-06-20"),
      placementEnd: new Date("2026-07-20"),
      expiresAt: new Date("2026-07-20"),
    },
  });
  await prisma.ordMarking.create({
    data: {
      dealId: dealKiberadvert.id,
      role: "Клиент",
      finalClient: "ОККО",
      platform: "моб.приложение",
      status: "Активна",
      monthlyClosing: true,
      urgent: true, // срочно снять креатив и сдать акт
      markedAt: new Date("2026-06-25"),
      placementStart: new Date("2026-06-25"),
      placementEnd: new Date("2026-07-15"),
      expiresAt: new Date("2026-07-15"),
    },
  });
  await prisma.promoBatch.create({
    data: {
      advertiserId: tbank.id,
      dealId: dealTbankAds.id,
      mechanic: "Acquisition",
      nominal: 500,
      qty: 1000,
      vatOnUsed: true,
      delayHours: 12,
      monetization: "Деньги",
      validFrom: new Date("2026-07-01"),
      validTo: new Date("2026-09-30"),
      commercialTerms: "Выдача при регистрации в клубе.",
      settlement: "Взаиморасчёт по факту использованных (+22% НДС), учёт через УПД.",
      notes: "Отсрочка выдачи ≥12 ч.",
    },
  });
  await prisma.promoBatch.create({
    data: {
      advertiserId: maccoffee.id,
      mechanic: "Performance",
      nominal: 300,
      qty: 500,
      vatOnUsed: true,
      delayHours: 24,
      monetization: "Бартер",
      commercialTerms: "Бартер: продукция MacCoffee в клубы.",
      settlement: "Бартерный акт.",
    },
  });

  // ── Клиенты агентства (Киберадверт = агентство) ────────────────────────────
  console.log("🏛 Клиенты агентства…");
  await prisma.agencyClient.createMany({
    data: [
      { advertiserId: kiberadvert.id, name: "Т2", brand: "MIXX Play Pro", notes: "Спецификации №3–4." },
      { advertiserId: kiberadvert.id, name: "ОККО", brand: "OKKO", notes: "Спецификации №5–6." },
    ],
  });

  // ── Финансовый календарь: плановые платежи по месяцам ──────────────────────
  console.log("📅 Плановые платежи…");
  await prisma.deal.update({ where: { id: dealAlabuga.id }, data: { contractTotal: 9_955_200 } });
  const alabugaMonthly = 1_659_200;
  const alabugaMonths = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];
  await prisma.plannedPayment.createMany({
    data: alabugaMonths.map((m, i) => ({
      advertiserId: alabuga.id,
      dealId: dealAlabuga.id,
      periodMonth: m,
      amount: alabugaMonthly,
      status: i === 0 ? "Оплачено" : "План",
      note: i === 0 ? "Предоплата за первый месяц" : undefined,
    })),
  });
  await prisma.plannedPayment.create({
    data: { advertiserId: mts.id, dealId: dealMts.id, periodMonth: "2026-07", amount: 7_979_200, status: "Оплачено", note: "Предоплата 40%" },
  });
  await prisma.plannedPayment.create({
    data: { advertiserId: mts.id, dealId: dealMts.id, periodMonth: "2026-08", amount: 5_984_400, status: "План" },
  });
  await prisma.plannedPayment.create({
    data: { advertiserId: samokat.id, dealId: dealSamokat.id, periodMonth: "2026-06", amount: 2_440_000, status: "Оплачено", note: "CF2026" },
  });

  // ── Календарь размещений (брони) ────────────────────────────────────────────
  console.log("🗓 Размещения…");
  await prisma.placement.createMany({
    data: [
      { advertiserId: mts.id, dealId: dealMts.id, title: "МТС — заставки на ПК", channel: "Заставки на свободных ПК", startDate: new Date("2026-08-01"), endDate: new Date("2026-08-31"), status: "Забронировано" },
      { advertiserId: alabuga.id, dealId: dealAlabuga.id, title: "Алабуга — баннер в ЛК", channel: "Баннер в ЛК", startDate: new Date("2026-07-01"), endDate: new Date("2026-12-31"), status: "Активно" },
      { advertiserId: kiberadvert.id, dealId: dealKiberadvert.id, title: "Киберадверт — посты Т2", channel: "Соцсети", startDate: new Date("2026-06-20"), endDate: new Date("2026-07-20"), status: "Активно" },
      { advertiserId: samokat.id, dealId: dealSamokat.id, title: "Самокат — CF2026", channel: "Фестиваль", startDate: new Date("2026-06-21"), endDate: new Date("2026-06-21"), status: "Завершено" },
    ],
  });

  // ── Ежедневные статусы (для «Сегодня» → недельный отчёт) ────────────────────
  console.log("📝 Ежедневные статусы…");
  await prisma.dailyStatus.createMany({
    data: [
      { advertiserId: mts.id, dealId: dealMts.id, text: "Получили предоплату 40% по Приложению №1, двигаем к размещению.", authorId: owner.id, date: new Date("2026-07-14") },
      { advertiserId: alabuga.id, dealId: dealAlabuga.id, text: "Готовим ДС на уточнение суммы. Размещение идёт.", authorId: owner.id, date: new Date("2026-07-14") },
      { advertiserId: tbank.id, dealId: dealTbankAds.id, text: "Ждём подписания Приложения №1, дизайн на согласовании.", authorId: manager.id, date: new Date("2026-07-14") },
    ],
  });

  // ── Задачи ─────────────────────────────────────────────────────────────────
  console.log("✅ Задачи…");
  await prisma.task.createMany({
    data: [
      { dealId: dealTbankAds.id, advertiserId: tbank.id, title: "Согласовать макеты Приложения №1", kind: "Дизайн", assigneeId: manager.id, status: "В работе" },
      { dealId: dealMts.id, advertiserId: mts.id, title: "Согласовать схему оплаты с закупщиком", kind: "Менеджер", assigneeId: owner.id, status: "Ждёт" },
      { dealId: dealAlabuga.id, advertiserId: alabuga.id, title: "Оформить ДС на уточнение суммы", kind: "Юрист", status: "Открыта" },
      { dealId: dealKiberadvert.id, advertiserId: kiberadvert.id, title: "Ежемесячное закрытие актов по маркировке", kind: "ОРД", assigneeId: manager.id, status: "Открыта" },
      { dealId: dealSamokat.id, advertiserId: samokat.id, title: "Закрыть УПД через ИП Сараева", kind: "Бухгалтерия", status: "Открыта" },
    ],
  });

  // ── Документы с версиями (демо версионирования) ────────────────────────────
  console.log("📄 Документы и версии…");
  await seedDocumentWithVersions(alabuga.id, dealAlabuga.id, "Договор Алабуга (10/06/2026-РИМ)", "Договор", [
    { note: "первая редакция", fileName: "Договор_Алабуга_проект.txt", body: "ДОГОВОР 10/06/2026-РИМ\nАО «ОЭЗ ППТ Алабуга»\nСумма: 9 955 200 ₽ с НДС 22% (проект)." },
    { note: "комментарии УК 12.07", fileName: "Договор_Алабуга_комментарии_УК_12.07.txt", body: "ДОГОВОР 10/06/2026-РИМ (комментарии УК от 12.07)\nПравки только через ДС." },
    { note: "к подписанию", fileName: "Договор_Алабуга_к_подписанию.txt", body: "ДОГОВОР 10/06/2026-РИМ / ОЭЗ-12426/26 от 13.07.2026\nФИНАЛ, к подписанию." },
  ]);

  await seedDocumentWithVersions(mts.id, dealMts.id, "Медиаплан МТС v.7", "Медиаплан", [
    { note: "v.6", fileName: "МП_МТС_v6.txt", body: "Медиаплан МТС v.6\nБез НДС: 23 078 000." },
    { note: "v.7 со скидкой", fileName: "МП_МТС_v7.txt", body: "Медиаплан МТС v.7\nСо скидкой: 19 948 000 без НДС." },
  ]);

  await seedDocumentWithVersions(tbank.id, dealTbankAds.id, "Приложение №1 (Т-Банк)", "Приложение", [
    { note: "на согласовании", fileName: "Приложение_1_Тбанк.txt", body: "Приложение №1 к Договору Т-Банк\nФорматы: баннер в ЛК, заставки на ПК." },
  ]);

  // ── База знаний (перенос разделов, блупринт 15) ────────────────────────────
  console.log("📚 База знаний…");
  await seedKnowledge();

  // ── Дневной журнал (пример записи) ─────────────────────────────────────────
  await prisma.journalEntry.create({
    data: {
      source: "EOD",
      routedTo: "Трекер",
      rawText:
        "EOD 14.07: МТС — получили предоплату 40% по Прил.1, двигаем к размещению. Алабуга — готовим ДС на уточнение суммы. Т-Банк — ждём подписания Приложения №1.",
      parsedSummary: "МТС → оплата получена; Алабуга → ДС; Т-Банк → приложение на согласовании.",
      linkedDealIds: JSON.stringify([dealMts.id, dealAlabuga.id, dealTbankAds.id]),
    },
  });

  console.log("✅ Готово. Аккаунты:");
  console.log(`   Owner:   ${owner.email} / ${process.env.SEED_OWNER_PASSWORD ?? "colizeum"}`);
  console.log(`   Manager: ${manager.email} / ${process.env.SEED_MANAGER_PASSWORD ?? "colizeum"}`);
}

// Создаёт логический документ и его версии (с реальными файлами в хранилище).
async function seedDocumentWithVersions(
  advertiserId: string,
  dealId: string,
  title: string,
  type: string,
  versions: { note: string; fileName: string; body: string }[],
) {
  const doc = await prisma.document.create({ data: { advertiserId, dealId, type, title } });
  let currentId = "";
  for (let i = 0; i < versions.length; i++) {
    const v = versions[i];
    const meta = writeVersionFile(advertiserId, doc.id, i + 1, v.fileName, v.body);
    const created = await prisma.documentVersion.create({
      data: { documentId: doc.id, versionNo: i + 1, changeNote: v.note, ...meta },
    });
    currentId = created.id;
  }
  await prisma.document.update({ where: { id: doc.id }, data: { currentVersionId: currentId } });
}

async function seedKnowledge() {
  const MC = "Материалы для клиента";
  const articles: { category: string; title: string; bodyMarkdown: string; notes?: string }[] = [
    // ── Материалы, которые отправляются рекламодателю (ТЗ, раздел 7) ──────────
    {
      category: MC,
      title: "Медиакит",
      bodyMarkdown: [
        "Презентация сети COLIZEUM для рекламодателей: аудитория, форматы, охваты, кейсы.",
        "",
        "- Сеть ~600 клубов (прогноз ~700 к концу 2026).",
        "- Ядро аудитории 18–24 = 59%.",
        "- Форматы: баннер в ЛК, заставки на ПК, TV, виджеты.",
      ].join("\n"),
      notes: "📎 Прикрепить актуальный файл медиакита (PDF/презентация).",
    },
    {
      category: MC,
      title: "Шаблоны медиаплана (клиентский и агентский)",
      bodyMarkdown: [
        "Два шаблона МП:",
        "- **Клиентский** — для прямых рекламодателей.",
        "- **Агентский** — с указанием конечного клиента (модель Киберадверт).",
        "",
        "Строки: формат, объём, период, цена, охват, сумма с НДС.",
      ].join("\n"),
      notes: "📎 Прикрепить актуальные xlsx-шаблоны (клиентский + агентский).",
    },
    {
      category: MC,
      title: "Учредительные документы",
      bodyMarkdown: "Устав, ОГРН, свидетельства ООО «УК КОЛИЗЕУМ» — пакет для контрагента.",
      notes: "📎 Прикрепить актуальный пакет учредительных документов.",
    },
    {
      category: MC,
      title: "Исследование аудитории",
      bodyMarkdown: [
        "Данные по аудитории сети для обоснования размещения.",
        "",
        "- Возраст 18–24 = 59%.",
        "- CTR по типам креатива: 0,3–3%.",
        "- Аналитика: SuperSet, Appmetrica.",
      ].join("\n"),
      notes: "📎 Прикрепить актуальное исследование (презентация/отчёт).",
    },
    {
      category: MC,
      title: "Технические требования к макетам",
      bodyMarkdown: [
        "| Формат | Размер |",
        "| --- | --- |",
        "| Баннер в ЛК | 766×473 |",
        "| Виджет на раб. столе | 1920×1080 |",
        "| Заставки на ПК | 1920×1080 |",
        "| TV 65 | 1920×1080 |",
        "| X-Coin слот | 520×208 |",
        "",
        "⚠️ Размеры баннеров моб. приложения в источниках расходятся (1080×372 / 960×372 / 520×208) — сверять перед отправкой.",
      ].join("\n"),
      notes: "📎 Прикрепить актуальные техтребования (PDF).",
    },
    {
      category: MC,
      title: "Шаблон рамки договора",
      bodyMarkdown: "Типовая рамка договора (конструкции A/B/C/D — см. «Кейсы»). ДС — механизм правок.",
      notes: "📎 Прикрепить актуальный шаблон рамки договора (docx).",
    },
    {
      category: MC,
      title: "Карточка компании",
      bodyMarkdown: [
        "Реквизиты ООО «УК КОЛИЗЕУМ» одним листом (для отправки контрагенту).",
        "",
        "ИНН 9713021000 · КПП 771301001 · ОГРН 1247700716394.",
        "АО «АЛЬФА-БАНК», р/с 40702810201300048430, к/с 30101810200000000593, БИК 044525593.",
        "См. полную статью в разделе «Профиль».",
      ].join("\n"),
      notes: "📎 Прикрепить актуальную карточку компании (PDF).",
    },
    {
      category: "Профиль",
      title: "Реквизиты УК Колизеум (наша сторона)",
      bodyMarkdown: [
        "**ООО «УК КОЛИЗЕУМ»**, Исполнитель.",
        "",
        "| Поле | Значение |",
        "| --- | --- |",
        "| ИНН | 9713021000 |",
        "| КПП | 771301001 |",
        "| ОГРН | 1247700716394 |",
        "| Адрес | 127247, Москва, Дмитровское ш., д. 100, помещ. 2/7 |",
        "| Банк | АО «АЛЬФА-БАНК», к/с 30101810200000000593, БИК 044525593 |",
        "| Р/с основной | 40702810201300048430 |",
        "| Р/с Самокат-fest | 40702810101300055743 ⚠️ |",
        "| Ген. директор | Магдеев Ринат Рамильевич |",
        "| ЭДО | 2AE37859A4D-653F-42B6-8048-0B9688E47660 |",
        "| e-mail | info@colizeumarena.com, домены @colizeum.ru |",
      ].join("\n"),
      notes: "⚠️ Актуальный р/с под конкретный договор — выверять.",
    },
    {
      category: "Форматы",
      title: "Рекламные форматы и точные наименования",
      bodyMarkdown: [
        "| Формат | Размер | Примечание |",
        "| --- | --- | --- |",
        "| Баннер в личном кабинете | 766×473 | ЛК в CLS |",
        "| Кликабельный виджет на раб. столе | 1920×1080 | |",
        "| Заставки на свободных ПК | 1920×1080 | |",
        "| Реклама на TV 65 | 1920×1080 | |",
        "| X-Coin слот | 520×208 | не заменяется |",
        "",
        "Ротация ≥1,5 раз/мин, показ 5–7 сек, ~10 баннеров в ротации.",
        "Сеть ~600 клубов (прогноз ~700 к концу 2026).",
        "",
        "⚠️ Размеры баннеров моб. приложения в источниках расходятся (1080×372 / 960×372 / 520×208) — сверять перед отправкой макетов.",
      ].join("\n"),
    },
    {
      category: "Цены/скидки",
      title: "Пакеты и скидки",
      bodyMarkdown: [
        "- Пакеты: **стандарт** / **продвинутый**.",
        "- MacCoffee — скидка **15%**.",
        "- Киберадверт — типовая цена поста **195 200 ₽ с НДС**, сплит-оплата.",
        "- НДС: 2026 → **22%**, 2025 → 20% (по дате документа).",
      ].join("\n"),
    },
    {
      category: "Условия и согласование",
      title: "Маршрут согласования договора",
      bodyMarkdown: [
        "**Юрист (Екатерина) → Главбух (Ольга) → СЕО (через Сашу)** — если сумма > 3 млн ИЛИ нестандартный договор.",
        "",
        "До 3 млн и классический — уходит клиенту сразу.",
        "",
        "Сервис показывает следующий шаг маршрута по сумме и типу.",
      ].join("\n"),
    },
    {
      category: "ОРД",
      title: "Маркировка ЕРИД / ОРД",
      bodyMarkdown: [
        "- Для интернет-размещений: роль (**рекламораспространитель / рекламодатель / агентство**), при агентстве — конечный заказчик.",
        "- В договорах с маркировкой **акты закрываются каждый месяц**.",
        "- Посты живут **до 1 месяца**.",
        "- Вывод ЕРИД ведётся в Aspro.",
      ].join("\n"),
    },
    {
      category: "Промокоды",
      title: "Промокоды: механики, налоги, ограничения",
      bodyMarkdown: [
        "- Механики: **Performance** / **Acquisition**.",
        "- Отсрочка выдачи **≥ 12 часов**.",
        "- Монетизация: деньги / бартер.",
        "- Налог: **+22% НДС на использованные** промокоды.",
        "- Учёт передачи партии — через **УПД**.",
      ].join("\n"),
    },
    {
      category: "CRM-правила",
      title: "Правила ведения CRM",
      bodyMarkdown: [
        "- Карточку рекламодателя заводим при **первом касании**.",
        "- Подрядчиков **не вносим**.",
        "- Тип — это тег (Рекламодатель / Агентство / Арендатор / Кросс-промо).",
        "- Период сделки храним как **срок/текст**, а не жёсткие даты.",
      ].join("\n"),
    },
    {
      category: "Бенчмарки",
      title: "Бенчмарки и аудитория",
      bodyMarkdown: [
        "- CTR: **0,3–3%** по типу креатива.",
        "- Возраст 18–24 = **59%** аудитории.",
        "- Аналитика: SuperSet, Appmetrica.",
      ].join("\n"),
    },
    {
      category: "Финансы/документооборот",
      title: "Финансовая цепочка закрытия",
      bodyMarkdown: [
        "**Счёт → Платёжное поручение → УПД → Отчёт → Акт сверки.**",
        "",
        "- Матчинг «счёт ↔ УПД» — по номеру приложения.",
        "- УПД статус 1 = счёт-фактура + акт передачи.",
        "- Первичный отчёт об оказанных услугах — за 5 рабочих дней (форматы, период, стоимость с НДС, скриншоты и фото из клубов).",
        "- ⚠️ Контроль актуального р/с: основной …48430 vs Самокат-fest …55743.",
      ].join("\n"),
    },
    {
      category: "Платежи/интеграции",
      title: "Подключение эквайринга (франчайзи)",
      bodyMarkdown: [
        "1. Банк даёт условия СБП/торгового эквайринга.",
        "2. Выделяется менеджер и канал под COLIZEUM.",
        "3. Открывается счёт, выдаётся API-токен.",
        "4. Партнёр обращается в техподдержку.",
        "5. ИТ-отдел получает токен и настраивает онлайн-оплату.",
        "",
        "Обкатка — на клубе под УК (**КиберАрена Шелепиха**), без франчайзи.",
        "**Блокер:** платежи по клубу на ИП нельзя через счёт УК — нужен отдельный счёт под ИП клуба.",
      ].join("\n"),
    },
    {
      category: "Кейсы",
      title: "Конструкции договоров (справочник)",
      bodyMarkdown: [
        "| Код | Конструкция | Пример |",
        "| --- | --- | --- |",
        "| A | Рамочный + Заказы | МТС |",
        "| B | На мероприятие + Приложения | Алабуга, Самокат |",
        "| C | Рамочный РИМ + Спецификации | Киберадверт |",
        "| D | Разовый | МФ1 |",
        "",
        "**ДС** — механизм правок без переподписания тела договора.",
      ].join("\n"),
    },
    {
      category: "Отчётность",
      title: "Типовые блокеры",
      bodyMarkdown: [
        "- Приложения Т-Банка — строго по очереди.",
        "- Правки после подписания у клиентов без права правки тела → ДС (Алабуга).",
        "- Платежи по клубу на ИП — только через отдельный счёт ИП.",
        "- Размещение стартует только после предоплаты по её схеме (МТС 40%, Алабуга — за первый месяц, типовое 100%).",
        "- Смена ИП на клубе сдвигает интеграцию эквайринга.",
      ].join("\n"),
    },
  ];

  for (const a of articles) {
    await prisma.knowledgeArticle.create({ data: a });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
