import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type { SessionPayload } from "../../src/lib/auth";

// Реальная SQLite, каждый запуск — новая папка. Никаких .env и рабочих данных.
const testDir = mkdtempSync(join(tmpdir(), "colizeum-task-flow-"));
process.env.DATABASE_URL = `file:${join(testDir, "test.db").replaceAll("\\", "/")}`;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.AI_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
const { prisma } = await import("../../src/lib/prisma");
const { createTask, updateTask } = await import("../../src/lib/services/tasks");
const { guardTask } = await import("../../src/lib/guard");
const { taskScope, tasksForAdvertiser, tasksForEmployee } = await import("../../src/lib/task-scope");
const { buildWorksheet, weekStartOf, isOverdue } = await import("../../src/lib/worksheet");
const { taskCreateSchema, taskUpdateSchema } = await import("../../src/lib/validation");
const { collectClientFacts } = await import("../../src/lib/services/handover");
const { buildClientTimeline } = await import("../../src/lib/services/client-timeline");

const session = (userId: string, role: SessionPayload["role"] = "Manager", teamIds = [userId]): SessionPayload => ({
  userId, role, teamIds, email: `${userId}@example.test`, name: `Тест ${userId}`, track: "Ads",
});
const director = session("director", "Director");
const lead = session("lead-a", "Owner", ["lead-a", "junior-a"]);
const junior = session("junior-a", "Manager", ["junior-a", "lead-a"]);
const other = session("lead-b", "Manager", ["lead-b", "junior-b"]);
const security = session("security", "Security");
const input = (data: Record<string, unknown>) => taskCreateSchema.parse({ title: "Тестовая задача", ...data });
const patch = (data: Record<string, unknown>) => taskUpdateSchema.parse(data);
const taskIds = async (who: SessionPayload) => (await prisma.task.findMany({ where: taskScope(who) })).map((t) => t.id);

before(async () => {
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], {
    cwd: resolve(import.meta.dirname, "../.."), env: process.env, stdio: "pipe",
  });
  for (const who of [director, lead, junior, other, session("junior-b"), security]) {
    await prisma.user.create({ data: { id: who.userId, email: who.email, name: who.name, role: who.role, passwordHash: "synthetic-not-a-login" } });
  }
  await prisma.user.update({ where: { id: junior.userId }, data: { leadId: lead.userId } });
  await prisma.user.update({ where: { id: "junior-b" }, data: { leadId: other.userId } });
  await prisma.advertiser.createMany({ data: [
    { id: "client-a", nameRu: "Учебный клиент А", ownerId: lead.userId },
    { id: "client-a2", nameRu: "Учебный клиент А2", ownerId: lead.userId },
    { id: "client-b", nameRu: "Учебный клиент Б", ownerId: other.userId },
  ] });
  await prisma.deal.createMany({ data: [
    { id: "deal-a", title: "Учебная кампания А", advertiserId: "client-a" },
    { id: "deal-a2", title: "Учебная кампания А2", advertiserId: "client-a2" },
    { id: "deal-b", title: "Учебная кампания Б", advertiserId: "client-b" },
  ] });
});

after(async () => {
  await prisma.$disconnect();
  // Удаляем только созданную этим тестом папку внутри системного temp.
  assert.equal(dirname(resolve(testDir)), resolve(tmpdir()));
  assert.ok(basename(testDir).startsWith("colizeum-task-flow-"));
  rmSync(testDir, { recursive: true, force: true });
});

test("выбор сделки заполняет клиента; одна задача видна в паре, карточке и неделе", async () => {
  const task = await createTask(lead, input({ dealId: "deal-a", assigneeId: junior.userId }));
  assert.equal(task.advertiserId, "client-a");
  assert.ok((await taskIds(lead)).includes(task.id));
  assert.ok((await taskIds(junior)).includes(task.id));
  assert.equal((await guardTask(junior, task.id)).id, task.id);
  assert.ok((await prisma.task.findMany({ where: tasksForAdvertiser("client-a") })).some((t) => t.id === task.id));
  const sheet = await buildWorksheet(junior, weekStartOf(new Date()));
  assert.ok(sheet.clients.find((c) => c.advertiserId === "client-a")?.now.some((t) => t.id === task.id));
});

test("старая задача только со сделкой видна без перезаписи базы", async () => {
  const task = await prisma.task.create({ data: { title: "Старая задача", dealId: "deal-a", ownerId: director.userId } });
  assert.ok((await taskIds(junior)).includes(task.id));
  await guardTask(junior, task.id);
  const sheet = await buildWorksheet(junior, weekStartOf(new Date()));
  assert.ok(sheet.clients.find((c) => c.advertiserId === "client-a")?.now.some((t) => t.id === task.id));
  const events = await buildClientTimeline("client-a");
  assert.ok(events.some((e) => JSON.stringify(e).includes("Старая задача")));
  assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).advertiserId, null);
});

