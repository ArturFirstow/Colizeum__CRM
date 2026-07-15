import { prisma } from "@/lib/prisma";
import { JournalView } from "@/components/journal/JournalView";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const entries = await prisma.journalEntry.findMany({ orderBy: { date: "desc" } });
  return <JournalView entries={entries} />;
}
