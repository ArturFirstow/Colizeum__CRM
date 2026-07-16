import "server-only";
import type { Deal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEAL_STAGES, STAGE_INDEX, type DealStage } from "@/lib/enums";

// Инварианты стадий, проверяемые на бэкенде (блупринт 7.3).
// Возвращаем предупреждения, а не молча блокируем: UI показывает их и просит
// подтверждение (confirm=true). Это соответствует принципу «ассистент, не конвейер».

export interface StageCheck {
  warnings: string[];
}

/**
 * Проверяет переход сделки на стадию toStage. Собирает предупреждения по данным
 * сделки и связанным сущностям. Пустой список = переход безопасен.
 */
export async function checkStageTransition(deal: Deal, toStage: DealStage): Promise<StageCheck> {
  const warnings: string[] = [];
  const toIdx = STAGE_INDEX[toStage];
  const placementIdx = STAGE_INDEX["Размещение"];

  // Предоплата как условие старта размещения (v2, глобальный блокер «Согласование оплат»).
  if (toIdx >= placementIdx) {
    const payments = await prisma.payment.count({
      where: { invoice: { dealId: deal.id } },
    });
    if (payments === 0) {
      warnings.push(
        "Размещение стартует только после предоплаты — по этой сделке нет ни одного зафиксированного платежа.",
      );
    }
  }

  // Сроки согласования: приложения проходят последовательно, нельзя перепрыгнуть.
  if (toIdx > STAGE_INDEX["Приложение / спец."]) {
    const appendices = await prisma.document.count({
      where: { dealId: deal.id, type: { in: ["Приложение", "Спецификация"] } },
    });
    if (appendices === 0) {
      warnings.push(
        "Стадия за «Приложение / спец.», но не заведено ни одного приложения/спецификации. У крупных клиентов этапы строго последовательны.",
      );
    }
  }

  // Большой перепрыг стадий — просьба перепроверить.
  const fromIdx = STAGE_INDEX[deal.stage as DealStage] ?? 0;
  if (toIdx - fromIdx >= 3) {
    warnings.push(
      `Сделка перепрыгивает ${toIdx - fromIdx} стадий (с «${deal.stage}» на «${toStage}»). Убедитесь, что промежуточные шаги действительно пройдены.`,
    );
  }

  return { warnings };
}

export function isValidStage(value: string): value is DealStage {
  return (DEAL_STAGES as readonly string[]).includes(value);
}
