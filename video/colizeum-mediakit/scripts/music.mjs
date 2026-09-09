import fs from "node:fs";

// Оригинальный трек для ролика: 120 BPM, ля минор, 16 тактов = 32 с.
const SR = 44100;
const BPM = 120;
const BEAT = 60 / BPM;          // 0.5 c
const BAR = BEAT * 4;           // 2 c
const BARS = 47;
const TAIL = 1.6;
const DUR = BARS * BAR + TAIL;
const N = Math.ceil(DUR * SR);

const L = new Float64Array(N);
const R = new Float64Array(N);
const duck = new Float64Array(N).fill(1);

const add = (i, l, r) => {
  if (i >= 0 && i < N) {
    L[i] += l;
    R[i] += r;
  }
};

const noise = () => Math.random() * 2 - 1;

// Аккорды: Am – F – C – G
const CHORDS = [
  { root: 110.0, tones: [440.0, 523.25, 659.25] },
  { root: 87.31, tones: [349.23, 440.0, 523.25] },
  { root: 130.81, tones: [392.0, 523.25, 659.25] },
  { root: 98.0, tones: [392.0, 493.88, 587.33] },
];

function kick(t0) {
  const len = 0.42;
  const n = Math.floor(len * SR);
  let phase = 0;
  for (let k = 0; k < n; k++) {
    const x = k / SR;
    const f = 48 + 130 * Math.exp(-x * 34);
    phase += (2 * Math.PI * f) / SR;
    const env = Math.exp(-x * 8.5) * (1 - Math.exp(-x * 900));
    const s = Math.tanh(Math.sin(phase) * 2.1) * env * 0.92;
    const i = Math.floor(t0 * SR) + k;
    add(i, s, s);
  }
  // сайдчейн: всё остальное «приседает» под бочку
  const dn = Math.floor(0.34 * SR);
  for (let k = 0; k < dn; k++) {
    const i = Math.floor(t0 * SR) + k;
    if (i >= 0 && i < N) {
      const v = 0.42 + 0.58 * (1 - Math.exp(-(k / SR) * 11));
      duck[i] = Math.min(duck[i], v);
    }
  }
}

function clap(t0, gain = 0.5) {
  const n = Math.floor(0.22 * SR);
  for (let k = 0; k < n; k++) {
    const x = k / SR;
    const env = Math.exp(-x * 26) * (1 - Math.exp(-x * 2200));
    const s = noise() * env * gain;
    const i = Math.floor(t0 * SR) + k;
    add(i, s * 0.9, s);
  }
}

function hat(t0, open = false, gain = 0.24) {
  const len = open ? 0.16 : 0.045;
  const n = Math.floor(len * SR);
  let hp = 0;
  for (let k = 0; k < n; k++) {
    const x = k / SR;
    const env = Math.exp(-x * (open ? 22 : 90));
    const raw = noise();
    hp = 0.86 * hp + 0.86 * (raw - (hp || 0));
    const s = raw * env * gain;
    const i = Math.floor(t0 * SR) + k;
    add(i, s * 0.8, s);
  }
}

function bass(t0, freq, len, gain = 0.5) {
  const n = Math.floor(len * SR);
  let phase = 0;
  for (let k = 0; k < n; k++) {
    const x = k / SR;
    phase += (2 * Math.PI * freq) / SR;
    const saw = 2 * ((phase / (2 * Math.PI)) % 1) - 1;
    const sub = Math.sin(phase);
    const env =
      Math.min(1, x * 220) * Math.exp(-x * 2.4) * (x > len - 0.02 ? 0.3 : 1);
    const s = (saw * 0.35 + sub * 0.75) * env * gain;
    const i = Math.floor(t0 * SR) + k;
    add(i, s, s);
  }
}

function pluck(t0, freq, len, gain = 0.22, pan = 0) {
  const n = Math.floor(len * SR);
  let phase = 0;
  for (let k = 0; k < n; k++) {
    const x = k / SR;
    phase += (2 * Math.PI * freq) / SR;
    const tri = Math.asin(Math.sin(phase)) * (2 / Math.PI);
    const env = Math.exp(-x * 11) * (1 - Math.exp(-x * 900));
    const s = (Math.sin(phase) * 0.6 + tri * 0.4) * env * gain;
    const i = Math.floor(t0 * SR) + k;
    add(i, s * (1 - Math.max(0, pan)), s * (1 + Math.min(0, pan)));
  }
}

function pad(t0, tones, len, gain = 0.1) {
  const n = Math.floor(len * SR);
  const ph = tones.map(() => [0, 0]);
  for (let k = 0; k < n; k++) {
    const x = k / SR;
    const env = Math.min(1, x * 2.2) * Math.min(1, (len - x) * 2.2);
    let sl = 0;
    let sr = 0;
    tones.forEach((f, ti) => {
      ph[ti][0] += (2 * Math.PI * (f / 2)) / SR;
      ph[ti][1] += (2 * Math.PI * ((f / 2) * 1.006)) / SR;
      sl += Math.sin(ph[ti][0]);
      sr += Math.sin(ph[ti][1]);
    });
    const i = Math.floor(t0 * SR) + k;
    add(i, (sl / tones.length) * env * gain, (sr / tones.length) * env * gain);
  }
}

