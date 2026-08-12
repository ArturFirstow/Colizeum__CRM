import { formatMoney } from "@/lib/format";
import { vatRateForDate } from "@/lib/enums";

// ─────────────────────────────────────────────────────────────────────────────
// Единый вид денег по всему сервису.
//
// Правило, о котором договорились: сумма всегда пишется С НДС, а чистая сумма
// идёт подписью снизу. Раньше в одном месте стояло «1 000 000», в другом
// «1 220 000», и понять, про одну и ту же сделку речь или про разные, было
// нельзя.
//
// Ставка НДС берётся по дате документа (2025 → 20 %, 2026 → 22 %), а не
// прибивается гвоздями: в переходный год в сервисе живут суммы обеих ставок.
// ─────────────────────────────────────────────────────────────────────────────

/** Сумма с НДС: если в базе она лежит чистой, домножаем. */
export function grossOf(amount: number, vatIncluded: boolean, rate: number): number {
  return vatIncluded ? amount : amount * (1 + rate / 100);
}

/** Чистая сумма: если в базе она лежит с НДС, делим. */
export function netOf(amount: number, vatIncluded: boolean, rate: number): number {
  return vatIncluded ? amount / (1 + rate / 100) : amount;
}

export function Money({
  amount,
  vatIncluded = true,
  date,
  className = "",
  size = "sm",
  align = "left",
}: {
  amount?: number | null;
  /** Как сумма лежит в базе. По умолчанию — с НДС. */
  vatIncluded?: boolean;
  /** Дата документа: по ней выбирается ставка. */
  date?: Date | string | null;
  className?: string;
  size?: "sm" | "lg";
  align?: "left" | "right";
}) {
  if (amount == null) return <span className="text-ink-500">—</span>;

  const d = date ? new Date(date) : new Date();
  const rate = vatRateForDate(Number.isNaN(d.getTime()) ? new Date() : d);
  const gross = grossOf(amount, vatIncluded, rate);
  const net = netOf(amount, vatIncluded, rate);

  return (
    <div className={`leading-tight ${align === "right" ? "text-right" : ""} ${className}`}>
      <div className={size === "lg" ? "text-lg font-semibold text-ink-100" : "text-sm text-ink-200"}>
        {formatMoney(Math.round(gross))} <span className="text-ink-500">с НДС {rate}%</span>
      </div>
      <div className="text-[11px] text-ink-500">без НДС ≈ {formatMoney(Math.round(net))}</div>
    </div>
  );
}

/**
 * Только подпись «без НДС ≈ …» — там, где сумма уже нарисована по-своему
 * (итоги таблиц, плитки), и переверстывать её ради единообразия не нужно.
 */
export function NetHint({
  amount,
  vatIncluded = true,
  date,
  className = "",
}: {
  amount?: number | null;
  vatIncluded?: boolean;
  date?: Date | string | null;
  className?: string;
}) {
  if (amount == null || amount === 0) return null;
  const d = date ? new Date(date) : new Date();
  const rate = vatRateForDate(Number.isNaN(d.getTime()) ? new Date() : d);
  return (
    <div className={`text-[11px] font-normal text-ink-500 ${className}`}>
      без НДС ≈ {formatMoney(Math.round(netOf(amount, vatIncluded, rate)))}
    </div>
  );
}
