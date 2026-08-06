import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { isLeadership } from "@/lib/scope";
import { PageHeader } from "@/components/ui/primitives";
import { BudgetView } from "@/components/leadership/BudgetView";

export const dynamic = "force-dynamic";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireSession();
  if (!isLeadership(session)) redirect("/dashboard");

  const { month: monthParam } = await searchParams;
  const now = new Date();
  const month = monthParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [incomes, expenses, budgetRow, allMonths] = await Promise.all([
    prisma.deptIncome.findMany({ where: { month }, orderBy: { source: "asc" } }),
    prisma.deptExpense.findMany({ where: { month }, orderBy: { payDate: "asc" } }),
    prisma.deptMonthBudget.findUnique({ where: { month } }),
    prisma.deptExpense.findMany({ select: { month: true }, distinct: ["month"] }),
  ]);

  // Список месяцев для переключателя (из данных + текущий).
  const monthsSet = new Set<string>([month, ...allMonths.map((m) => m.month)]);
  const incomeMonths = await prisma.deptIncome.findMany({ select: { month: true }, distinct: ["month"] });
  incomeMonths.forEach((m) => monthsSet.add(m.month));
  const budgetMonths = await prisma.deptMonthBudget.findMany({ select: { month: true } });
  budgetMonths.forEach((m) => monthsSet.add(m.month));
  const months = [...monthsSet].sort().reverse();

  return (
    <div>
      <PageHeader
        title="Деньги отдела"
        subtitle="Сколько можно потратить, что ждёт согласования и что придёт в этом месяце"
        icon="₽"
      />
      <BudgetView
        month={month}
        months={months}
        plannedBudget={budgetRow?.plannedBudget ?? 0}
        incomes={incomes.map((i) => ({ ...i }))}
        expenses={expenses.map((e) => ({
          ...e,
          payDate: e.payDate ? e.payDate.toISOString() : null,
          deliveryDate: e.deliveryDate ? e.deliveryDate.toISOString() : null,
          serviceEndDate: e.serviceEndDate ? e.serviceEndDate.toISOString() : null,
          actClosedDate: e.actClosedDate ? e.actClosedDate.toISOString() : null,
        }))}
      />
    </div>
  );
}
