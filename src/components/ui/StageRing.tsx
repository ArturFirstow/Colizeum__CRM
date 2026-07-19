"use client";

import { useEffect, useState } from "react";
import { DEAL_STAGES } from "@/lib/enums";

const R = 20;
const CIRC = 2 * Math.PI * R;

// «Кинетика»: кольцо прогресса по 9 стадиям сделки — заполняется при появлении.
export function StageRing({ stage, size = 48 }: { stage: string; size?: number }) {
  const idx = Math.max(0, DEAL_STAGES.indexOf(stage as (typeof DEAL_STAGES)[number]));
  const pct = (idx + 1) / DEAL_STAGES.length;
  const [offset, setOffset] = useState(CIRC);

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = CIRC * (1 - pct);
    if (reduced) {
      setOffset(target);
      return;
    }
    const id = setTimeout(() => setOffset(target), 120);
    return () => clearTimeout(id);
  }, [pct]);

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-label={`Стадия: ${stage}`}>
      <circle cx="24" cy="24" r={R} fill="none" stroke="#333" strokeWidth="5" />
      <circle
        cx="24"
        cy="24"
        r={R}
        fill="none"
        stroke="#FCDF3B"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={offset}
        transform="rotate(-90 24 24)"
        style={{ transition: "stroke-dashoffset 1s cubic-bezier(.3,.8,.3,1)" }}
      />
      <text
        x="24"
        y="27"
        textAnchor="middle"
        fill="#F1F1F1"
        fontSize="11"
        fontWeight="700"
        fontFamily="var(--font-display)"
      >
        {idx + 1}/9
      </text>
    </svg>
  );
}
