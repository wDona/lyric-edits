import { PRESETS, presetStyle } from "../remotion/presets.ts";
import { envAt, groups, rand } from "../remotion/timing.ts";
import type { Line, Style, TemplateId, WordEdit } from "../remotion/types.ts";

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Default clip: the most repeated line (usually the chorus) and what follows, about 15 s. */
export function chorusRange(lines: Line[]) {
  if (!lines.length) return { start: 0, end: 15 };
  const count = new Map<string, number>();
  lines.forEach((l) => count.set(norm(l.text), (count.get(norm(l.text)) ?? 0) + 1));
  let first = 0;
  lines.forEach((l, i) => {
    if ((count.get(norm(l.text)) ?? 0) > (count.get(norm(lines[first].text)) ?? 0)) first = i;
  });
  const start = Math.max(0, lines[first].t - 0.25);
  let last = first;
  while (lines[last + 1] && lines[last + 1].end - start <= 18) last++;
  return { start, end: Math.max(lines[last].end + 0.4, start + 4) };
}

// [base, light 1, light 2, accent]
const PALETTES = [
  ["#14051f", "#ff2e7e", "#2b59ff", "#ffe14d"],
  ["#050505", "#3a0d1e", "#0d1a3a", "#ff4d8d"],
  ["#0a1020", "#00c2ff", "#7a3dff", "#9dff6a"],
  ["#1a0a00", "#ff7a1a", "#ff1f3d", "#fff2c2"],
  ["#000000", "#2b2b2b", "#5a0010", "#ff1f3d"],
  ["#0b0b14", "#6b4a7a", "#2d3f66", "#ffd6f0"],
  ["#03140f", "#00b386", "#0047ab", "#e8ff59"],
];

export type SongFacts = { key: string; title: string; lines: Line[]; beats: number[]; bpm: number | null; env: number[] };
export type Auto = { start: number; end: number; style: Style; edits: Record<string, WordEdit> };

/** Mean loudness of a range, 0..1. */
export function energyOf(env: number[], start: number, end: number) {
  let s = 0;
  let n = 0;
  for (let t = start; t < end; t += 0.1, n++) s += envAt(env, t);
  return n ? s / n : 0.5;
}

/** Templates a song's tempo and loudness ask for, four of them to mix; `seed` rolls other ones. */
function pickMix(bpm: number | null, energy: number, seed: number): TemplateId[] {
  const fits: TemplateId[] =
    (bpm ?? 110) >= 125 && energy > 0.6
      ? ["glitch", "echo", "zoom", "stack", "pop", "bounce"]
      : (bpm ?? 110) < 88 || energy < 0.4
        ? ["dreamy", "neon", "typewriter", "zoom", "reel", "bounce"]
        : ["pop", "stack", "bounce", "zoom", "scatter", "echo", "glitch", "reel"];
  const r = seed % fits.length;
  return [...fits.slice(r), ...fits.slice(0, r)].slice(0, 4);
}

/**
 * One-click edit without asking anyone: the chorus, a template for the song's feel, colors,
 * and the words a human editor would push: held notes big, title words in the accent color.
 */
export function autoEdit(song: SongFacts, { seed = 0, base, range }: { seed?: number; base?: Style; range?: { start: number; end: number } } = {}): Auto {
  const { start, end } = range ?? chorusRange(song.lines);
  const energy = energyOf(song.env, start, end);
  const h = [...song.key].reduce((a, c) => a + c.charCodeAt(0), 0) + seed * 7;
  let style: Style;
  if (base) style = structuredClone(base);
  else {
    const mix = pickMix(song.bpm, energy, seed);
    style = { ...presetStyle(mix[0]), mix, mixLooks: true, mixSeed: seed, mixBy: "words", mixMin: 4, mixMax: 8 };
    if (seed > 0 || style.template === "pop") {
      const [c1, c2, c3, accent] = PALETTES[h % PALETTES.length];
      style.bg = { ...style.bg, c1, c2, c3 };
      style.accent = accent;
    }
  }
  if (!song.beats.length) style.fx = { ...style.fx, shake: 0, flash: 0, rgb: style.fx.rgb * 0.3 };
  return { start, end, style, edits: emphasis(song, start, end, h) };
}

