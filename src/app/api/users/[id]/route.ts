import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { userUpdateSchema } from "@/lib/validation";
import { writeAudit, clientIp, changedFieldNames } from "@/lib/audit";
import { raiseAlert } from "@/lib/services/security-alerts";

type Ctx = { params: Promise<{ id: string }> };

// Правка сотрудника.
//   Имя, роль, Telegram, фото — только администратор (Owner).
//   Ссылка на личную таблицу учёта — сотрудник ставит себе сам; администратор
//   может поправить любому (например, когда человек прислал ссылку в чат).
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    const data = userUpdateSchema.parse(await req.json());
    const isAdmin = session.role === "Owner";
    const isSelf = session.userId === id;

    if (!isAdmin && !isSelf) {
      return fail("forbidden", "Менять чужой профиль может только администратор", 403);
    }
    // Сотруднику без прав админа оставлена ровно одна своя настройка — таблица
    // учёта. Всё остальное в карточке сотрудника заводит администратор.
    if (
      !isAdmin &&
      (data.name !== undefined ||
        data.role !== undefined ||
        data.telegramChatId !== undefined ||
        data.avatarUrl !== undefined ||
        data.leadId !== undefined ||
        data.position !== undefined)
    ) {
      return fail("forbidden", "Имя, роль, Telegram, фото и закрепление меняет администратор", 403);
    }

    // Закрепление за руководителем проекта открывает доступ к его клиентам,
    // поэтому две проверки до записи: сам себе руководителем быть не может и
    // цепочка «А закреплён за Б, Б за А» не допускается — иначе видимость
    // пошла бы по кругу.
    if (data.leadId) {
      if (data.leadId === id) {
        return fail("validation", "Сотрудник не может быть закреплён сам за собой", 422);
      }
      const lead = await prisma.user.findUnique({
        where: { id: data.leadId },
        select: { id: true, leadId: true },
      });
      if (!lead) return fail("not_found", "Руководитель проекта не найден", 404);
      if (lead.leadId === id) {
        return fail(
          "validation",
          "Эти двое не могут быть закреплены друг за другом — выберите одного руководителем",
          422,
        );
      }
    }

    const before = await prisma.user.findUnique({
      where: { id },
      select: {
        name: true,
        role: true,
        telegramChatId: true,
        avatarUrl: true,
        sheetUrl: true,
        leadId: true,
        position: true,
      },
    });
    if (!before) return fail("not_found", "Сотрудник не найден", 404);

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(isAdmin && data.name !== undefined ? { name: data.name } : {}),
        ...(isAdmin && data.role !== undefined ? { role: data.role } : {}),
        ...(isAdmin && data.telegramChatId !== undefined ? { telegramChatId: data.telegramChatId } : {}),
        ...(isAdmin && data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
        // Пустая строка = «снять закрепление».
        ...(isAdmin && data.leadId !== undefined ? { leadId: data.leadId || null } : {}),
        ...(isAdmin && data.position !== undefined ? { position: data.position || null } : {}),
        // Пустая строка = «убрать таблицу», поэтому пишем null, а не "".
        ...(data.sheetUrl !== undefined ? { sheetUrl: data.sheetUrl || null } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        sheetUrl: true,
        telegramChatId: true,
        avatarUrl: true,
        leadId: true,
        position: true,
      },
    });

    const ip = clientIp(req);
    writeAudit({
      action: "user.update",
      userId: session.userId,
      userName: session.name,
      entityType: "user",
      entityId: id,
      changedFields: changedFieldNames({ ...data }, before),
      ip,
    });
    // Смена роли — это смена того, что человек видит в сервисе. Менеджер,
    // ставший руководителем, получает бюджет всего отдела; роль «Безопасность»
    // даёт журнал действий. Такое не должно происходить незаметно.
    if (data.role !== undefined && data.role !== before.role) {
      await raiseAlert({
        kind: "role-change",
        userId: session.userId,
        userName: session.name,
        ip,
        detail: `${user.name}: роль «${before.role}» → «${data.role}».`,
      });
    }
    return ok(user);
  });
}
