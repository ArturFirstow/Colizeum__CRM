import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { RetentionView } from "@/components/privacy/RetentionView";
import { canSeeCompliance } from "@/lib/scope";

export const dynamic = "force-dynamic";

// Сроки хранения данных (требование 4.7). Тот же круг лиц, что и у запросов по
// ПДн: это обязанность оператора, а не рядовая задача менеджера.
export default async function RetentionPage() {
  const session = await requireSession();
  if (!canSeeCompliance(session)) notFound();

  return (
    <div>
      <PageHeader
        title="Сроки хранения"
        subtitle="Сколько храним каждый вид данных и что убираем, когда срок вышел"
        icon="⏳"
      />
      <RetentionView />
    </div>
  );
}
