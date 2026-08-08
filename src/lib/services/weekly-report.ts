import "server-only";
import { prisma } from "@/lib/prisma";

function fmt(d: Date): string {
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

// Собирает недельный отчёт по проектам из ежедневных статусов + состояния сделок.
export async function buildWeeklyReport(days = 7): Promise<{ markdown: string; filename: string }> {
  const now = new Date();
  const from = new Date(now.getTime() - days * 86400000);

  const advertisers = await prisma.advertiser.findMany({
    orderBy: { nameRu: "asc" },
    include: {
      deals: { orderBy: { updatedAt: "desc" } },
      dailyStatuses: {
        where: { date: { gte: from } },
        orderBy: { date: "asc" },
      },
    },
  });

  const periodLabel = `${fmt(from)} — ${fmt(now)}.${now.getFullYear()}`;
  const lines: string[] = [];
  lines.push(`# Недельный отчёт по проектам`);
  lines.push(``);
  lines.push(`**Период:** ${periodLabel}`);
  lines.push(``);

  // Сводка.
  const allDeals = advertisers.flatMap((a) => a.deals);
  const decisions = allDeals.filter((d) => d.decisionPending);
  const blockers = allDeals.filter((d) => d.blockerActive);
  lines.push(`## Сводка`);
  lines.push(`- Активных проектов: ${advertisers.filter((a) => a.deals.length > 0).length}`);
  lines.push(`- Сделок всего: ${allDeals.length}`);
  lines.push(`- Ждут решения: ${decisions.length}`);
  lines.push(`- Активные блокеры: ${blockers.length}`);
  lines.push(``);

  if (decisions.length > 0) {
    lines.push(`### ◆ Требуют решения`);
    for (const d of decisions) lines.push(`- **${d.title}**: ${d.decisionPending}`);
    lines.push(``);
  }
  if (blockers.length > 0) {
    lines.push(`### ⛔ Блокеры`);
    for (const d of blockers) lines.push(`- **${d.title}**: ${d.blocker}`);
    lines.push(``);
  }

  lines.push(`## По проектам`);
  lines.push(``);
  for (const a of advertisers) {
    if (a.deals.length === 0 && a.dailyStatuses.length === 0) continue;
    lines.push(`### ${a.nameRu}`);
    for (const d of a.deals) {
      const extra = [
        d.nextStep ? `след. шаг: ${d.nextStep}` : null,
        d.blockerActive ? `блокер: ${d.blocker ?? "—"}` : null,
      ]
        .filter(Boolean)
        .join("; ");
      lines.push(`- **${d.title}** — _${d.stage}_${extra ? ` (${extra})` : ""}`);
    }
    if (a.dailyStatuses.length > 0) {
      lines.push(``);
      lines.push(`_Статусы за неделю:_`);
      for (const s of a.dailyStatuses) {
        lines.push(`- ${fmt(new Date(s.date))}: ${s.text}`);
      }
    }
    lines.push(``);
  }

  const filename = `Недельный_отчёт_${now.toISOString().slice(0, 10)}.md`;
  return { markdown: lines.join("\n"), filename };
}
