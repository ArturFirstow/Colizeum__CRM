import { formatMoney } from "@/lib/format";
import { vatRateForDate } from "@/lib/enums";

// ─────────────────────────────────────────────────────────────────────────────
// Единый вид денег по всему сервису. Два правила, и они не спорят друг с другом.
//
// ВВОД: человек всегда вносит ЧИСТУЮ сумму, без НДС. Так приходят медиапланы,
// так обсуждают цену с клиентом, и так меньше всего шансов ошибиться. НДС
// сервис досчитывает сам.
//
// ПОКАЗ: сумма всегда показывается С НДС крупно, а чистая — подписью снизу.
// Юристу и бухгалтеру нужна сумма с НДС, поэтому она и стоит первой.
//
// Раньше эти два правила жили порознь: в запросе юристу НДС прибавлялся
// к введённой сумме, а в карточке сделки — вычитался из неё же. Одно и то же
// число показывалось как 122 000 и как 82 000.
//
// vatIncluded — как сумма лежит в базе. По новому правилу это всегда «чисто»
// (false). Флажок оставлен для старых записей, заведённых до этого правила.
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

/**
 * Сумма с НДС для мест, где цифра рисуется своей вёрсткой (итоги таблиц,
 * плитки, узкие клетки календаря) и целый блок `Money` туда не влезает.
 */
export function toGross(amount: number, date?: Date | string | null, vatIncluded = false): number {
  const d = date ? new Date(date) : new Date();
  const rate = vatRateForDate(Number.isNaN(d.getTime()) ? new Date() : d);
  return Math.round(grossOf(amount, vatIncluded, rate));
}

/** Пара к `toGross`: чистая сумма той же записи. */
export function toNet(amount: number, date?: Date | string | null, vatIncluded = false): number {
  const d = date ? new Date(date) : new Date();
  const rate = vatRateForDate(Number.isNaN(d.getTime()) ? new Date() : d);
  return Math.round(netOf(amount, vatIncluded, rate));
}

/**
 * Сумма по списку записей — с НДС и чистая.
 *
 * ⚠️ Считать надо ПО КАЖДОЙ записи и только потом складывать. Сложить сначала,
 * а потом домножить — нельзя: у части сделок в базе сумма лежит с НДС (записи
 * до правила «вводим чистую»), и общий множитель раздувал их ещё на 22 %.
 * Из-за этого одна и та же сделка показывалась в «Сделках» как 16 644 174 ₽,
 * а на главной и в «Оплатах» — как 20 305 892 ₽.
 */
export function sumMoney(
  rows: { amount?: number | null; vatIncluded?: boolean; date?: Date | string | null }[],
): { gross: number; net: number } {
  let gross = 0;
  let net = 0;
  for (const r of rows) {
    if (r.amount == null) continue;
    gross += toGross(r.amount, r.date, r.vatIncluded ?? false);
    net += toNet(r.amount, r.date, r.vatIncluded ?? false);
  }
  return { gross, net };
}

export function Money({
  amount,
  vatIncluded = false,
  date,
  className = "",
  size = "sm",
  align = "left",
}: {
  amount?: number | null;
  /** Как сумма лежит в базе. По новому правилу — чистой, без НДС. */
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
  vatIncluded = false,
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
