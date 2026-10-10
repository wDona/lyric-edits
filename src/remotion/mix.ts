import { looksOf, PRESETS } from "./presets.ts";
import { rand } from "./timing.ts";
import type { Line, Style, TemplateId } from "./types.ts";

const valid = (t: unknown): t is TemplateId => typeof t === "string" && Object.hasOwn(PRESETS, t);

export type Segment = { line: Line; tpl: TemplateId };

/**
 * Splits the clip into runs drawn with one template each. A per-line override (Line.id) wins.
 * With a mix (2+ templates) the template changes every line, or with mixBy "words" every
 * mixMin..mixMax words (random, seeded), never repeating the previous one. Each run is a Line
 * holding just its words, so groups never straddle a change.
 */
export function segments(lines: Line[], style: Style, overrides: Record<string, TemplateId> = {}): Segment[] {
  const mix = (style.mix ?? []).filter(valid);
  const seed = (style.mixSeed ?? 0) * 101;
  let prev: TemplateId | null = null;
  let n = 0;
  const draw = () => {
    let i = Math.floor(rand(n++ * 13 + seed) * mix.length);
    if (mix[i] === prev) i = (i + 1) % mix.length;
    return (prev = mix[i]);
  };
  const out: Segment[] = [];
  const byWords = mix.length > 1 && style.mixBy === "words";
  const lo = Math.max(1, Math.round(style.mixMin ?? 4));
  const hi = Math.max(lo, Math.round(style.mixMax ?? 8));
  let left = 0; // words still to go in the current run
  let tpl: TemplateId = style.template;
  for (const l of lines) {
    if (valid(overrides[l.id])) {
      out.push({ line: l, tpl: (prev = overrides[l.id]) });
      left = 0; // the run after a pinned line starts fresh
      continue;
    }
    if (!byWords) {
      out.push({ line: l, tpl: mix.length > 1 ? draw() : style.template });
      continue;
    }
    let cur: Line["words"] = [];
    const flush = () => {
      if (cur.length) out.push({ line: { ...l, t: cur[0].t, end: cur[cur.length - 1].end, words: cur }, tpl });
      cur = [];
    };
    for (const w of l.words) {
      if (left === 0) {
        flush();
        left = lo + Math.floor(rand(n * 7 + seed + 3) * (hi - lo + 1));
        tpl = draw();
      }
      cur.push(w);
      left--;
    }
    flush();
  }
  return out;
}

/** The style a run is drawn with: its template, and with mixLooks that template's type too. */
export function styleFor(style: Style, tpl: TemplateId): Style {
  if (tpl === style.template) return style;
  return { ...style, ...(style.mixLooks ? looksOf(tpl) : {}), template: tpl };
}
