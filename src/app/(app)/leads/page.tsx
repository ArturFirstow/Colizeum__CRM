import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { syncLeadsIfStale, leadsSheetHumanUrl } from "@/lib/services/leads-sync";

export const dynamic = "force-dynamic";

// Заявки с сайта colizeum-agency.ru: общий поток для отдела.
// Таблицу подтягиваем при открытии страницы (если данные устарели).
export default async function LeadsPage() {
  const session = await requireSession();
  const { error: syncError } = await syncLeadsIfStale();

  const [leads, users] = await Promise.all([
    prisma.lead.findMany({
      include: { assignedTo: { select: { id: true, name: true } } },
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Входящие с сайта"
        subtitle="Обращения из формы на colizeum-agency.ru. Общий поток отдела: возьмите заявку в работу, чтобы её не вели двое."
        icon="⚑"
      />
      <LeadsTable
        leads={leads.map((l) => ({
          id: l.id,
          name: l.name,
          company: l.company,
          contact: l.contact,
          message: l.message,
          referer: l.referer,
          sentAt: l.sentAt ? l.sentAt.toISOString() : null,
          status: l.status,
          comment: l.comment,
          assignedTo: l.assignedTo,
        }))}
        users={users}
        me={{ id: session.userId, name: session.name }}
        sheetUrl={leadsSheetHumanUrl()}
        syncError={syncError ?? null}
      />
    </div>
  );
}
