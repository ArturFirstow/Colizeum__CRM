import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { isLeadership } from "@/lib/scope";
import { netOfExpense, vatOfExpense, daysBetween, weekOfMonth } from "@/lib/dept-budget";

// Ручная выгрузка бюджета отдела в CSV того же формата, что рабочая таблица
// (открывается в Excel и Google Sheets). BOM — чтобы кириллица не «поехала».
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function row(cells: unknown[]): string {
  return cells.map(csvCell).join(";");
}
const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString("ru-RU") : "");

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!isLeadership(session)) return new Response("Доступно только руководителю", { status: 403 });

  const month = new URL(req.url).searchParams.get("month") ?? undefined;
  const where = month ? { month } : {};

  const [incomes, expenses] = await Promise.all([
    prisma.deptIncome.findMany({ where, orderBy: [{ month: "asc" }, { source: "asc" }] }),
    prisma.deptExpense.findMany({ where, orderBy: [{ month: "asc" }, { payDate: "asc" }] }),
  ]);

  const lines: string[] = [];
  lines.push(row(["ПЛАНИРУЕМЫЕ ДОХОДЫ"]));
  lines.push(row(["Месяц", "Источник", "1 нед", "2 нед", "3 нед", "4 нед", "Итого"]));
  for (const i of incomes) {
    lines.push(row([i.month, i.source, i.w1, i.w2, i.w3, i.w4, i.w1 + i.w2 + i.w3 + i.w4]));
  }
  lines.push("");
  lines.push(row(["РЕЕСТР СОГЛАСОВАНИЯ РАСХОДОВ"]));
  lines.push(
    row([
      "Месяц", "Отдел / общесетевые", "Статья", "Подстатья для бухгалтерии", "Юр.лицо",
      "Наименование", "Периодичность", "Наличие НДС", "Сумма ИТОГО", "Потрачено ИТОГО",
      "Сумма без НДС", "НДС", "Формат оплаты", "Дата оплаты", "Дата поставки",
      "Дней между", "Срок окончания", "Дата закрытия актом", "Обоснование", "Описание",
      "Статус", "Неделя",
    ]),
  );
  for (const e of expenses) {
    lines.push(
      row([
        e.month, e.department, e.category, e.accountingSub, e.legalEntity,
        e.title, e.periodicity, e.vatRate === 22 ? "22%" : "Нет", e.amountTotal, e.spentTotal ?? "",
        netOfExpense(e.amountTotal, e.vatRate), vatOfExpense(e.amountTotal, e.vatRate),
        e.payFormat, fmtDate(e.payDate), fmtDate(e.deliveryDate),
        daysBetween(e.payDate, e.deliveryDate) ?? "", fmtDate(e.serviceEndDate), fmtDate(e.actClosedDate),
        e.justification, e.description, e.status, weekOfMonth(e.payDate) ?? "",
      ]),
    );
  }

  const csv = "﻿" + lines.join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="budget-otdela${month ? "-" + month : ""}.csv"`,
    },
  });
}
