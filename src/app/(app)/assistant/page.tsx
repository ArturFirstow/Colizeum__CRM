import { requireSession } from "@/lib/auth";
import { AssistantChat } from "@/components/ai/AssistantChat";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  await requireSession();
  return <AssistantChat />;
}