export function emphasis(song: Pick<SongFacts, "title" | "lines">, start: number, end: number, h = 0) {
  const edits: Record<string, WordEdit> = {};
  const title = new Set(norm(song.title).split(" ").filter((w) => w.length > 2));
  const inRange = song.lines.filter((l) => l.end > start && l.t < end);
  for (const g of groups(inRange, {}, 0)) {
    // the longest-held word of each line, if it is really held
    const held = g.words.reduce((a, w) => (w.end - w.t > a.end - a.t ? w : a));
    if (held.end - held.t > 0.45 && held.w.replace(/\W/g, "").length > 2) edits[held.id] = { emph: ["big", rand(h + g.index) > 0.5 ? "alt" : "accent"] };
    for (const w of g.words) if (title.has(norm(w.w)) && !edits[w.id]) edits[w.id] = { emph: ["accent"] };
  }
  return edits;
}

const HEX = /^#[0-9a-f]{6}$/i;
const RATES = [0.8, 0.9, 1, 1.15, 1.3];
const EMPH = new Set(["accent", "big", "alt", "hide"]);
const num = (v: unknown, fallback: number) => (typeof v === "number" && isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);

/** What the director (Claude) is told about the clip. */
export function brief(song: SongFacts & { artist: string }, start: number, end: number) {
  return {
    artist: song.artist,
    title: song.title,
    bpm: song.bpm,
    energy: Math.round(energyOf(song.env, start, end) * 100) / 100,
    lines: song.lines
      .filter((l) => l.end > start && l.t < end)
      .map((l) => ({ id: l.id, words: l.words.map((w) => ({ id: w.id, w: w.w, d: Math.round((w.end - w.t) * 100) / 100 })) })),
  };
}

/** A director's JSON plan → style and edits; anything malformed or unknown is ignored. */
export function applyPlan(plan: any, style: Style, ids: Set<string>) {
  const out: Style = Object.hasOwn(PRESETS, plan?.template ?? "") ? presetStyle(plan.template) : structuredClone(style);
  if (Number.isInteger(plan?.chunk) && plan.chunk >= 0 && plan.chunk <= 6) out.chunk = plan.chunk;
  if (["upper", "lower", "none"].includes(plan?.case)) out.case = plan.case;
  const c = plan?.colors ?? {};
  if (HEX.test(c.base)) out.bg.c1 = c.base;
  if (HEX.test(c.light1)) out.bg.c2 = c.light1;
  if (HEX.test(c.light2)) out.bg.c3 = c.light2;
  if (HEX.test(c.accent)) out.accent = c.accent;
  for (const k of ["zoom", "shake", "flash", "rgb", "grain", "vignette", "leaks", "motion", "cut", "bounce"] as const) out.fx[k] = num(plan?.fx?.[k], out.fx[k] ?? 0);
  const edits: Record<string, WordEdit> = {};
  for (const [id, marks] of Object.entries(plan?.emphasis ?? {})) {
    const emph = (Array.isArray(marks) ? marks : []).filter((m) => EMPH.has(m));
    if (ids.has(id) && emph.length) edits[id] = { emph };
  }
  for (const id of Array.isArray(plan?.breaks) ? plan.breaks : []) if (ids.has(id)) edits[id] = { ...edits[id], br: true };
  const isTpl = (t: unknown): t is TemplateId => typeof t === "string" && Object.hasOwn(PRESETS, t);
  const mix = (Array.isArray(plan?.mix) ? plan.mix : []).filter(isTpl);
  if (mix.length > 1) Object.assign(out, { mix, mixLooks: plan?.mixLooks !== false });
  const lineTpl: Record<string, TemplateId> = {};
  for (const [id, tpl] of Object.entries(plan?.lines ?? {})) if (isTpl(tpl) && [...ids].some((w) => w.startsWith(`${id}:`))) lineTpl[id] = tpl;
  return { style: out, edits, lineTpl, rate: RATES.includes(plan?.rate) ? (plan.rate as number) : null, why: typeof plan?.why === "string" ? plan.why : "" };
}
