import type { Emph, Line, Style, Word, WordEdit } from "./types.ts";

export const FPS = 30;
export const ENV_HZ = 30;
export const W = 1080;
export const H = 1920;

/** Song time (s) shown at a video frame. */
export const songTime = (frame: number, start: number, rate: number) => start + (frame / FPS) * rate;
/** Video frames elapsed since a song time `t0` (negative = not yet). */
export const framesSince = (t: number, t0: number, rate: number) => ((t - t0) / rate) * FPS;

type LetrasDoc = {
  offset?: number | null;
  word_offset?: number | null;
  lines: { t: number | null; end?: number; text: string; words?: { t: number; end?: number; w: string }[] }[];
};

/** A letras lyrics document → timed lines with word ids, its offsets applied. Lines without time are dropped. */
export function fromLetras(doc: LetrasDoc): Line[] {
  const off = doc.offset ?? 0;
  const woff = off + (doc.word_offset ?? 0);
  const timed = doc.lines.map((l, i) => ({ l, i })).filter(({ l }) => l.t != null && l.text.trim());
  return timed.map(({ l, i }, k) => {
    const t = l.t! + off;
    const next = timed[k + 1]?.l.t;
    const end = l.end != null ? l.end + off : next != null ? next + off : t + 4;
    const raw = l.words?.length ? l.words : spread(l.text, l.t!, end - off);
    const words = raw.map((w, j) => ({
      id: `${i}:${j}`,
      t: w.t + (l.words?.length ? woff : off),
      end: (w.end ?? raw[j + 1]?.t ?? end - off) + (l.words?.length ? woff : off),
      w: w.w,
    }));
    return { id: String(i), t, end, text: l.text, words };
  });
}

/** Line timed only by its start: share its duration among the words by length. */
function spread(text: string, t: number, end: number) {
  const ws = text.split(/\s+/).filter(Boolean);
  const total = ws.reduce((a, w) => a + w.length + 1, 0);
  let at = t;
  return ws.map((w) => {
    const d = ((end - t) * (w.length + 1)) / total;
    const out = { t: at, end: at + d, w };
    at += d;
    return out;
  });
}

export type Group = { words: Word[]; t: number; end: number; line: number; index: number };

const PAUSE = 0.6; // a gap this long inside a line starts a new group
const HOLD = 0.5; // how long the last group stays after its last word when nothing follows

/** Words → what is on screen together. chunk = max words per group (per line if a function), 0 = one group per line. */
export function groups(lines: Line[], edits: Record<string, WordEdit>, chunkOf: number | ((l: Line) => number)): Group[] {
  const out: Group[] = [];
  lines.forEach((line, li) => {
    const chunk = typeof chunkOf === "number" ? chunkOf : chunkOf(line);
    let cur: Word[] = [];
    const flush = () => {
      if (cur.length) out.push({ words: cur, t: cur[0].t, end: 0, line: li, index: out.length });
      cur = [];
    };
    for (const w of line.words) {
      if (has(edits[w.id], "hide")) continue;
      const prev = cur[cur.length - 1];
      if (
        prev &&
        (edits[w.id]?.br ||
          w.t - prev.end > PAUSE ||
          (chunk > 0 && (cur.length >= chunk || /[,.!?;:]$/.test(prev.w))))
      )
        flush();
      cur.push(w);
    }
    flush();
  });
  out.forEach((g, i) => {
    const last = g.words[g.words.length - 1].end;
    const next = out[i + 1]?.t ?? Infinity;
    g.end = next - last < 1.2 ? next : last + HOLD;
  });
  return out;
}

/** Index of the last group that started at or before t, or -1. */
export function groupAt(gs: Group[], t: number) {
  let lo = 0;
  let hi = gs.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (gs[mid].t <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Group on screen at t (null in pauses). */
export function activeGroup(gs: Group[], t: number) {
  const i = groupAt(gs, t);
  return i >= 0 && t < gs[i].end ? gs[i] : null;
}

/** Last beat ≤ t: its index and seconds since. */
export function lastBeat(beats: number[], t: number) {
  let lo = 0;
  let hi = beats.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid] <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return { index: ans, since: ans < 0 ? Infinity : t - beats[ans] };
}

/** 1 right on a beat, decaying to 0. */
export const pulse = (beats: number[], t: number, decay = 0.14) => Math.exp(-lastBeat(beats, t).since / decay);

export const envAt = (env: number[], t: number) => env[Math.max(0, Math.floor(t * ENV_HZ))] ?? 0;

export const has = (e: WordEdit | undefined, k: Emph) => !!e?.emph?.includes(k);

export function wordText(w: Word, edits: Record<string, WordEdit>, style: Style) {
  const s = edits[w.id]?.text ?? w.w;
  return style.case === "upper" ? s.toUpperCase() : style.case === "lower" ? s.toLowerCase() : s;
}

/** Deterministic 0..1 noise: renders must give the same frame every time. */
export function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

/** Video length in frames for a song range played at `rate`. */
export const durationOf = (p: { start: number; end: number; rate: number }) =>
  Math.max(1, Math.round(((p.end - p.start) / p.rate) * FPS));
