import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { renderDocument } from "@/lib/markdown";
import { INCIDENT_TITLE, INCIDENT_BODY } from "@/lib/incident";

export const dynamic = "force-dynamic";

// Порядок действий при утечке (требование 4.9). Открыт ВСЕМ сотрудникам:
// требование говорит «сотрудники знают порядок», а знать его должен тот, кто
// первым заметит странное, — то есть любой.
export default async function IncidentPage() {
  await requireSession();

  // Кому сообщать — берём живьём из «Команды»: сменится человек, и страница
  // обновится сама. Имён в тексте инструкции специально нет.
  const contacts = await prisma.user.findMany({
    where: { role: { in: ["Owner", "Security"] } },
    select: { name: true, email: true, role: true, telegramChatId: true },
    orderBy: { role: "asc" },
  });

  return (
    <div>
      <PageHeader
        title={INCIDENT_TITLE}
        subtitle="Что делать, если данные могли попасть не туда. Короткая инструкция на первые минуты"
        icon="🚨"
      />

      <section className="card mb-5 border-red-500/40 bg-red-500/5 p-5">
        <h2 className="font-semibold text-red-200">Кому сообщить прямо сейчас</h2>
        {contacts.length === 0 ? (
          <p className="mt-2 text-sm text-ink-300">
            Ответственные пока не заведены. Сообщите своему руководителю.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {contacts.map((c) => (
              <li
                key={c.email}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3"
              >
                <span>
                  <b className="text-ink-100">{c.name}</b>
                  <span className="ml-2 text-xs text-ink-500">
                    {c.role === "Security" ? "ответственный за безопасность" : "администратор сервиса"}
                  </span>
                </span>
                <a href={`mailto:${c.email}`} className="text-sm text-brand underline underline-offset-2">
                  {c.email}
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-400">
          Можно написать в мессенджере сервиса личным сообщением — это быстрее почты.
          Ошибиться и поднять ложную тревогу не страшно, промолчать — страшно.
        </p>
      </section>

      <article
        className="card prose-kb p-6 sm:p-8"
        dangerouslySetInnerHTML={{ __html: renderDocument(INCIDENT_BODY) }}
      />

      <p className="mt-4 text-xs text-ink-500">
        Инструкция рабочая: ответственный за обработку персональных данных должен её
        подтвердить и довести до сотрудников. Текст правится в{" "}
        <code className="text-ink-400">src/lib/incident.ts</code>.
      </p>
    </div>
  );
}
