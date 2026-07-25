# Colizeum Agency — проект

Внутренний сервис менеджера рекламных проектов COLIZEUM: **CRM + документы с версионированием + календарь размещений + финансы + ОРД + промокоды + база знаний + журнал**.

Исходное ТЗ — `docs/Colizeum_Workspace_БЛУПРИНТ_v2.md`; поверх него выполнено большое ТЗ на доработку (см. «Текущее состояние»). Читай блупринт при работе над доменной логикой.

## Про пользователя

Пользователь — не программист. Объясняй просто, по-русски. Работай маленькими шагами: один блок → короткое резюме → подтверждение. Не выдумывай доменные данные (реквизиты, цены, документы) — только то, что дал пользователь.

## Текущее состояние (все разделы ТЗ-доработки закрыты)

- **Брендинг**: Colizeum Agency, палитра брендбука (#FCDF3B, графит #1F1F1F/#2B2B2B), знак-маска «ХО» (`src/components/Logo.tsx`), шрифты Oswald/Manrope/JetBrains Mono. ⚠️ Пользователь считает знак неточным (нос) — вернуться при случае.
- **Удаление везде** с подтверждением (`DeleteButton`), каскады проверены.
- **Рекламодатели**: чистые карточки (суть + ⚠️), реквизиты, агентство → клиенты (`AgencyClient`).
- **Документы**: 8 фиксированных подразделов (`DOCUMENT_SECTIONS` в enums), пустые тоже показываются.
- **Календарь размещений** (`/placements`): Gantt слоты × недели по рабочей Google-таблице клиента, статусы Подписан/На подписании/Ожидание.
- **Финансы**: помесячный календарь платежей (`PlannedPayment`), `Deal.contractTotal`.
- **ОРД**: роли Агентство/Клиент, даты, файлы креатива/акта в StorageProvider, флаг `urgent`.
- **Промокоды**: карточки по рекламодателям (сроки, условия, взаиморасчёт).
- **«Сегодня»**: `DailyStatus` (статус дня по проекту) + недельный отчёт (`src/lib/services/weekly-report.ts`, `/api/reports/weekly`).

**НЕ сделано (следующие итерации):** AI-функции, RBAC + аудит-лог, фоновые задачи, S3/прод-деплой. **Ждём от пользователя:** база знаний коллеги и файлы «материалов для клиента» (структура в БЗ готова, категория «Материалы для клиента»).

## Как запустить

```bash
npm install
cp .env.example .env
npm run setup             # prisma generate + db push + seed
npm run dev               # http://localhost:3000
```

Аккаунты сотрудников (сид): `a.firstov@` (админ), `a.ivanushkin@` (руководитель), `m.yanyuk@`, `e.turinova@`, `a.chepelyuk@` (турниры) — все `@colizeum.ru`. Пароли — случайные дефолты в `seed.ts` (переопределяются через `SEED_PW_*`).

## ⚠️ Доставка кода

У сессий Claude был **read-only** доступ к GitHub (push → 403). Рабочий процесс: коммит локально → `git bundle` → отправка пользователю → он делает `git pull <бандл>` в `C:\Users\Colizeum\Downloads\colizeum` и сам пушит с личным токеном. Если push из сессии заработает — пушить в `claude/service-blueprint-frontend-ref797`.

## Архитектура

- **Монолит**: Next.js 15 (App Router) + TypeScript + Tailwind.
- **БД/ORM**: Prisma + SQLite (dev) → PostgreSQL (prod). Все сущности и связи — `prisma/schema.prisma`. Enum'ы хранятся строками, источник значений — `src/lib/enums.ts`, валидация Zod — `src/lib/validation.ts`.
- **Файлы**: `StorageProvider` (`src/lib/storage/`), dev — локальный диск `./storage`; в БД только метаданные (sha256, версии). Файлы ОРД — ключи `ord/{id}/{kind}/…`.
- **Auth**: cookie-сессия (JWT `jose`, httpOnly), bcrypt, 2 аккаунта. `src/lib/auth.ts`.
- **Слои**: страницы (server components, Prisma напрямую) → клиентские островки (`src/components/**`) → API-роуты (`src/app/api/**`, Zod, `{ error: { code, message } }`) → сервисы (`src/lib/services/**`).
- **Инварианты стадий** — `src/lib/services/deal-stage.ts`: предупреждения → 409 → подтверждение `confirm=true`.

## Незыблемые правила домена

- Приложения Т-Банка согласуются строго по очереди.
- Правки после подписания при запрете правки тела → **ДС** (кейс Алабуга).
- Платежи по клубу на ИП нельзя через счёт УК.
- Размещение стартует только после предоплаты.
- НДС по дате документа: 2025 → 20 %, 2026 → 22 % (`vatRateForDate`).

## Стиль

Брендбук 2025: жёлтый `#FCDF3B/#FFE665/#FFE97C`, графит `#1F1F1F/#2B2B2B/#202020`, светлые `#F1F1F1/#ECECEC`. Токены — `tailwind.config.ts` (brand/ink), цвета статусов — `src/lib/ui-tokens.ts`. На «лицевой» стороне карточек — только суть (название/статус/приоритет/цифра), детали — по клику.

## Карта кода

- `src/lib/` — enums (стадии, разделы документов, слоты), prisma, auth, storage, validation, api, format, org, markdown, services (deal-stage, weekly-report).
- `src/app/(app)/` — dashboard, deals, tasks, journal, advertisers, documents, knowledge, finances, placements, ord, promo.
- `src/components/` — по модулям: advertisers, deals, tasks, documents, knowledge, journal, finances (PaymentCalendar), placements (PlacementCalendar), ord, promo, dashboard (DailyStatusPanel), ui (Modal, DeleteButton, primitives).
- `prisma/seed.ts` — идемпотентный сид (демо-данные из баз знаний + рабочей таблицы размещений).
