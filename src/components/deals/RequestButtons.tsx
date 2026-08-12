"use client";

import { useState } from "react";
import { Copy, Check, Scale, Image as ImageIcon, Link2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { AD_FORMATS } from "@/lib/enums";
import {
  buildLegalRequest,
  buildPlacementRequest,
  needsOrdMarking,
  internetFormats,
  netAmountOfDeal,
  vatRateForDeal,
  withVat,
  CREATIVE_OWNERS,
  ERID_OWNERS,
  GEO_OPTIONS,
  PAYMENT_SCHEMES,
  SIGNING_OPTIONS,
  type RequestDeal,
} from "@/lib/request-templates";

// ─────────────────────────────────────────────────────────────────────────────
// Два запроса из карточки сделки: юристу на договор и на размещение макетов.
//
// Порядок в жизни: сначала договор и спецификация, потом — когда подписано и
// оплачено — размещение. Кнопки стоят рядом в этом же порядке.
//
// Форма ничего не отправляет: она собирает готовый текст из карточки сделки и
// отмеченных форматов, а человек копирует его в письмо или чат. Реквизиты
// клиента, номер договора и суммы подставляются сами — перепечатывать нечего,
// а значит, и ошибиться в ИНН негде.
// ─────────────────────────────────────────────────────────────────────────────

// Стадии до предоплаты: на них размещение стартовать нельзя (правило домена).
const STAGES_BEFORE_PREPAYMENT = ["Лид", "КП / условия", "Договор", "Приложение / спец."];

export function RequestButtons({ deal, stage }: { deal: RequestDeal; stage: string }) {
  const [open, setOpen] = useState<"legal" | "placement" | null>(null);

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen("legal")} title="Запрос юристу на договор">
        <Scale size={14} className="text-brand" /> Запрос юристу
      </button>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen("placement")}
        title="Запрос на размещение макетов в клубе"
      >
        <ImageIcon size={14} className="text-brand" /> Запрос на размещение
      </button>

      {open === "legal" && <LegalForm deal={deal} onClose={() => setOpen(null)} />}
      {open === "placement" && (
        <PlacementForm deal={deal} stage={stage} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

// ── Общие куски форм ─────────────────────────────────────────────────────────

function FormatPicker({
  chosen,
  onToggle,
}: {
  chosen: string[];
  onToggle: (label: string) => void;
}) {
  return (
    <div>
      <label className="label">Какие форматы *</label>
      <div className="space-y-1.5 rounded-xl border border-ink-800 bg-ink-900/50 p-3">
        {AD_FORMATS.map((f) => (
          <label
            key={f.label}
            className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-ink-800/60"
          >
            <input
              type="checkbox"
              className="mt-0.5 shrink-0"
              checked={chosen.includes(f.label)}
              onChange={() => onToggle(f.label)}
            />
            <span className="text-sm text-ink-200">
              {f.label}
              {f.needsOrd && <span className="ml-1.5 badge badge-brand">ЕРИД</span>}
              {f.note && <span className="ml-1.5 text-xs text-ink-500">{f.note}</span>}
            </span>
          </label>
        ))}
      </div>
      {needsOrdMarking(chosen) && (
        <p className="mt-1.5 text-xs text-amber-300">
          Среди выбранного есть интернет-форматы — по ним нужна маркировка и ЕРИД.
        </p>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

// Готовый текст: показываем и даём скопировать. Текст редактируемый — перед
// отправкой почти всегда хочется что-то дописать своими словами.
function ResultBox({ text, onChange }: { text: string; onChange: (v: string) => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="label mb-0">Готовый текст — можно поправить перед отправкой</label>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
      <textarea
        className="input min-h-[260px] font-mono text-xs leading-relaxed"
        value={text}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function useFormats() {
  const [formats, setFormats] = useState<string[]>([]);
  const toggle = (label: string) =>
    setFormats((s) => (s.includes(label) ? s.filter((x) => x !== label) : [...s, label]));
  return { formats, toggle };
}

function rub(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(value))} ₽`;
}

// ── 1. Запрос юристу на формирование договора ────────────────────────────────

function LegalForm({ deal, onClose }: { deal: RequestDeal; onClose: () => void }) {
  const { formats, toggle } = useFormats();
  const vatRate = vatRateForDeal(deal);
  const netFromDeal = netAmountOfDeal(deal, vatRate);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // Сумму вводим чистой, без НДС: так её называет клиент в переговорах,
  // а «с НДС» досчитывается само и уходит в текст первой строкой.
  const [amountNet, setAmountNet] = useState(netFromDeal ? String(Math.round(netFromDeal)) : "");
  const [geo, setGeo] = useState<string>(GEO_OPTIONS[0]);
  const [geoOther, setGeoOther] = useState("");
  const [creativesBy, setCreativesBy] = useState<string>(CREATIVE_OWNERS[0]);
  const [eridBy, setEridBy] = useState<string>(ERID_OWNERS[0]);
  const [signing, setSigning] = useState<string>(SIGNING_OPTIONS[0]);
  const [paymentScheme, setPaymentScheme] = useState<string>(PAYMENT_SCHEMES[0]);
  const [paymentOther, setPaymentOther] = useState("");
  const [secondAppendix, setSecondAppendix] = useState(true);
  const [specialTerms, setSpecialTerms] = useState("");
  const [comment, setComment] = useState("");
  // Черновик держим отдельно: как только человек правит текст руками, форма
  // перестаёт его перетирать — иначе правки пропадали бы от каждой галочки.
  const [edited, setEdited] = useState<string | null>(null);

  // Любое изменение поля сбрасывает ручную правку: текст снова собирается сам.
  function set<T>(fn: (v: T) => void) {
    return (v: T) => {
      fn(v);
      setEdited(null);
    };
  }

  const generated = buildLegalRequest(deal, {
    formats,
    startDate,
    endDate,
    amountNet,
    vatRate,
    geo,
    geoOther,
    creativesBy,
    eridBy,
    signing,
    paymentScheme,
    paymentOther,
    secondAppendix,
    specialTerms,
    comment,
  });
  const text = edited ?? generated;

  const net = Number(amountNet.replace(/\s/g, "").replace(",", "."));
  const netOk = amountNet.trim() !== "" && Number.isFinite(net) && net > 0;
  const internet = internetFormats(formats);

  // Без реквизитов юрист договор не составит — говорим об этом до отправки,
  // а не после того, как запрос уже ушёл.
  const a = deal.advertiser;
  const missing = [
    a.legalEntity ? null : "юрлицо",
    a.inn ? null : "ИНН",
    a.address ? null : "юридический адрес",
    a.signatory ? null : "подписант",
  ].filter(Boolean) as string[];

  return (
    <Modal
      open
      onClose={onClose}
      title="Запрос юристу на договор"
      subtitle="Реквизиты и суммы подставлены из карточки — перепечатывать не нужно"
      size="lg"
    >
      <div className="space-y-4">
        {missing.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            У клиента не заполнено: {missing.join(", ")}. Юристу это понадобится — впишите в карточке
            клиента, и текст соберётся полностью.
          </div>
        )}

        <FormatPicker chosen={formats} onToggle={set(toggle)} />

        {/* Второе приложение: интернет-форматы живут по своим правилам —
            маркировка и отчётность в ОРД, — и юристу удобнее разносить их
            отдельным приложением. Галочка появляется, только когда есть что
            разносить. */}
        {internet.length > 0 && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2.5">
            <input
              type="checkbox"
              className="mt-0.5 shrink-0"
              checked={secondAppendix}
              onChange={(e) => set(setSecondAppendix)(e.target.checked)}
            />
            <span className="text-sm text-ink-200">
              Отдельное приложение под интернет-форматы
              <span className="ml-1.5 text-xs text-ink-500">
                Приложение № 1 — клубы, Приложение № 2 — интернет ({internet.length} шт.)
              </span>
            </span>
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Начало размещения">
            <input
              className="input"
              type="date"
              value={startDate}
              onChange={(e) => set(setStartDate)(e.target.value)}
            />
          </Field>
          <Field label="Конец размещения">
            <input
              className="input"
              type="date"
              value={endDate}
              onChange={(e) => set(setEndDate)(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Сумма без НДС"
            hint={
              netOk
                ? `С НДС ${vatRate}% — ${rub(withVat(net, vatRate))} (в том числе НДС ${rub(withVat(net, vatRate) - net)})`
                : `Впишите чистую сумму — НДС ${vatRate}% досчитается сам`
            }
          >
            <input
              className="input"
              inputMode="numeric"
              value={amountNet}
              onChange={(e) => set(setAmountNet)(e.target.value)}
              placeholder="напр. 100000"
            />
          </Field>
          <Field label="Порядок оплаты">
            <select
              className="input"
              value={paymentScheme}
              onChange={(e) => set(setPaymentScheme)(e.target.value)}
            >
              {PAYMENT_SCHEMES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {paymentScheme === "Другое" && (
              <input
                className="input mt-2"
                value={paymentOther}
                onChange={(e) => set(setPaymentOther)(e.target.value)}
                placeholder="напр. 30% предоплата, остальное по факту размещения"
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="География размещения">
            <select className="input" value={geo} onChange={(e) => set(setGeo)(e.target.value)}>
              {GEO_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            {geo === "Другое" && (
              <input
                className="input mt-2"
                value={geoOther}
                onChange={(e) => set(setGeoOther)(e.target.value)}
                placeholder="напр. клубы Санкт-Петербурга и Ленобласти"
              />
            )}
          </Field>
          <Field label="Где подписываем">
            <select className="input" value={signing} onChange={(e) => set(setSigning)(e.target.value)}>
              {SIGNING_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Макеты готовит">
            <select
              className="input"
              value={creativesBy}
              onChange={(e) => set(setCreativesBy)(e.target.value)}
            >
              {CREATIVE_OWNERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Маркировку (ЕРИД) получает"
            hint={internet.length === 0 ? "Появится в тексте, когда выберете интернет-формат" : undefined}
          >
            <select
              className="input"
              value={eridBy}
              disabled={internet.length === 0}
              onChange={(e) => set(setEridBy)(e.target.value)}
            >
              {ERID_OWNERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Особые условия">
            <input
              className="input"
              value={specialTerms}
              onChange={(e) => set(setSpecialTerms)(e.target.value)}
              placeholder="напр. эксклюзив по категории"
            />
          </Field>
          <Field label="Комментарий юристу">
            <input
              className="input"
              value={comment}
              onChange={(e) => set(setComment)(e.target.value)}
              placeholder="что важно учесть"
            />
          </Field>
        </div>

        <ResultBox text={text} onChange={setEdited} />

        <div className="flex justify-end">
          <button className="btn btn-ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── 2. Запрос на размещение макетов в клубе ──────────────────────────────────

function PlacementForm({
  deal,
  stage,
  onClose,
}: {
  deal: RequestDeal;
  stage: string;
  onClose: () => void;
}) {
  const { formats, toggle } = useFormats();
  const [links, setLinks] = useState<Record<string, string>>({});
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [materials, setMaterials] = useState("");
  const [erid, setErid] = useState("");
  const [comment, setComment] = useState("");
  const [edited, setEdited] = useState<string | null>(null);

  function set<T>(fn: (v: T) => void) {
    return (v: T) => {
      fn(v);
      setEdited(null);
    };
  }

  const generated = buildPlacementRequest(deal, {
    formats,
    links,
    startDate,
    endDate,
    materials,
    erid,
    comment,
  });
  const text = edited ?? generated;
  const tooEarly = STAGES_BEFORE_PREPAYMENT.includes(stage);

  return (
    <Modal
      open
      onClose={onClose}
      title="Запрос на размещение макетов"
      subtitle="Второй шаг: договор подписан, предоплата прошла — размещаем"
      size="lg"
    >
      <div className="space-y-4">
        {tooEarly && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Сделка на стадии «{stage}». Размещение стартует только после предоплаты — запрос можно
            подготовить заранее, но отправлять его рано.
          </div>
        )}

        <FormatPicker chosen={formats} onToggle={set(toggle)} />

        {/* Ссылка по каждому формату: в кликабельные баннеры вшивается UTM
            клиента, в статичные — ссылка под QR-код. Одного поля на весь
            запрос не хватает: ссылки у форматов разные. */}
        {formats.length > 0 && (
          <div>
            <label className="label">Ссылки клиента по форматам</label>
            <div className="space-y-2 rounded-xl border border-ink-800 bg-ink-900/50 p-3">
              {formats.map((label) => (
                <div key={label}>
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-ink-400">
                    <Link2 size={12} className="shrink-0 text-ink-500" />
                    <span className="truncate">{label}</span>
                  </div>
                  <input
                    className="input"
                    value={links[label] ?? ""}
                    onChange={(e) => set(setLinks)({ ...links, [label]: e.target.value })}
                    placeholder="UTM-ссылка или ссылка под QR-код — пусто, если не нужна"
                  />
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Уходят в запрос строкой под своим форматом — клубу не придётся гадать, какую ссылку куда
              вшивать.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Начало размещения">
            <input
              className="input"
              type="date"
              value={startDate}
              onChange={(e) => set(setStartDate)(e.target.value)}
            />
          </Field>
          <Field label="Конец размещения">
            <input
              className="input"
              type="date"
              value={endDate}
              onChange={(e) => set(setEndDate)(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Где макеты">
          <input
            className="input"
            value={materials}
            onChange={(e) => set(setMaterials)(e.target.value)}
            placeholder="ссылка на папку — или оставьте пустым, будет «во вложении»"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ЕРИД">
            <input
              className="input"
              value={erid}
              onChange={(e) => set(setErid)(e.target.value)}
              placeholder="если маркировка уже получена"
            />
          </Field>
          <Field label="Комментарий">
            <input
              className="input"
              value={comment}
              onChange={(e) => set(setComment)(e.target.value)}
              placeholder="что важно учесть при размещении"
            />
          </Field>
        </div>

        <ResultBox text={text} onChange={setEdited} />

        <div className="flex justify-end">
          <button className="btn btn-ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </Modal>
  );
}
