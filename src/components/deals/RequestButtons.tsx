"use client";

import { useState } from "react";
import { Copy, Check, Scale, Image as ImageIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { AD_FORMATS } from "@/lib/enums";
import {
  buildLegalRequest,
  buildPlacementRequest,
  needsOrdMarking,
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

// ── 1. Запрос юристу на формирование договора ────────────────────────────────

function LegalForm({ deal, onClose }: { deal: RequestDeal; onClose: () => void }) {
  const { formats, toggle } = useFormats();
  const [period, setPeriod] = useState("");
  const [amountText, setAmountText] = useState("");
  const [specialTerms, setSpecialTerms] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [comment, setComment] = useState("");
  // Черновик держим отдельно: как только человек правит текст руками, форма
  // перестаёт его перетирать — иначе правки пропадали бы от каждой галочки.
  const [edited, setEdited] = useState<string | null>(null);

  const generated = buildLegalRequest(deal, { formats, period, amountText, specialTerms, dueDate, comment });
  const text = edited ?? generated;

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

        <FormatPicker
          chosen={formats}
          onToggle={(l) => {
            toggle(l);
            setEdited(null);
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Период размещения</label>
            <input
              className="input"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setEdited(null);
              }}
              placeholder={deal.periodText ?? "напр. 3 месяца с сентября"}
            />
          </div>
          <div>
            <label className="label">Сумма договора</label>
            <input
              className="input"
              value={amountText}
              onChange={(e) => {
                setAmountText(e.target.value);
                setEdited(null);
              }}
              placeholder="пусто — возьмём из сделки"
            />
          </div>
        </div>

        <div>
          <label className="label">Особые условия</label>
          <input
            className="input"
            value={specialTerms}
            onChange={(e) => {
              setSpecialTerms(e.target.value);
              setEdited(null);
            }}
            placeholder="напр. оплата двумя частями, эксклюзив по категории"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">К какому сроку нужен документ</label>
            <input
              className="input"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                setEdited(null);
              }}
              placeholder="напр. 20 августа"
            />
          </div>
          <div>
            <label className="label">Комментарий юристу</label>
            <input
              className="input"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setEdited(null);
              }}
              placeholder="что важно учесть"
            />
          </div>
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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [materials, setMaterials] = useState("");
  const [erid, setErid] = useState("");
  const [comment, setComment] = useState("");
  const [edited, setEdited] = useState<string | null>(null);

  const generated = buildPlacementRequest(deal, { formats, startDate, endDate, materials, erid, comment });
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

        <FormatPicker
          chosen={formats}
          onToggle={(l) => {
            toggle(l);
            setEdited(null);
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Начало размещения</label>
            <input
              className="input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setEdited(null);
              }}
              placeholder="напр. 1 сентября"
            />
          </div>
          <div>
            <label className="label">Конец размещения</label>
            <input
              className="input"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setEdited(null);
              }}
              placeholder="напр. 30 ноября"
            />
          </div>
        </div>

        <div>
          <label className="label">Где макеты</label>
          <input
            className="input"
            value={materials}
            onChange={(e) => {
              setMaterials(e.target.value);
              setEdited(null);
            }}
            placeholder="ссылка на папку — или оставьте пустым, будет «во вложении»"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">ЕРИД</label>
            <input
              className="input"
              value={erid}
              onChange={(e) => {
                setErid(e.target.value);
                setEdited(null);
              }}
              placeholder="если маркировка уже получена"
            />
          </div>
          <div>
            <label className="label">Комментарий</label>
            <input
              className="input"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setEdited(null);
              }}
              placeholder="что важно учесть при размещении"
            />
          </div>
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
