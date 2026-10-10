import type { CSSProperties } from "react";
import { fontCss, measure } from "./fonts.ts";
import { has, type Group } from "./timing.ts";
import type { EditProps, Style, Word, WordEdit } from "./types.ts";

export type TemplateProps = { p: EditProps; gs: Group[]; t: number; beat: number };

export const BASE_PX = 120;

export const isAlt = (e?: WordEdit) => has(e, "alt");

/** Font, color and glow of one word with its emphasis applied; `color` overrides both text and accent color. */
export function look(style: Style, e?: WordEdit, color?: string): CSSProperties {
  const c = color ?? (has(e, "accent") ? style.accent : style.color);
  const shadows: string[] = [];
  if (style.glow > 0) shadows.push(`0 0 ${style.glow * 18}px ${c}`, `0 0 ${style.glow * 48}px ${c}`);
  if (style.shadow > 0) shadows.push(`0 ${6 * style.shadow}px ${28 * style.shadow}px rgba(0,0,0,${0.35 + 0.4 * style.shadow})`);
  return {
    ...fontCss(isAlt(e) ? style.altFont : style.font),
    color: c,
    textShadow: shadows.join(", ") || undefined,
    WebkitTextStroke: style.stroke > 0 ? `${style.stroke * 10}px #000` : undefined,
    paintOrder: "stroke fill",
    lineHeight: 1.05,
  };
}

export const sizeOf = (style: Style, e?: WordEdit) => BASE_PX * style.size * (has(e, "big") ? 1.45 : 1);

/** Width a word may take. Leaves room for what stays on screen: beat zoom, camera and bob scale the text up to ~1.15×. */
export const SAFE_W = 860;

/**
 * sizeOf, shrunk so the word fits SAFE_W: a word wider than the screen can't wrap and gets cut in half.
 * k scales the size, pad is extra width in em (box padding), budget is the width allowed
 * (less when the template itself keeps the word scaled up).
 */
export const fitOf = (style: Style, e: WordEdit | undefined, text: string, k = 1, pad = 0, budget = SAFE_W) =>
  Math.min(sizeOf(style, e) * k, budget / (measure(text, isAlt(e) ? style.altFont : style.font) / 100 + pad));

export const edit = (p: EditProps, w: Word) => p.edits[w.id];
