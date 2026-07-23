/**
 * Сид первичного наполнения — редакция v2 (пакет изменений владельца).
 * Запуск: npm run db:seed (или npm run setup). Идемпотентен.
 *
 * 5 активных проектов (раздел 2), Архив (п.1.6), база знаний (разделы 3.1–3.15).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const STORAGE_DIR = process.env.STORAGE_LOCAL_DIR ?? "./storage";
const hash = (p: string) => bcrypt.hashSync(p, 10);
const sanitize = (n: string) =>
  n.replace(/[/\\]/g, "_").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 200) || "file";

function writeVersionFile(advertiserId: string, documentId: string, v: number, fileName: string, content: string) {
  const key = `advertisers/${advertiserId}/documents/${documentId}/v${v}/${sanitize(fileName)}`;
  const full = path.resolve(process.cwd(), STORAGE_DIR, key);
  mkdirSync(path.dirname(full), { recursive: true });
  const buf = Buffer.from(content, "utf-8");
  writeFileSync(full, buf);
  return { storageKey: key, fileName, mimeType: "text/plain", sizeBytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") };
}

async function seedDoc(advertiserId: string, dealId: string, title: string, type: string, versions: { note: string; fileName: string; body: string }[]) {
  const doc = await prisma.document.create({ data: { advertiserId, dealId, type, title } });
  let currentId = "";
  for (let i = 0; i < versions.length; i++) {
    const meta = writeVersionFile(advertiserId, doc.id, i + 1, versions[i].fileName, versions[i].body);
    const created = await prisma.documentVersion.create({ data: { documentId: doc.id, versionNo: i + 1, changeNote: versions[i].note, ...meta } });
    currentId = created.id;
  }
  await prisma.document.update({ where: { id: doc.id }, data: { currentVersionId: currentId } });
}

async function main() {
  console.log("🌱 Очистка…");
  await prisma.creative.deleteMany();
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

  console.log("👤 Пользователи…");
  // Отдел коллабораций: админ (он же менеджер) + 2 менеджера + руководитель.
  const owner = await prisma.user.create({
    data: { email: (process.env.SEED_OWNER_EMAIL ?? "owner@colizeum.ru").toLowerCase(), name: "Артур Фирстов", role: "Owner", passwordHash: hash(process.env.SEED_OWNER_PASSWORD ?? "colizeum") },
  });
  const manager = await prisma.user.create({
    data: { email: (process.env.SEED_MANAGER_EMAIL ?? "manager@colizeum.ru").toLowerCase(), name: "Младший менеджер", role: "Manager", passwordHash: hash(process.env.SEED_MANAGER_PASSWORD ?? "colizeum") },
  });
  await prisma.user.create({
    data: { email: "manager2@colizeum.ru", name: "Марина Янюк", role: "Manager", passwordHash: hash("colizeum") },
  });
  await prisma.user.create({
    data: { email: "boss@colizeum.ru", name: "Руководитель отдела", role: "Director", passwordHash: hash("colizeum") },
  });

  // ── Директория людей (v2, п.3.13) ──────────────────────────────────────────
  console.log("🧑‍💼 Люди…");
  await prisma.person.createMany({
    data: [
      { role: "Юрист — договоры", name: "Екатерина", scope: "маршрут: юрист → главбух" },
      { role: "Главный бухгалтер", name: "Ольга", scope: "финансы, календарь оплат" },
      { role: "Арт-директор", name: "Милана Умерова", scope: "креативы (внутр. апрув авто)" },
      { role: "Директор по маркетингу", name: "Рома Измайлов", telegram: "@izovsehsil13", scope: "⚠️ хендл выверить" },
      { role: "Баннер-менеджер", name: "Милана", telegram: "@melscrim", scope: "скрины для отчётов ⚠️ две «Миланы»" },
      { role: "Проект-менеджер", name: "❓", scope: "фотоотчёты" },
      { role: "Юрист ОРД (аутсорс)", name: "❓", scope: "ERID-токены, квартальная сводка" },
      { role: "Управляющий клуба (Шелепиха)", name: "Марат", telegram: "@PM_Marat_Colizeum", scope: "обкатка эквайринга" },
    ],
  });

  // ── 5 активных проектов (раздел 2) ─────────────────────────────────────────
  console.log("🏢 Активные проекты…");

  // 2.1 Т-Банк — основная интеграция
  const tbankMain = await prisma.advertiser.create({
    data: {
      nameRu: "Т-Банк — основная интеграция", legalEntity: "АО «ТБанк»", type: "Рекламодатель", status: "Активный",
      goals: "Основная рекламная интеграция в клубах.",
      notes: "Тип: прямой, на бумаге клиента. Приложения согласуются строго последовательно через бухгалтерию клиента. Сопутствующее: NDA на ПДн, письма-согласия, договор адаптации ПО.",
      signatory: "Парамонов Д.С. (МЧД)",
      contacts: { create: [{ fio: "Парамонов Д.С.", role: "Подписант (МЧД)", isPrimary: true }] },
    },
  });
  const dealTbankMain = await prisma.deal.create({
    data: {
      advertiserId: tbankMain.id, title: "Т-Банк — основная интеграция", dealType: "прямой",
      contractConstruction: "A", stage: "Приложение / спец.", urgency: "Средняя",
      amount: 17_400_000, vatIncluded: false, contractTotal: 17_400_000,
      contractNumber: "Т-ЦСД-ТО-156-2026 от 15.06.2026", legalResponsible: "Екатерина", ownerId: owner.id,
      nextStep: "Согласовать Приложение №1 через бухгалтерию клиента.",
      situational: "Приложения строго последовательно. Ждём NDA на ПДн, письма-согласия, договор адаптации ПО.",
      notes: "17,4 млн ₽ без НДС (НДС 22% сверху), 2 приложения.",
    },
  });
  await prisma.creative.createMany({
    data: [
      { advertiserId: tbankMain.id, dealId: dealTbankMain.id, title: "«Т — в твоей игре» — квадрат", size: "1080×1080", status: "На согласовании" },
      { advertiserId: tbankMain.id, dealId: dealTbankMain.id, title: "«Т — в твоей игре» — экран (QR/кнопка)", size: "1920×1080", status: "На согласовании" },
      { advertiserId: tbankMain.id, dealId: dealTbankMain.id, title: "Баннер в ЛК", size: "766×473", status: "В работе" },
      { advertiserId: tbankMain.id, dealId: dealTbankMain.id, title: "Баннер в мобильном приложении", size: "960×372", status: "В работе" },
      { advertiserId: tbankMain.id, dealId: dealTbankMain.id, title: "Merch T-Pay × Colizeum", status: "В работе" },
    ],
  });

  // 2.2 Т-Банк — эквайринг T-Pay + ЕББ
  const tbankPay = await prisma.advertiser.create({
    data: {
      nameRu: "Т-Банк — эквайринг T-Pay + ЕББ", legalEntity: "АО «ТБанк»", type: "Рекламодатель", status: "Активный",
      goals: "Технический трек: эквайринг T-Pay + единый бонусный баланс (ЕББ) через Langame.",
      notes: "ЕББ — единый бонусный баланс: компенсация «кэшбека» бонусами на игровой баланс за оплату картой Т-Банка. Обкатка эквайринга — КиберАрена Шелепиха (клуб под УК, без франчайзи). Ждём КП по эквайрингу и контакты банка.",
    },
  });
  await prisma.deal.create({
    data: {
      advertiserId: tbankPay.id, title: "Т-Банк — эквайринг T-Pay + ЕББ", dealType: "технический",
      stage: "Договор", urgency: "Средняя", legalResponsible: "Екатерина", ownerId: owner.id,
      nextStep: "Получить условия банка → API-токен → ИТ настраивает онлайн-оплату (обкатка Шелепиха).",
      situational: "Ждём КП по эквайрингу и контакты банка.",
      notes: "Разрабатывается отдельным треком на уровне Langame.",
    },
  });

  // 2.3 МТС Оплата (ООО «МРБ»)
  const mtsPay = await prisma.advertiser.create({
    data: {
      nameRu: "МТС Оплата", legalEntity: "ООО «Мурманский расчётный банк» (МРБ)", type: "Рекламодатель", status: "Активный",
      goals: "Рост пополнений Steam без комиссии по промокоду COLIZEUM.",
      notes: "Бренд «МТС Оплата». НЕ путать с ПАО «МТС» — разные юрлица и проекты.",
    },
  });
  const dealMtsPay = await prisma.deal.create({
    data: {
      advertiserId: mtsPay.id, title: "МТС Оплата — размещение", dealType: "прямой", finalBrand: "МТС Оплата",
      contractConstruction: "A", stage: "Договор", urgency: "Высокая",
      amount: 16_644_174, vatIncluded: true, contractTotal: 16_644_174,
      contractNumber: "❓/06/2026-РИМ от 08.06.2026", ownerId: owner.id,
      paymentTerms: "Предоплата 40% + 3 платежа: декабрь 2026, январь 2027, февраль 2027 (утверждено).",
      nextStep: "Подписание → печать 150 ковриков.",
      situational: "Коврики (150, Шелепиха) — в печать только после подписания.",
      notes: "Клубы+коврики 14 021 174 + интернет 2 623 000 = 16 644 174 ₽ с НДС.",
    },
  });
  await prisma.creative.createMany({
    data: [
      { advertiserId: mtsPay.id, dealId: dealMtsPay.id, title: "Баннеры на экраны", size: "1920×1080", status: "В работе" },
      { advertiserId: mtsPay.id, dealId: dealMtsPay.id, title: "Ярлык ПК + виджет", status: "В работе" },
      { advertiserId: mtsPay.id, dealId: dealMtsPay.id, title: "Пуши + ТГ + кнопка пополнения Steam", status: "В работе" },
      { advertiserId: mtsPay.id, dealId: dealMtsPay.id, title: "150 ковриков (кастом, Шелепиха)", status: "В работе", notes: "В печать только после подписания." },
    ],
  });

  // 2.4 МТС (ПАО)
  const mtsPao = await prisma.advertiser.create({
    data: {
      nameRu: "МТС (ПАО)", legalEntity: "ПАО «МТС»", inn: "7740000076", kpp: "770901001", type: "Рекламодатель", status: "Активный",
      goals: "Рамочная модель с заказами (специфика клиента).",
      notes: "Номер D260183187; подписант Белоусова Н.А. (МЧД); претензии pretbuz@mts.ru. ⚠️ КПП МТС (ПАО) разный в документах: 770901001 / 997750001 — сверять по документу.",
    },
  });
  const dealMtsPao = await prisma.deal.create({
    data: {
      advertiserId: mtsPao.id, title: "МТС (ПАО) — рамочный + заказы", dealType: "прямой",
      contractConstruction: "E", stage: "Договор", urgency: "Средняя",
      contractNumber: "D260183187", legalResponsible: "Екатерина", ownerId: owner.id,
      nextStep: "Юрист вносит правки в договор тестирования.",
      situational: "Треки: договор тестирования (форма согласована учредителем, правки юриста); договор по закупке (другой юрист); концессия/пилот — расширенное NDA (Салон + Киберклуб).",
    },
  });

  // 2.5 Алабуга
  const alabuga = await prisma.advertiser.create({
    data: {
      nameRu: "Алабуга", legalEntity: "АО «ОЭЗ ППТ «Алабуга»", type: "Рекламодатель", status: "Активный",
      goals: "6-мес. продвинутый пакет; ВК-посты с маркировкой, пуши, брендинг календаря на 2 мес.",
      notes: "Договор 10/06/2026-РИМ → их номер ОЭЗ-12426/26 от 13.07.2026; подписанты Морозов М.Ю. + Курылёва Е.А. Регламент клиента → изменения только через ДС. ⚠️ Алабуга: канон суммы 9 955 200 ₽; в старых текстах опечатки 9 995 200 / 9 555 200 — проследить в финальном ДС.",
      signatory: "Морозов М.Ю. + Курылёва Е.А.",
    },
  });
  const dealAlabuga = await prisma.deal.create({
    data: {
      advertiserId: alabuga.id, title: "Алабуга — размещение (ОЭЗ-12426/26)", dealType: "прямой",
      contractConstruction: "D", stage: "Договор", urgency: "Максимальная",
      amount: 9_955_200, vatIncluded: true, contractTotal: 9_955_200,
      contractNumber: "10/06/2026-РИМ / ОЭЗ-12426/26 от 13.07.2026", legalResponsible: "Екатерина", ownerId: owner.id,
      paymentTerms: "Предоплата 1 659 200 + ежемесячно до 10 числа по 1 659 200 (6 мес).",
      nextStep: "Подписать ДС на уменьшение стоимости.",
      situational: "Юрист готовит ДС на уменьшение стоимости. Отчётность: фотоотчёты + скрины ежемесячно.",
      notes: "9 955 200 ₽ с НДС 22% (= 1 659 200 × 6).",
    },
  });
  await prisma.creative.createMany({
    data: [
      { advertiserId: alabuga.id, dealId: dealAlabuga.id, title: "ВК-посты (с маркировкой)", status: "На согласовании" },
      { advertiserId: alabuga.id, dealId: dealAlabuga.id, title: "Пуши в приложении", status: "В работе" },
      { advertiserId: alabuga.id, dealId: dealAlabuga.id, title: "Брендинг турнирного календаря (2 мес)", status: "В работе" },
    ],
  });

  // ── Архив (v2, п.1.6) ──────────────────────────────────────────────────────
  console.log("🗄 Архив…");
  const archived = [
    { nameRu: "Т-Банк Fest", legalEntity: "АО «ТБанк»", type: "Рекламодатель", notes: "CF2026-трек, закрывается — в проекте не учитывать." },
    { nameRu: "Банка Пэй", legalEntity: "ООО «ПС-Консалт»", type: "Рекламодатель", notes: "Off-boarding завершён." },
    { nameRu: "Самокат", legalEntity: "ООО «Умный ритейл»", type: "Рекламодатель", notes: "Партнёр CF2026 — фестиваль прошёл." },
    { nameRu: "Киберадверт", legalEntity: "ООО «КИБЕРАДВЕРТ»", type: "Агентство", notes: "Завершённые спецификации №3–6." },
    { nameRu: "Амбитика", type: "Агентство", notes: "Проект Flowwow — завершён." },
    { nameRu: "MacCoffee", type: "Рекламодатель", notes: "Разовый — завершён." },
    { nameRu: "Пицца Суши Вок", type: "Рекламодатель", notes: "Разовый — завершён." },
  ];
  for (const a of archived) {
    await prisma.advertiser.create({ data: { ...a, archived: true, status: "Архив" } });
  }
  const samokat = await prisma.advertiser.findFirst({ where: { nameRu: "Самокат" } });
  const maccoffee = await prisma.advertiser.findFirst({ where: { nameRu: "MacCoffee" } });

  // ── Финансы: помесячный календарь платежей ─────────────────────────────────
  console.log("💰 Финансы…");
  const alMonths = ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"];
  await prisma.plannedPayment.createMany({
    data: alMonths.map((m, i) => ({ advertiserId: alabuga.id, dealId: dealAlabuga.id, periodMonth: m, amount: 1_659_200, status: i === 0 ? "Оплачено" : "План", note: i === 0 ? "Предоплата за первый месяц" : "до 10 числа" })),
  });
  await prisma.plannedPayment.createMany({
    data: [
      { advertiserId: mtsPay.id, dealId: dealMtsPay.id, periodMonth: "2026-11", amount: 6_657_670, status: "План", note: "Предоплата 40%" },
      { advertiserId: mtsPay.id, dealId: dealMtsPay.id, periodMonth: "2026-12", amount: 3_328_835, status: "План" },
      { advertiserId: mtsPay.id, dealId: dealMtsPay.id, periodMonth: "2027-01", amount: 3_328_835, status: "План" },
      { advertiserId: mtsPay.id, dealId: dealMtsPay.id, periodMonth: "2027-02", amount: 3_328_834, status: "План" },
    ],
  });

  // ── ОРД (только интернет-форматы) ──────────────────────────────────────────
  console.log("❖ ОРД…");
  await prisma.ordMarking.create({
    data: { dealId: dealAlabuga.id, role: "Рекламораспространитель", platform: "посты VK/TG", status: "Активна", monthlyClosing: true, markedAt: new Date("2026-07-10") },
  });
  await prisma.ordMarking.create({
    data: { dealId: dealMtsPay.id, role: "Рекламораспространитель", platform: "баннер в МП / пуши", status: "Активна", monthlyClosing: true, urgent: false },
  });

  // ── Промокоды (v2, п.3.11) ─────────────────────────────────────────────────
  console.log("% Промокоды…");
  await prisma.promoBatch.create({
    data: { advertiserId: mtsPao.id, dealId: dealMtsPao.id, mechanic: "Acquisition", nominal: 700, qty: 1, monetization: "Деньги", commercialTerms: "Единый код 700 ₽ за первый визит/действие.", settlement: "УПД при передаче за плату." },
  });
  await prisma.promoBatch.create({
    data: { advertiserId: mtsPao.id, dealId: dealMtsPao.id, mechanic: "Performance", nominal: 700, qty: 30_000, vatOnUsed: true, monetization: "Деньги", commercialTerms: "30 000 платных кодов 500/700/2000 ₽ за целевые действия.", settlement: "Поквартальная сверка активаций; УПД по номиналу×количеству на дату передачи." },
  });

  // ── Задачи ─────────────────────────────────────────────────────────────────
  console.log("✅ Задачи…");
  await prisma.task.createMany({
    data: [
      { dealId: dealAlabuga.id, advertiserId: alabuga.id, title: "Оформить ДС на уменьшение стоимости", kind: "Юрист", status: "В работе", side: "Мы" },
      { dealId: dealTbankMain.id, advertiserId: tbankMain.id, title: "Согласовать Приложение №1 через бухгалтерию", kind: "Менеджер", assigneeId: manager.id, status: "Ждёт", side: "Клиент", notes: "Приложение у бухгалтерии Т-Банка, обещали ответ до конца недели." },
      { dealId: dealMtsPay.id, advertiserId: mtsPay.id, title: "Подписание → печать 150 ковриков", kind: "Менеджер", status: "Ждёт", side: "Клиент", notes: "Ждём подписание договора со стороны МТС Оплаты — только после этого коврики в печать." },
      { dealId: dealMtsPao.id, advertiserId: mtsPao.id, title: "Правки в договор тестирования", kind: "Юрист", status: "Открыта", side: "Мы" },
    ],
  });

  // ── Документы (демо) ───────────────────────────────────────────────────────
  console.log("📄 Документы…");
  await seedDoc(alabuga.id, dealAlabuga.id, "Договор Алабуга (10/06/2026-РИМ)", "Договор", [
    { note: "проект", fileName: "Договор_Алабуга_проект.txt", body: "ДОГОВОР 10/06/2026-РИМ\nАО «ОЭЗ ППТ «Алабуга»\nСумма: 9 955 200 ₽ с НДС 22%." },
    { note: "к подписанию (ОЭЗ-12426/26)", fileName: "Договор_Алабуга_к_подписанию.txt", body: "ОЭЗ-12426/26 от 13.07.2026\nИзменения только через ДС." },
  ]);
  await seedDoc(tbankMain.id, dealTbankMain.id, "Приложение №1 (Т-Банк)", "Приложение", [
    { note: "на согласовании", fileName: "Приложение_1_Тбанк.txt", body: "Приложение №1 к договору Т-ЦСД-ТО-156-2026\nФорматы по МП." },
  ]);

  // ── Календарь размещений (по рабочей таблице) ──────────────────────────────
  console.log("🗓 Размещения…");
  const d = (s: string) => new Date(s);
  // Полный перенос строк из листа (gid=462204401). Статусы, которые из выгрузки
  // не видны (цвет ячейки), помечены «Ожидание» — сверить с таблицей.
  await prisma.placement.createMany({
    data: [
      // Стандартный пакет — слоты ПК ТВ + слайдер + ЛК
      { slot: "Слот 1 (ПК ТВ + слайдер + ЛК)", brandLabel: "VOLT", responsible: "Марина Янюк", startDate: d("2026-01-01"), endDate: d("2026-09-30"), status: "Подписан" },
      { slot: "Слот 2 (ПК ТВ + слайдер + ЛК)", advertiserId: mtsPao.id, dealId: dealMtsPao.id, responsible: "Марина / Катя", startDate: d("2026-07-01"), endDate: d("2026-12-31"), status: "На подписании" },
      { slot: "Слот 3 (ПК ТВ + слайдер + ЛК)", brandLabel: "Делимобиль", responsible: "Артур Фирстов", startDate: d("2026-06-08"), endDate: d("2026-09-14"), status: "На подписании" },
      { slot: "Слот 4 (ПК ТВ + слайдер + ЛК)", brandLabel: "GP", responsible: "Артур Фирстов", startDate: d("2026-08-01"), endDate: d("2026-08-31"), status: "Ожидание" },
      { slot: "Слот 4 (ПК ТВ + слайдер + ЛК)", brandLabel: "Эконива", responsible: "Артур Фирстов", startDate: d("2026-09-01"), endDate: d("2026-09-30"), status: "Ожидание" },
      { slot: "Слот 4 (ПК ТВ + слайдер + ЛК)", brandLabel: "Тиммейт × Пятёрочка × ГТА", responsible: "Артур Фирстов", startDate: d("2026-10-20"), endDate: d("2026-11-05"), status: "Ожидание" },
      { slot: "Слот 5 (ПК ТВ + слайдер + ЛК)", brandLabel: "М-видео?", responsible: "Артур / Катя", startDate: d("2026-08-01"), endDate: d("2026-12-31"), status: "Ожидание" },
      { slot: "Слот 6 (ПК ТВ + слайдер + ЛК)", brandLabel: "Самокат", responsible: "Артур Фирстов", startDate: d("2026-06-22"), endDate: d("2026-07-21"), status: "Подписан" },
      { slot: "Слот 6 (ПК ТВ + слайдер + ЛК)", brandLabel: "Фан Пэй?", responsible: "Артур Фирстов", startDate: d("2026-08-01"), endDate: d("2026-08-31"), status: "Ожидание" },
      { slot: "Слот 7 (ПК ТВ + слайдер + ЛК)", brandLabel: "БигБон", responsible: "Марина Янюк", startDate: d("2026-08-15"), endDate: d("2026-08-21"), status: "Ожидание" },
      { slot: "Слот 8 (ПК ТВ + слайдер + ЛК)", advertiserId: alabuga.id, dealId: dealAlabuga.id, responsible: "Катя Туринова", startDate: d("2026-08-01"), endDate: d("2027-01-31"), status: "Подписан" },
      { slot: "Слот 9 (ПК ТВ + слайдер + ЛК)", advertiserId: mtsPay.id, dealId: dealMtsPay.id, responsible: "Катя / Артур", startDate: d("2026-07-01"), endDate: d("2026-12-31"), status: "На подписании" },
      { slot: "Слот 10 (ПК ТВ + слайдер + ЛК)", advertiserId: tbankMain.id, dealId: dealTbankMain.id, responsible: "Марина", startDate: d("2026-08-01"), endDate: d("2026-12-31"), status: "На подписании" },
      // Турнирный календарь
      { slot: "Турнирный календарь", brandLabel: "Аван-маркет", startDate: d("2026-08-15"), endDate: d("2026-09-14"), status: "Ожидание" },
      { slot: "Турнирный календарь", brandLabel: "VOLT", startDate: d("2026-09-15"), endDate: d("2026-10-14"), status: "Подписан" },
      { slot: "Турнирный календарь", brandLabel: "Аван-маркет", startDate: d("2026-10-15"), endDate: d("2026-12-14"), status: "Ожидание" },
      // Мобильное приложение (брендинг)
      { slot: "Мобильное приложение (брендинг)", brandLabel: "Маккофе", startDate: d("2026-07-22"), endDate: d("2026-08-21"), status: "Ожидание" },
      { slot: "Мобильное приложение (брендинг)", brandLabel: "Горячая штучка", startDate: d("2026-11-01"), endDate: d("2026-12-31"), status: "Ожидание" },
      // Баннер в мобильном приложении — 4 слота
      { slot: "Слот 1 (Баннер в моб. приложении)", brandLabel: "Банка пэй", startDate: d("2026-01-01"), endDate: d("2026-06-07"), status: "Подписан" },
      { slot: "Слот 1 (Баннер в моб. приложении)", advertiserId: mtsPay.id, dealId: dealMtsPay.id, brandLabel: "МТС оплата", startDate: d("2026-06-08"), endDate: d("2026-12-31"), status: "Подписан" },
      { slot: "Слот 2 (Баннер в моб. приложении)", brandLabel: "VOLT", startDate: d("2026-01-01"), endDate: d("2026-10-31"), status: "Подписан" },
      { slot: "Слот 3 (Баннер в моб. приложении)", advertiserId: mtsPao.id, dealId: dealMtsPao.id, startDate: d("2026-07-01"), endDate: d("2026-12-31"), status: "На подписании" },
      { slot: "Слот 4 (Баннер в моб. приложении)", advertiserId: tbankMain.id, dealId: dealTbankMain.id, startDate: d("2026-08-01"), endDate: d("2026-12-31"), status: "На подписании" },
      // Доп форматы
      { slot: "Автозапуск в браузере — 1", brandLabel: "Winline", responsible: "Артур Фирстов", startDate: d("2026-01-01"), endDate: d("2026-06-15"), status: "Подписан" },
      { slot: "Автозапуск в браузере — 2", brandLabel: "Банка пэй", responsible: "Артур Фирстов", startDate: d("2026-01-01"), endDate: d("2026-11-30"), status: "Подписан" },
      { slot: "Ярлык на рабочем столе", brandLabel: "Банка пэй", responsible: "Артур Фирстов", startDate: d("2026-01-01"), endDate: d("2026-11-30"), status: "Подписан" },
    ],
  });

  // ── Ежедневные статусы ─────────────────────────────────────────────────────
  console.log("📝 Статусы дня…");
  await prisma.dailyStatus.createMany({
    data: [
      { advertiserId: alabuga.id, dealId: dealAlabuga.id, text: "Юрист готовит ДС на уменьшение стоимости, ждём финальную сумму.", authorId: owner.id, date: new Date() },
      { advertiserId: tbankMain.id, dealId: dealTbankMain.id, text: "Приложение №1 на согласовании у бухгалтерии клиента.", authorId: manager.id, date: new Date() },
      { advertiserId: mtsPay.id, dealId: dealMtsPay.id, text: "Ждём подписания, после — печать ковриков.", authorId: owner.id, date: new Date() },
    ],
  });

  // ── База знаний (v2, разделы 3.1–3.15) ─────────────────────────────────────
  console.log("📚 База знаний…");
  await seedKnowledge();

  // ── Журнал ─────────────────────────────────────────────────────────────────
  await prisma.journalEntry.create({
    data: { source: "EOD", routedTo: "Трекер", rawText: "EOD: Алабуга — ДС на уменьшение; Т-Банк — Приложение №1 на согласовании; МТС Оплата — ждём подписания.", parsedSummary: "Алабуга → ДС; Т-Банк → приложение; МТС Оплата → подписание." },
  });

  // Тестовая пустая карточка для проверки добавления (ТЗ р.2, п.5).
  await prisma.advertiser.create({ data: { nameRu: "ПиццаСушиВок", ownerId: owner.id } });

  // ── Бюджет отдела (демо, июль 2026, по рабочей таблице) ─────────────────────
  console.log("₽ Бюджет отдела…");
  await prisma.deptMonthBudget.create({ data: { month: "2026-07", plannedBudget: 120000 } });
  await prisma.deptIncome.createMany({
    data: [
      { month: "2026-07", source: "Реклама", w1: 2000000, w2: 1365000, w3: 4500000, w4: 5500000 },
      { month: "2026-07", source: "Корпоративные турниры", w1: 0, w2: 0, w3: 0, w4: 1500000 },
    ],
  });
  await prisma.deptExpense.createMany({
    data: [
      {
        month: "2026-07", title: "Застройка сцены от подрядчика (Т-Банк)", category: "Мероприятия",
        accountingSub: "Оплата поставщикам (Коллаборация)", periodicity: "Разовый", vatRate: 0,
        amountTotal: 80000, payFormat: "Безнал", payDate: d("2026-07-11"), deliveryDate: d("2026-07-20"),
        serviceEndDate: d("2026-07-30"), justification: "Оформление сцены для корпоративного турнира Т-Банк", status: "Согласовано",
      },
      {
        month: "2026-07", title: "Судейство (2 судьи) (Т-Банк)", category: "Мероприятия",
        accountingSub: "Оплата поставщикам (Коллаборация)", periodicity: "Разовый", vatRate: 0,
        amountTotal: 30000, payFormat: "Безнал", payDate: d("2026-07-20"), deliveryDate: d("2026-07-24"),
        justification: "Привлечение судей для корпоративного турнира Т-Банк", status: "Согласовано",
      },
      {
        month: "2026-07", title: "Услуги службы доставки (СДЭК)", category: "Логистика (курьеры, доставки)",
        accountingSub: "Оплата поставщикам (Коллаборация)", periodicity: "Разовый", vatRate: 22,
        amountTotal: 10000, payFormat: "Безнал", payDate: d("2026-07-20"), deliveryDate: d("2026-07-20"),
        justification: "Отправка призов победителям розыгрыша", status: "Согласовано",
      },
    ],
  });

  // ── Личные кабинеты: все демо-данные принадлежат старшему сотруднику ───────
  await prisma.advertiser.updateMany({ where: { ownerId: null }, data: { ownerId: owner.id } });
  await prisma.task.updateMany({ where: { ownerId: null }, data: { ownerId: owner.id } });
  await prisma.journalEntry.updateMany({ where: { ownerId: null }, data: { ownerId: owner.id } });

  console.log("✅ Готово. owner@colizeum.ru / manager@colizeum.ru — пароль colizeum");
}

async function seedKnowledge() {
  const MC = "Материалы для клиента";
  // Порядок — по циклу сделки: новичок читает сверху вниз и понимает, как работать.
  // Блоки: кто мы → как работает менеджер → путь сделки → что отправляем клиенту →
  // что продаём и почём → договор → деньги → маркировка/промо → люди и инструменты → блокеры → словарь.
  const articles: { category: string; title: string; bodyMarkdown: string; notes?: string }[] = [
    // ── 1. Кто мы и как устроена работа ──
    { category: "Профиль", title: "Профиль компании и аудитории", bodyMarkdown: "COLIZEUM — федеральная сеть компьютерных клубов; исполнитель — ООО «УК КОЛИЗЕУМ». Сеть ~600 клубов (прогноз ~700 к концу 2026), >19–20 тыс. ПК, >1850–2000 ТВ. Аудитория ~95% мужчины (18–24 = 59%; медиакит ~76% 15–24). NPS ~73%. Средняя сессия ~4 ч (≥10 показов). Позиционирование для FMCG: «инфраструктура как сервис» (PepsiCo, Tornado, Cyberwater)." },
    { category: "CRM-правила", title: "Роль менеджера и рабочий контур", bodyMarkdown: "Менеджер ведёт сделку от первого касания до закрывающих, стыкуя юристов, бухгалтерию, дизайн/арт, склад и Langame. Четыре слоя: CRM (+ Архив), хранилище документов, база знаний, дневной журнал. Langame (CLS) — софт-фундамент клубов; техинтеграции (эквайринг, бонусы) — на уровне Langame, менеджер — коммуникационный мост." },
    { category: "Условия и согласование", title: "Пайплайн и стадии сделки", bodyMarkdown: "Канон — 9 стадий: Лид → КП/условия → Договор → Приложение/спец. → Предоплата → Материалы + ОРД → Размещение → УПД + отчёт → Закрытие. Путь: касание → CRM → бриф → МП → КП → согласование (юрист → главбух) → **подписание в ЭДО или на оригиналах** → оплата → маркировка (только при интернет-форматах) → услуги → первичный отчёт (5 р.д.) → закрывающие. **Отчётность по актам ежемесячная по умолчанию для всех.**" },

    // ── 2. Первое касание: что отправляем клиенту ──
    { category: MC, title: "Медиакит", bodyMarkdown: "Презентация сети для рекламодателей: аудитория, форматы, охваты, кейсы (PepsiCo, Tornado, Cyberwater).", notes: "📎 Прикрепить актуальный медиакит (PDF)." },
    { category: MC, title: "Исследование аудитории", bodyMarkdown: "~95% мужчины; 18–24 = 59% (медиакит ~76% 15–24); NPS ~73%; сессия ~4 ч.", notes: "📎 Прикрепить исследование." },
    { category: MC, title: "Шаблоны медиаплана (клиентский и агентский)", bodyMarkdown: "Клиентский — прямым; агентский — с конечным брендом. Медиаплан = реальный прайс.", notes: "📎 Прикрепить xlsx-шаблоны." },
    { category: MC, title: "Технические требования к макетам", bodyMarkdown: [
      "| Формат | Размер |", "| --- | --- |",
      "| Баннер в ЛК | 766×473 |", "| Заставки на ПК / виджет / ТВ 65″ | 1920×1080 |",
      "| Баннер в мобильном приложении | 1080×372 / 960×372 |",
      "", "Ко-брендинг «Бренд × COLIZEUM» — в верхней зоне макета. Ротация: показ 1–1,5 мин, 5–7 сек, ~10 баннеров.",
    ].join("\n"), notes: "📎 Прикрепить техтребования (PDF)." },
    { category: MC, title: "Шаблон рамки договора", bodyMarkdown: "Рамочный \\_\\_/ММ/ГГГГ-РИМ; крупные — на своей бумаге. Конструкции — см. «Конструкции договоров».", notes: "📎 Прикрепить docx." },
    { category: MC, title: "Карточка компании", bodyMarkdown: "ООО «УК КОЛИЗЕУМ», ИНН 9713021000, КПП 771301001, ОГРН 1247700716394. АО «АЛЬФА-БАНК», р/с 40702810201300048430, к/с 30101810200000000593, БИК 044525593.", notes: "📎 Прикрепить PDF." },
    { category: MC, title: "Учредительные документы", bodyMarkdown: "Устав, ОГРН, свидетельства ООО «УК КОЛИЗЕУМ».", notes: "📎 Прикрепить пакет." },

    // ── 3. Что продаём и почём ──
    { category: "Форматы", title: "Форматы (по медиаплану)", bodyMarkdown: [
      "**Стандартный пакет (экраны в клубах):** баннер в ЛК (766×473); заставки на ПК (1920×1080); кликабельный баннер/видео и брендинг рабочего стола (1920×1080); кликабельный виджет (1920×1080, CTR ~2–6%, CTA-кнопка вместо QR); ТВ 65″ (1920×1080).",
      "**Дополнительные:** брендинг браузера Chrome с автозапуском UTM (~18 000 открытий/день); **баннер в мобильном приложении — 1080×372 / 960×372** [интернет]; пуш-уведомления [интернет]; посты VK и TG — один формат [интернет]; брендинг турнирного календаря (~1,5 млн охват/мес).",
      "**Побочные/кастом:** спонсорские турниры; промокоды; ярлыки ПК; кнопки пополнения Steam; кастом-производство (коврики) — **в печать только после подписания**.",
      "**Интернет-форматы (маркировка): баннер в МП, пуши, посты VK/TG. Всё.**",
    ].join("\n\n") },
    { category: "Цены/скидки", title: "Цены, пакеты, скидки", bodyMarkdown: "Пакеты «Стандарт»/«Продвинутый» на 30 дн / 3 / 6 / 12 мес; отдельно Москва и МО. Ориентиры: стандарт 30 дн РФ ~1,7 млн без НДС (CPU ≈3,78 ₽), продвинутый ~3,98 млн. Порядок КП: клиентский прайс → агентствам −17% → период с зашитой скидкой → опционально −10–20% сверху после согласования. CPV ~0,04–1,26 ₽, CPU ~0,5–6 ₽. CTR: 0,3–0,5% имидж / 0,5–1% оффер / 1,5–3% с мотивацией." },

    // ── 4. Договор ──
    { category: "Документооборот", title: "Конструкции договоров (по частоте)", bodyMarkdown: [
      "1. **Рамочный + спецификации/приложения** — самый популярный.",
      "2. **Единый договор оказания услуг** — реже.",
      "3. **Агентский договор** — рамка с агентством (Киберадверт на год).",
      "4. **Допсоглашение (ДС)** — при изменении условий.",
      "5. **Рамочный + заказы** — специфика МТС (заказ ≈ приложение).",
      "", "Модели: свой рамочный \\_\\_/ММ/ГГГГ-РИМ для большинства; крупные — на своей бумаге.",
    ].join("\n") },
    { category: "Документооборот", title: "Блоки договора и нумерация", bodyMarkdown: "**Нумерацию договора заранее согласовывать с клиентом** (наша / его / двойная) — несогласованная ломает УПД. Блоки: шапка → преамбула (Устав/МЧД) → термины (РМ/РИМ, ФЗ-38, Приказ ФАС №821/23) → предмет → права/обязанности (первичный отчёт 5 р.д. + фото из 10 клубов) → стоимость и оплата (НДС 22%) → отчётность и приёмка → реквизиты. Финансы матчатся по номеру приложения: «Счёт … к прил. K» ↔ «УПД … к прил. K»." },
    { category: "Профиль", title: "Наши реквизиты", bodyMarkdown: [
      "ООО «УК КОЛИЗЕУМ», ИНН 9713021000, КПП 771301001, ОГРН 1247700716394.",
      "Адрес: 127247, Москва, Дмитровское ш., д. 100, помещ. 2/7.",
      "Банк: АО «АЛЬФА-БАНК», к/с 30101810200000000593, БИК 044525593.",
      "**Р/с 40702810201300048430 — основной, единственный рабочий.**",
      "Ген. директор Магдеев Ринат Рамильевич. e-mail info@colizeumarena.com; домены @colizeum.ru.",
      "ЭДО: 2AE37859A4D-653F-42B6-8048-0B9688E47660. **НДС 2026 = 22%** (2025 — 20%); в договорах пункт о пересчёте при росте ставки.",
    ].join("\n\n") },

    // ── 5. Деньги и закрытие ──
    { category: "Финансы/документооборот", title: "Финансовая цепочка закрытия", bodyMarkdown: "Счёт (основание — Приложение №… к Договору) → Платёжное поручение → УПД статус 1 (счёт-фактура + акт) → Отчёт об оказанных услугах (+ скриншоты и фото из клубов) → Акт сверки. **Закрытие актов — ежемесячно по умолчанию.** Промокоды: передача за плату — УПД (номинал × количество на дату передачи), активацию не отслеживаем; бесплатно/зашито — УПД не нужен." },

    // ── 6. Маркировка и промо ──
    { category: "ОРД", title: "ОРД и маркировка", bodyMarkdown: "Только для интернет-форматов. ERID-токен — юрист на аутсорсе; менеджер составляет ТЗ по рекламодателю и договору (или цепочке). **Заявка — через отдельный бизнес-процесс в Aspro** (№ заявки, инициатор, контрагент, площадка, 18+, роль рекламораспространителя, даты, ресурс, текст поста; «ЕРИД #» = номер заявки, не токен). Акты — ежемесячно; **юрист сводит маркировку квартально: март — июнь — сентябрь — декабрь.** Розыгрыш в креативе → «Правила акции», ссылка на креативе." },
    { category: "Промокоды", title: "Промокоды", bodyMarkdown: "**Performance** — пул кодов за целевые действия, мелкий номинал (МТС — 30 000 кодов 500/700/2000 ₽, поквартальная сверка; **Яндекс Алиса AI** — раздача в чат-боте: установить приложение → скриншот → 100 ₽ бонусов). **Acquisition** — единый код за первый визит (МТС — 700 ₽). Налоги: номинал без НДС, использованные +22%; УПД при передаче за плату; задержка выдача→активация ≥12 ч." },

    // ── 7. Люди, инструменты, блокеры, словарь ──
    { category: "Люди", title: "Люди и маршрут согласования", bodyMarkdown: "Договор: юрист **Екатерина** → главбух **Ольга**. Креативы — арт-директор + директор по маркетингу; внутренние макеты апрувятся автоматически, согласование у клиента — на менеджере. ОРД — юрист на аутсорсе. Отчётность — фотоотчёт (проект-менеджер), скрины (баннер-менеджер Милана). ⚠️ Директорию выверить (две «Миланы», @izovsehsil13). Контакты клиентов — в карточках клиентов." },
    { category: "Аналитика", title: "Инструменты", bodyMarkdown: "Aspro (aspro.cloud) — заявки и бизнес-процессы (вкл. ОРД); SuperSet — аналитика; Appmetrica — метрики мобильного приложения; ЭДО — документооборот (подписание ЭДО или оригиналы); **MyMeet + собственный сервис контроля встреч Colizeum** — транскрипция/саммари встреч." },
    { category: "Условия и согласование", title: "Глобальные блокеры (только два)", bodyMarkdown: "1. **Сроки согласования** — договор/приложения проходят юристов и бухгалтерию обеих сторон; у крупных этапы строго последовательны; нумерацию согласовывать заранее.\n2. **Согласование оплат** — схема утверждается на стороне клиента и влияет на правки договора; размещение стартует после предоплаты.\n\nСитуативные блокеры в базе знаний не хранятся — только в поле карточки." },
    { category: "Профиль", title: "Глоссарий", bodyMarkdown: "РИМ — рекламно-информационные материалы; РМ — рекламный материал; МП — медиаплан; КП — коммерческое предложение; ДС — допсоглашение; Спецификация/Приложение — неотъемлемая часть договора; УПД — универсальный передаточный документ (статус 1 = счёт-фактура + акт); ЭДО — электронный документооборот; ЕРИД — идентификатор маркировки; ОРД — оператор рекламных данных; CLS — Colizeum Langame Software; ЛК — личный кабинет; T-Pay — платёжный сервис Т-Банка; **ЕББ — единый бонусный баланс** (компенсация «кэшбека» бонусами на игровой баланс за оплату картой Т-Банка); МЧД — машиночитаемая доверенность." },
  ];
  let order = 1;
  for (const a of articles) await prisma.knowledgeArticle.create({ data: { ...a, orderIndex: order++ } });
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
