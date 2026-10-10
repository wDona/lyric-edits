import type React from "react";
import { spring } from "remotion";
import { edit, fitOf, isAlt, look, sizeOf, type TemplateProps } from "../look.ts";
import { activeGroup, clamp01, easeOut, FPS, framesSince, groupAt, H, has, rand, W, wordText, type Group } from "../timing.ts";

const MARGIN = 70;

const box = (p: TemplateProps["p"], style?: React.CSSProperties): React.CSSProperties => ({
  position: "absolute",
  left: MARGIN,
  right: MARGIN,
  top: p.style.posY * H,
  transform: "translateY(-50%)",
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  alignItems: "baseline",
  textAlign: "center",
  fontSize: sizeOf(p.style),
  ...style,
});

const exitOf = (g: Group, t: number, d = 0.15) => clamp01((g.end - t) / d);

/** Letter-by-letter wave: every letter springs up in turn, words keep bobbing on the beat. */
export function Bounce({ p, gs, t, beat }: TemplateProps) {
  const g = activeGroup(gs, t);
  if (!g) return null;
  return (
    <div style={box(p, { gap: "0 0.3em", opacity: exitOf(g, t) })}>
      {g.words.map((w, wi) => {
        const e = edit(p, w);
        const f0 = framesSince(t, w.t, p.rate);
        if (f0 < 0) return null;
        const text = wordText(w, p.edits, p.style);
        return (
          <span key={w.id} style={{ ...look(p.style, e), fontSize: fitOf(p.style, e, text), whiteSpace: "nowrap", display: "inline-block", transform: `translateY(${-beat * 14 * ((wi % 2) * 2 - 1)}px)` }}>
            {[...text].map((ch, ci) => {
              const s = spring({ frame: f0 - ci * 1.2, fps: FPS, config: { damping: 9, stiffness: 260, mass: 0.5 } });
              return (
                <span key={ci} style={{ display: "inline-block", whiteSpace: "pre", opacity: s > 0.01 ? 1 : 0, transform: `translateY(${(1 - s) * 80}px) rotate(${(1 - s) * -25}deg) scale(${0.4 + 0.6 * s})` }}>
                  {ch}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}

/** Messy collage: the whole line piles up, each word with its own size, font, tilt and offset. */
export function Scatter({ p, gs, t }: TemplateProps) {
  const g = activeGroup(gs, t);
  if (!g) return null;
  return (
    <div style={box(p, { gap: "0.05em 0.25em", alignItems: "center", opacity: exitOf(g, t, 0.1) })}>
      {g.words.map((w) => {
        const e = edit(p, w);
        const f = framesSince(t, w.t, p.rate);
        if (f < 0) return null;
        const r = (k: number) => rand(Number(w.id.replace(":", "")) * 7 + k);
        const alt = isAlt(e) || r(1) > 0.6;
        const s = spring({ frame: f, fps: FPS, config: { damping: 12, stiffness: 300, mass: 0.5 } });
        const rot = (r(2) - 0.5) * 24;
        const raw = wordText(w, p.edits, p.style);
        const text = alt ? raw.toLowerCase() : raw.toUpperCase();
        return (
          <span
            key={w.id}
            style={{
              ...look(alt ? { ...p.style, font: p.style.altFont } : p.style, e, r(4) > 0.7 ? p.style.accent : undefined),
              fontSize: fitOf(alt ? { ...p.style, font: p.style.altFont } : p.style, e, text, 0.65 + r(3) * 0.9),
              whiteSpace: "nowrap",
              display: "inline-block",
              transform: `translateY(${(r(5) - 0.5) * 70}px) rotate(${rot * s + (1 - s) * rot * 3}deg) scale(${0.2 + 0.8 * s})`,
            }}
          >
            {text}
          </span>
        );
      })}
    </div>
  );
}

/** Words fly in from the distance and past the camera on their way out. */
export function Zoom({ p, gs, t }: TemplateProps) {
  const i = groupAt(gs, t);
  const shown = [gs[i - 1], gs[i]].filter((g): g is Group => !!g && t < g.end + 0.25);
  return (
    <>
      {shown.map((g) => {
        const inF = framesSince(t, g.t, p.rate);
        const k = easeOut(inF / 7);
        const out = clamp01((t - g.end) / 0.25);
        const hold = clamp01((t - g.t) / Math.max(0.3, g.end - g.t));
        const scale = (0.15 + 0.85 * k) * (1 + 0.15 * hold) * (1 + out * out * 5);
        return (
          <div
            key={g.index}
            style={box(p, {
              gap: "0 0.25em",
              transform: `translateY(-50%) scale(${scale}) rotate(${(rand(g.index) - 0.5) * 10 * (1 - k)}deg)`,
              opacity: k * (1 - out),
              filter: k < 1 || out > 0 ? `blur(${(1 - k) * 12 + out * 18}px)` : undefined,
            })}
          >
            {g.words.map((w) => {
              const e = edit(p, w);
              return (
                <span key={w.id} style={{ ...look(p.style, e), fontSize: fitOf(p.style, e, wordText(w, p.edits, p.style), 1, 0, 860 / 1.15), whiteSpace: "nowrap" }}>
                  {wordText(w, p.edits, p.style)}
                </span>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

/** Neon sign: the whole line is there as unlit tubes; each word flickers on when sung. */
export function Neon({ p, gs, t, beat }: TemplateProps) {
  const g = activeGroup(gs, t);
  if (!g) return null;
  const tube = p.style.accent;
  const swing = Math.sin((t / p.rate) * 3 + g.index) * 3 + (rand(g.index * 9) - 0.5) * 12;
  const y = (rand(g.index * 9 + 1) - 0.5) * 500;
  return (
    <div style={box(p, { gap: "0 0.3em", opacity: exitOf(g, t, 0.2), transform: `translateY(calc(-50% + ${y}px)) rotate(${swing}deg) scale(${1 + beat * 0.06})` })}>
      {g.words.map((w, j) => {
        const e = edit(p, w);
        const f = framesSince(t, w.t, p.rate);
        // flicker for ~8 frames, then on (and a little brighter on the beat)
        const lit = f < 0 ? 0 : f > 8 ? 1 : rand(Math.floor(f) * 31 + j) > 0.45 ? 1 : 0.15;
        const c = has(e, "accent") ? p.style.color : tube;
        const glow = lit * (1 + beat * 0.5);
        return (
          <span
            key={w.id}
            style={{
              ...look(p.style, e, lit ? "#fff" : "transparent"),
              fontSize: fitOf(p.style, e, wordText(w, p.edits, p.style)),
              whiteSpace: "nowrap",
              WebkitTextStroke: `${lit ? 2 : 3}px ${lit ? c : "rgba(255,255,255,.18)"}`,
              textShadow: lit ? `0 0 ${8 * glow}px ${c}, 0 0 ${24 * glow}px ${c}, 0 0 ${60 * glow}px ${c}` : "none",
            }}
          >
            {wordText(w, p.edits, p.style)}
          </span>
        );
      })}
    </div>
  );
}

/** Echo: the word filled in the middle, outlined copies stacked above and below that spread on the beat. */
export function Echo({ p, gs, t, beat }: TemplateProps) {
  const g = activeGroup(gs, t);
  if (!g) return null;
  const e = edit(p, g.words[0]);
  const text = g.words.map((w) => wordText(w, p.edits, p.style)).join(" ");
  const size = fitOf(p.style, e, text, 1.3);
  const k = easeOut(framesSince(t, g.t, p.rate) / 6);
  const gap = size * (0.8 + 0.12 * beat) * k;
  const base = look(p.style, e);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: p.style.posY * H, opacity: exitOf(g, t, 0.1) }}>
      {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((n) => (
        <div
          key={n}
          style={{
            ...base,
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: size,
            lineHeight: 1,
            transform: `translateY(calc(-50% + ${n * gap}px)) scale(${1 - Math.abs(n) * 0.04})`,
            opacity: n === 0 ? 1 : (1 - Math.abs(n) / 5) * k,
            color: n === 0 ? base.color : "transparent",
            WebkitTextStroke: n === 0 ? base.WebkitTextStroke : `2px ${n % 2 ? p.style.accent : p.style.color}`,
            textShadow: n === 0 ? base.textShadow : "none",
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </div>
      ))}
    </div>
  );
}

/** Slot reel: every word of the run in a column that rolls to the one being sung. */
export function Reel({ p, gs, t }: TemplateProps) {
  const words = gs.flatMap((g) => g.words);
  if (!words.length) return null;
  let j = 0;
  while (words[j + 1] && words[j + 1].t <= t) j++;
  const roll = j + (t >= words[j].t ? easeOut(framesSince(t, words[j].t, p.rate) / 5) : 0) - 1;
  const row = sizeOf(p.style) * 1.1;
  return (
    <div style={{ position: "absolute", left: MARGIN, right: MARGIN, top: p.style.posY * H }}>
      {words.map((w, n) => {
        const d = n - roll - 1;
        if (Math.abs(d) > 4) return null;
        const e = edit(p, w);
        const on = Math.abs(d) < 0.5;
        return (
          <div
            key={w.id}
            style={{
              ...look(p.style, e, on ? undefined : "rgba(255,255,255,.5)"),
              position: "absolute",
              left: 0,
              right: 0,
              textAlign: "center",
              fontSize: fitOf(p.style, e, wordText(w, p.edits, p.style), 0.85, 0, 860 / 1.25),
              lineHeight: 1,
              whiteSpace: "nowrap",
              transform: `translateY(calc(-50% + ${d * row}px)) scale(${1.25 - Math.min(1, Math.abs(d)) * 0.55}) rotateX(${d * -18}deg)`,
              opacity: 1 - Math.abs(d) / 4.5,
              filter: Math.abs(d) > 0.5 ? `blur(${Math.abs(d) * 1.5}px)` : undefined,
            }}
          >
            {wordText(w, p.edits, p.style)}
          </div>
        );
      })}
    </div>
  );
}
