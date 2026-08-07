import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ownScope } from "@/lib/scope";
import { JournalView } from "@/components/journal/JournalView";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  // Личный кабинет: журнал у каждого сотрудника свой.
  const session = await requireSession();
  const [entries, advertisers] = await Promise.all([
    prisma.journalEntry.findMany({ where: ownScope(session), orderBy: { date: "desc" } }),
    prisma.advertiser.findMany({
      where: { archived: false, ...ownScope(session) },
      select: { id: true, nameRu: true },
      orderBy: { nameRu: "asc" },
    }),
  ]);
  return <JournalView entries={entries} advertisers={advertisers} />;
}
