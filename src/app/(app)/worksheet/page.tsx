import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// ⚠️ «Рабочий лист» перестал быть отдельным разделом — он стал видом
// «По клиентам» внутри «Задач». Причина: в меню стояли два пункта про ОДИН
// И ТОТ ЖЕ список задач.
//
// Страница оставлена переадресацией намеренно: адрес /worksheet у людей в
// закладках, в переписке и в документах, и ловить «страница не найдена» они
// не должны. Неделя и выбранная пара переносятся как есть.

export default async function WorksheetRedirect({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; owner?: string }>;
}) {
  const { week, owner } = await searchParams;
  const params = new URLSearchParams({ view: "clients" });
  if (week) params.set("week", week);
  if (owner) params.set("owner", owner);
  redirect(`/tasks?${params.toString()}`);
}