test("руководитель → ведущий → младший: тот же id и один результат выполнения", async () => {
  const task = await createTask(director, input({ title: "Поручение для передачи", dealId: "deal-a", assigneeId: lead.userId }));
  const count = await prisma.task.count();
  const delegated = await updateTask(lead, task.id, patch({ assigneeId: junior.userId }));
  assert.equal(delegated.id, task.id);
  assert.equal(delegated.ownerId, director.userId);
  assert.equal(delegated.assignedById, director.userId);
  assert.equal(await prisma.task.count({ where: { id: task.id, ...tasksForEmployee(lead.userId) } }), 0);
  assert.equal(await prisma.task.count({ where: { id: task.id, ...tasksForEmployee(junior.userId) } }), 1);
  await updateTask(junior, task.id, patch({ status: "Готова" }));
  assert.equal(await prisma.task.count(), count);
  assert.equal(await prisma.task.count({ where: { id: task.id, ...taskScope(lead), status: { not: "Готова" } } }), 0);
  const sheet = await buildWorksheet(lead, weekStartOf(new Date()));
  assert.ok(sheet.clients.find((c) => c.advertiserId === "client-a")?.done.some((t) => t.id === task.id));
  assert.equal((await collectClientFacts("client-a")).includes(task.title), false);
});

test("обычное поручение без клиента доступно исполнителю и постановщику", async () => {
  const task = await createTask(lead, input({ assigneeId: other.userId }));
  assert.ok((await taskIds(other)).includes(task.id));
  await updateTask(other, task.id, patch({ status: "В работе" }));
  assert.ok((await taskIds(lead)).includes(task.id));
});

test("чужая пара и Security не получают доступ даже по известному id", async () => {
  const task = await createTask(lead, input({ dealId: "deal-a" }));
  assert.equal((await taskIds(other)).includes(task.id), false);
  assert.equal((await taskIds(security)).length, 0);
  await assert.rejects(guardTask(other, task.id), { name: "PublicError", status: 404 });
  await assert.rejects(updateTask(other, task.id, patch({ status: "Готова" })), { status: 404 });
  await assert.rejects(guardTask(security, task.id), { status: 404 });
  await assert.rejects(buildWorksheet(other, weekStartOf(new Date()), lead.userId), { status: 404 });
});

test("несовместимые клиент и сделка отклоняются без частичного сохранения", async () => {
  const beforeCount = await prisma.task.count();
  await assert.rejects(createTask(lead, input({ dealId: "deal-a", advertiserId: "client-a2" })), { code: "task_client_mismatch" });
  assert.equal(await prisma.task.count(), beforeCount);
  const task = await createTask(lead, input({ dealId: "deal-a" }));
  await assert.rejects(updateTask(lead, task.id, patch({ advertiserId: "client-a2" })), { code: "task_client_mismatch" });
  await assert.rejects(updateTask(lead, task.id, patch({ dealId: "deal-b" })), { status: 404 });
  await assert.rejects(updateTask(lead, task.id, patch({ advertiserId: "client-b" })), { status: 404 });
  assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).dealId, "deal-a");
  const moved = await updateTask(lead, task.id, patch({ dealId: "deal-a2" }));
  assert.equal(moved.advertiserId, "client-a2");
});

test("при старых противоречивых связях клиент определяется сделкой", async () => {
  const task = await prisma.task.create({ data: { title: "Несогласованные старые связи", dealId: "deal-a", advertiserId: "client-b", ownerId: director.userId } });
  assert.ok((await taskIds(lead)).includes(task.id));
  assert.equal((await taskIds(other)).includes(task.id), false);
  assert.equal(await prisma.task.count({ where: { id: task.id, ...tasksForAdvertiser("client-b") } }), 0);
  const repaired = await updateTask(junior, task.id, patch({ status: "В работе" }));
  assert.equal(repaired.advertiserId, "client-a");
});

test("передача дел включает клиентские задачи без сделки, исключая выполненные", async () => {
  const task = await createTask(lead, input({ title: "Контекст без сделки", advertiserId: "client-a" }));
  assert.ok((await collectClientFacts("client-a")).includes(task.title));
  await updateTask(junior, task.id, patch({ status: "Готова" }));
  assert.equal((await collectClientFacts("client-a")).includes(task.title), false);
});

test("несуществующий исполнитель не создаёт задачу; Security не ставит задачи", async () => {
  await assert.rejects(createTask(lead, input({ assigneeId: "missing-user" })), { code: "invalid_assignee" });
  await assert.rejects(createTask(lead, input({ assigneeId: security.userId })), { code: "invalid_assignee" });
  await assert.rejects(createTask(security, input({})), { status: 403 });
});

test("срок сегодня ещё не просрочен, закрытая задача не попадает в просрочку", () => {
  const now = new Date(2026, 9, 31, 18);
  assert.equal(isOverdue({ dueDate: new Date(2026, 9, 31), status: "Открыта" }, now), false);
  assert.equal(isOverdue({ dueDate: new Date(2026, 9, 30), status: "Открыта" }, now), true);
  assert.equal(isOverdue({ dueDate: new Date(2026, 9, 30), status: "Готова" }, now), false);
});