function riser(t0, len, gain = 0.3) {
  const n = Math.floor(len * SR);
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const x = k / SR;
    const p = x / len;
    const cut = 0.02 + 0.5 * p * p;
    lp += cut * (noise() - lp);
    const env = p * p * gain;
    const s = lp * env * 3;
    const i = Math.floor(t0 * SR) + k;
    add(i, s, s * 0.9);
  }
}

function impact(t0, gain = 0.7) {
  const n = Math.floor(1.2 * SR);
  let phase = 0;
  for (let k = 0; k < n; k++) {
    const x = k / SR;
    const f = 40 + 90 * Math.exp(-x * 6);
    phase += (2 * Math.PI * f) / SR;
    const env = Math.exp(-x * 3.2);
    const s = (Math.sin(phase) * 0.8 + noise() * 0.12 * Math.exp(-x * 14)) * env * gain;
    const i = Math.floor(t0 * SR) + k;
    add(i, s, s);
  }
}

// ── Аранжировка по тактам ───────────────────────────────────────────────
// 0-1 вступление · 2-3 разгон · 4-11 основная часть · 12-13 передышка
// 14-15 разгон · 16-27 пик · 28-29 финал
const plan = (bar) => ({
  full: (bar >= 4 && bar <= 11) || (bar >= 14 && bar <= 45),
  peak: bar >= 30,
  beatIn: (bar >= 2 && bar <= 11) || bar >= 14,
  breakdown: bar === 12 || bar === 13,
});

for (let bar = 0; bar < BARS; bar++) {
  const t = bar * BAR;
  const chord = CHORDS[bar % 4];
  const { full, peak, beatIn, breakdown } = plan(bar);

  pad(t, chord.tones, BAR + 0.1, bar < 2 || breakdown ? 0.14 : 0.085);

  if (beatIn) {
    const kicks = full ? [0, 1, 2, 3] : [0, 2];
    for (const b of kicks) kick(t + b * BEAT);
  }

  if ((bar >= 3 && !breakdown) || bar === 15) {
    clap(t + BEAT, full ? 0.5 : 0.34);
    clap(t + 3 * BEAT, full ? 0.5 : 0.34);
  }

  if (bar >= 1) {
    const step = full ? BEAT / 2 : BEAT;
    for (let s = 0; s * step < BAR; s++) {
      const open = full && s % 4 === 2;
      hat(t + s * step, open, open ? 0.16 : full ? 0.22 : 0.16);
    }
  }

  if (full) {
    const pattern = [1, 0, 1, 1, 0, 1, 0, 1];
    for (let s = 0; s < 8; s++) {
      if (pattern[s]) bass(t + s * (BEAT / 2), chord.root, BEAT / 2 + 0.05, 0.52);
    }
  } else if (bar === 3 || bar === 15) {
    bass(t, chord.root, BAR, 0.34);
  }

  if (bar >= 4) {
    const seq = [0, 1, 2, 1, 0, 2, 1, 2];
    for (let s = 0; s < 8; s++) {
      const f = chord.tones[seq[s]];
      pluck(t + s * (BEAT / 2), f, 0.4, breakdown ? 0.17 : peak ? 0.2 : 0.15, s % 2 ? 0.25 : -0.25);
      if (peak) pluck(t + s * (BEAT / 2), f * 2, 0.26, 0.075, s % 2 ? -0.3 : 0.3);
    }
  }

  if (bar === 3 || bar === 13 || bar === 29 || bar === 42) {
    riser(t + BAR - 1.4, 1.4, bar === 13 ? 0.36 : 0.28);
  }
  if (bar === 4 || bar === 14 || bar === 30 || bar === 43) {
    impact(t, bar === 43 ? 0.6 : 0.75);
  }

}

// финальный удар и хвост
pad(BARS * BAR - 0.1, CHORDS[0].tones, TAIL, 0.12);

// ── Сведение ────────────────────────────────────────────────────────────
let peakLvl = 0;
for (let i = 0; i < N; i++) {
  L[i] *= duck[i];
  R[i] *= duck[i];
  peakLvl = Math.max(peakLvl, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.92 / peakLvl;
const fadeOut = Math.floor(1.2 * SR);
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(N * 4, 40);

for (let i = 0; i < N; i++) {
  const fade = i > N - fadeOut ? (N - i) / fadeOut : 1;
  const l = Math.max(-1, Math.min(1, Math.tanh(L[i] * norm * 1.15))) * fade;
  const r = Math.max(-1, Math.min(1, Math.tanh(R[i] * norm * 1.15))) * fade;
  buf.writeInt16LE(Math.round(l * 32000), 44 + i * 4);
  buf.writeInt16LE(Math.round(r * 32000), 44 + i * 4 + 2);
}

fs.writeFileSync("public/music.wav", buf);
console.log("music94.wav", (buf.length / 1e6).toFixed(2), "MB,", DUR.toFixed(2), "s");
