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
  const placementIdx = STAGE_INDEX["Размещение / оказание услуг"];
  const paymentIdx = STAGE_INDEX["Оплата / предоплата"];

  // Предоплата как условие старта размещения (стадия 9).
  if (toIdx >= placementIdx) {
    const payments = await prisma.payment.count({
      where: { invoice: { dealId: deal.id } },
    });
    if (payments === 0) {
      warnings.push(
        "Размещение открывается только после зафиксированной предоплаты — по этой сделке нет ни одного платежа.",
      );
    }
  }

  // Последовательные приложения (кейс Т-Банк): нельзя перепрыгнуть согласование.
  if (toIdx > STAGE_INDEX["Согласование приложений / ЭДО"]) {
    const appendices = await prisma.document.count({
      where: { dealId: deal.id, type: "Приложение" },
    });
    if (deal.contractConstruction === "B" && appendices === 0) {
      warnings.push(
        "Конструкция B (мероприятие + Приложения): не заведено ни одного Приложения, но стадия уже за согласованием приложений.",
      );
    }
  }

  // Финмаршрутизация ИП: подсветка блокера на стадии интеграции эквайринга.
  if (toStage === "Интеграция / тех. подключение") {
    warnings.push(
      "Проверьте финмаршрут: платежи по клубу на ИП нельзя проводить через счёт УК. Смена ИП сдвигает интеграцию эквайринга.",
    );
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
