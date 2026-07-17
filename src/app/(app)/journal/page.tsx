import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ownScope } from "@/lib/scope";
import { JournalView } from "@/components/journal/JournalView";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  // Личный кабинет: журнал у каждого сотрудника свой.
  const session = await requireSession();
  const entries = await prisma.journalEntry.findMany({ where: ownScope(session), orderBy: { date: "desc" } });
  return <JournalView entries={entries} />;
}
