import { NextRequest } from "next/server";
import { withSession, ok } from "@/lib/api";
import { handoverPreviewSchema } from "@/lib/validation";
import { buildHandoverSummary } from "@/lib/services/handover";

// Саммари ДО передачи: сотрудник читает, правит и только потом отправляет.
export async function POST(req: NextRequest) {
  return withSession(async () => {
    const { advertiserIds } = handoverPreviewSchema.parse(await req.json());
    const summary = await buildHandoverSummary(advertiserIds);
    return ok({ summary });
  });
}
