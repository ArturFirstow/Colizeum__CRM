import "server-only";
import { API_REGISTRY, type FieldSpec } from "@/lib/services/api-registry";
import { DEFAULT_LIMIT, MAX_LIMIT } from "@/lib/services/api-v1";

// ─────────────────────────────────────────────────────────────────────────────
// Машинное описание API — OpenAPI (требование Влада 9.1).
//
// Зачем оно, если есть docs/API.md. Текстовая инструкция — для человека,
// который подключается руками. OpenAPI — для программ: по нему Postman,
// Insomnia и генераторы клиентов сами соберут запросы, подставят параметры и
// проверят ответы. Разработчику коннектора это экономит день работы.
//
// Описание строится из того же списка, по которому API отдаёт данные
// (api-registry.ts). Поэтому «в описании одно, а приходит другое» здесь
// невозможно: добавили поле — оно появилось и в выдаче, и в описании.
// ─────────────────────────────────────────────────────────────────────────────

function fieldSchema(f: FieldSpec): Record<string, unknown> {
  const base: Record<string, unknown> =
    f.type === "date-time"
      ? { type: "string", format: "date-time" }
      : f.type === "number"
        ? { type: "number" }
        : f.type === "boolean"
          ? { type: "boolean" }
          : { type: "string" };
  return { ...base, nullable: f.nullable ?? false, description: f.about };
}

export function buildOpenApi(baseUrl: string): Record<string, unknown> {
  const schemas: Record<string, unknown> = {
    Error: {
      type: "object",
      properties: {
        error: {
          type: "object",
          properties: {
            code: { type: "string", description: "Короткий код ошибки для программы." },
            message: { type: "string", description: "Объяснение для человека, по-русски." },
          },
        },
      },
    },
  };

  const paths: Record<string, unknown> = {};

  for (const [path, spec] of Object.entries(API_REGISTRY)) {
    const schemaName = path
      .split("-")
      .map((p) => p[0].toUpperCase() + p.slice(1))
      .join("");

    schemas[schemaName] = {
      type: "object",
      description: spec.about,
      properties: Object.fromEntries(
        Object.entries(spec.fields).map(([name, f]) => [name, fieldSchema(f)]),
      ),
    };

    paths[`/${path}`] = {
      get: {
        summary: spec.title,
        description:
          `${spec.about}\n\nСоответствие в Aspro: ${spec.asproTarget}.\n\n` +
          "Порядок записей — по дате изменения, по возрастанию: так синхронизацию можно " +
          "продолжить с места обрыва.",
        operationId: `list${schemaName}`,
        tags: [spec.title],
        security: [{ apiKey: [] }],
        parameters: [
          {
            name: "limit",
            in: "query",
            description: `Сколько записей на странице. По умолчанию ${DEFAULT_LIMIT}, больше ${MAX_LIMIT} не отдаём.`,
            schema: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT },
          },
          {
            name: "cursor",
            in: "query",
            description:
              "Продолжить с записи, чей id передан. Берётся из поля nextCursor предыдущего ответа. " +
              "Курсор вместо номера страницы: нумерация ломается, когда во время перебора добавилась запись.",
            schema: { type: "string" },
          },
          {
            name: "updatedSince",
            in: "query",
            description:
              "Только записи, изменённые после этого момента. Обычный порядок работы коннектора: " +
              "запомнить updatedAt последней полученной записи и передать его сюда в следующий раз.",
            schema: { type: "string", format: "date-time" },
          },
          {
            name: "all",
            in: "query",
            description:
              "all=1 снимает отбор «помечено к передаче». Нужен при первой полной выгрузке " +
              "и при разборе расхождений. По умолчанию отдаются только помеченные записи.",
            schema: { type: "string", enum: ["1"] },
          },
        ],
        responses: {
          "200": {
            description: "Страница записей",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: `#/components/schemas/${schemaName}` } },
                    nextCursor: {
                      type: "string",
                      nullable: true,
                      description: "Передать в следующий запрос как ?cursor=…. null — записи кончились.",
                    },
                    hasMore: { type: "boolean", description: "Есть ли ещё страницы." },
                    total: { type: "integer", description: "Сколько всего записей подходит под отбор." },
                  },
                },
              },
            },
          },
          "400": {
            description: "Неверный параметр, например updatedSince не похож на дату",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "401": {
            description: "Ключ не передан, не найден, отозван или просрочен",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "403": {
            description: "Раздел не входит в разрешения этого ключа",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "429": {
            description:
              "Превышен предел обращений. В заголовке Retry-After — через сколько секунд повторить.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    };
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "Colizeum Agency — API для внешних систем",
      version: "1.0.0",
      description:
        "Контур чтения для коннектора Aspro.Cloud и других служебных систем компании.\n\n" +
        "Записи в сервис нет намеренно: по заданию обратная синхронизация не требуется, " +
        "а контур только на чтение снимает целый класс рисков.\n\n" +
        "**Про НДС.** У сделок суммы БЕЗ налога (amountNet, contractTotalNet) — в сервисе " +
        "действует правило «вводим чистую сумму». У счетов сумма С налогом (amountGross), " +
        "потому что её переписывают с настоящего документа. Поля названы так, чтобы их " +
        "нельзя было перепутать.\n\n" +
        "Каждое обращение по ключу видно в журнале действий сервиса.",
      contact: { name: "Администратор сервиса Colizeum Agency" },
    },
    servers: [{ url: `${baseUrl}/api/v1`, description: "Боевой контур" }],
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          description:
            "Служебный ключ вида colz_…. Выпускается в сервисе: «Команда» → «Ключи для внешних систем». " +
            "Показывается один раз при выпуске — в базе хранится только отпечаток.",
        },
      },
      schemas,
    },
    security: [{ apiKey: [] }],
    paths,
  };
}

/** Коллекция для Postman — собирается из того же описания. */
export function buildPostmanCollection(baseUrl: string): Record<string, unknown> {
  return {
    info: {
      name: "Colizeum Agency API v1",
      description:
        "Готовые запросы ко всем разделам. Перед работой задайте переменные коллекции: " +
        "baseUrl (адрес сервиса) и apiKey (ключ из «Команда» → «Ключи для внешних систем»).",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [
      { key: "baseUrl", value: baseUrl },
      { key: "apiKey", value: "colz_вставьте_сюда_ключ" },
    ],
    auth: { type: "bearer", bearer: [{ key: "token", value: "{{apiKey}}", type: "string" }] },
    item: Object.entries(API_REGISTRY).flatMap(([path, spec]) => [
      {
        name: `${spec.title} — первая выгрузка`,
        request: {
          method: "GET",
          url: {
            raw: `{{baseUrl}}/api/v1/${path}?all=1&limit=200`,
            host: ["{{baseUrl}}"],
            path: ["api", "v1", path],
            query: [
              { key: "all", value: "1", description: "снять отбор «помечено к передаче»" },
              { key: "limit", value: "200" },
            ],
          },
          description: spec.about,
        },
      },
      {
        name: `${spec.title} — что изменилось`,
        request: {
          method: "GET",
          url: {
            raw: `{{baseUrl}}/api/v1/${path}?updatedSince=2026-01-01T00:00:00Z&limit=200`,
            host: ["{{baseUrl}}"],
            path: ["api", "v1", path],
            query: [
              {
                key: "updatedSince",
                value: "2026-01-01T00:00:00Z",
                description: "подставьте updatedAt последней полученной записи",
              },
              { key: "limit", value: "200" },
            ],
          },
          description: "Ежедневная подкачка изменений.",
        },
      },
    ]),
  };
}
