import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { PrivacyView } from "@/components/privacy/PrivacyView";
import { canSeeCompliance } from "@/lib/scope";

export const dynamic = "force-dynamic";

// Ответ на запрос человека о его персональных данных (требования 4.7 и 5.8).
// Обязанность оператора — поэтому доступ только у администратора сервиса.
export default async function PrivacyPage() {
  const session = await requireSession();
  if (!canSeeCompliance(session)) notFound();

  return (
    <div>
      <PageHeader
        title="Запросы по персональным данным"
        subtitle="Показать и удалить данные человека по его обращению. Ответить нужно за 10 рабочих дней"
        icon="🔎"
      />
      <PrivacyView />
    </div>
  );
}
