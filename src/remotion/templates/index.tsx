import type React from "react";
import { spring } from "remotion";
import { measure } from "../fonts.ts";
import { edit, fitOf, isAlt, look, sizeOf, type TemplateProps } from "../look.ts";
import { activeGroup, clamp01, has, easeOut, FPS, framesSince, groupAt, H, rand, W, wordText, type Group } from "../timing.ts";
import type { TemplateId } from "../types.ts";
import { Bounce, Echo, Neon, Reel, Scatter, Zoom } from "./more.tsx";

const MARGIN = 70;

/** Block centered horizontally at the style's vertical position. */
function Center({ p, children, style }: { p: TemplateProps["p"]; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
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
        fontSize: sizeOf(p.style), // gaps below are in em
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** 1 → 0 over the last `d` seconds of a group. */
const exitOf = (g: Group, t: number, d = 0.15) => clamp01((g.end - t) / d);

/** CapCut auto-captions: each word springs in, the one being sung sits on a colored box. */
function Pop({ p, gs, t }: TemplateProps) {
  const g = activeGroup(gs, t);
  if (!g) return null;
  const out = exitOf(g, t);
  const entry = Math.floor(rand(g.index * 3 + 1) * 4); // spring up, drop in, spin, slide sideways
  return (
    <Center p={p} style={{ gap: "0.1em 0.28em", opacity: out, transform: `translateY(-50%) scale(${0.9 + 0.1 * out})` }}>
      {g.words.map((w) => {
        const e = edit(p, w);
        const f = framesSince(t, w.t, p.rate);
        const s = f < 0 ? 0 : spring({ frame: f, fps: FPS, config: { damping: 11, stiffness: 240, mass: 0.6 } });
        const on = t >= w.t && t < w.end;
        if (f < 0) return null; // not reserved: the group stays centered as it grows
        return (
          <span
            key={w.id}
            style={{
              ...look(p.style, e, on && p.style.box ? "#000" : undefined),
              fontSize: fitOf(p.style, e, wordText(w, p.edits, p.style), 1, 0.3),
              whiteSpace: "nowrap",
              display: "inline-block",
              transform: [
                `translateY(${(1 - s) * 50}px) scale(${0.35 + 0.65 * s})`,
                `translateY(${(1 - s) * -160}px) scale(${1.6 - 0.6 * s})`,
                `rotate(${(1 - s) * -90}deg) scale(${s})`,
                `translateX(${(1 - s) * (g.index % 2 ? 300 : -300)}px)`,
              ][entry],
              padding: "0 0.12em",
              borderRadius: "0.14em",
              background: on && p.style.box ? p.style.accent : "transparent",
              textShadow: on && p.style.box ? "none" : look(p.style, e).textShadow,
            }}
          >
            {wordText(w, p.edits, p.style)}
          </span>
        );
      })}
    </Center>
  );
}

/** Kinetic stack: one word per row, each stretched to the full width, rows wipe in as they're sung. */
function Stack({ p, gs, t, beat }: TemplateProps) {
  const g = activeGroup(gs, t);
  if (!g) return null;
  const width = W - MARGIN * 2;
  const rows = g.words.map((w, i) => {
    const e = edit(p, w);
    const alt = isAlt(e) || i % 3 === 1;
    const text = wordText(w, p.edits, p.style);
    const font = alt ? p.style.altFont : p.style.font;
    const size = Math.min((100 * width * 0.9) / measure(text, font), sizeOf(p.style, e) * 2.6); // 0.9: the block tilts and pulses
    return { w, e, alt, text, size };
  });
  const height = rows.reduce((a, r) => a + r.size * 0.92, 0);
  const fit = Math.min(1, (H * 0.62) / height);
  const out = exitOf(g, t, 0.12);
  const tilt = (rand(g.index) - 0.5) * 8;
  return (
    <div
      style={{
        position: "absolute",
        left: MARGIN,
        width,
        top: p.style.posY * H,
        transform: `translateY(-50%) rotate(${tilt}deg) scale(${fit * (1 + beat * p.style.fx.zoom * 0.03)})`,
        opacity: out,
      }}
    >
      {rows.map(({ w, e, alt, text, size }, i) => {
        const f = framesSince(t, w.t, p.rate);
        const s = f < 0 ? 0 : spring({ frame: f, fps: FPS, config: { damping: 16, stiffness: 260 } });
        const from = i % 2 ? 1 : -1;
        const on = t >= w.t && t < w.end;
        return (
          <div key={w.id} style={{ overflow: "hidden", height: size * 0.92, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span
              style={{
                ...look(alt ? { ...p.style, font: p.style.altFont } : p.style, e, on ? p.style.accent : undefined),
                fontSize: size,
                lineHeight: 0.9,
                whiteSpace: "nowrap",
                transform: `translateX(${from * (1 - s) * 105}%)`,
              }}
            >
              {text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Sad/fanfic edits: soft serif fading in out of a blur, previous line drifting up and away. */
function Dreamy({ p, gs, t }: TemplateProps) {
  const i = groupAt(gs, t);
  const shown = [gs[i - 1], gs[i]].filter((g): g is Group => !!g && t < g.end + 0.6);
  return (
    <>
      {shown.map((g) => {
        const gone = clamp01((t - g.end) / 0.6);
        return (
          <Center
            key={g.index}
            p={p}
            style={{
              gap: "0 0.25em",
              opacity: 1 - gone,
              filter: gone ? `blur(${gone * 12}px)` : undefined,
              transform: `translate(${(rand(g.index * 4) - 0.5) * 160}px, calc(-50% + ${(g.index % 2 ? -1 : 1) * (110 + rand(g.index * 4 + 1) * 160) - gone * 90}px)) rotate(${(rand(g.index * 4 + 2) - 0.5) * 8}deg) scale(${1 + clamp01((t - g.t) / 3) * 0.12})`,
            }}
          >
            {g.words.map((w) => {
              const e = edit(p, w);
              const k = easeOut((t - w.t + 0.08) / 0.5);
              return (
                <span
                  key={w.id}
                  style={{
                    ...look(p.style, e),
                    fontSize: fitOf(p.style, e, wordText(w, p.edits, p.style)),
                    whiteSpace: "nowrap",
                    display: "inline-block",
                    opacity: k,
                    filter: k < 1 ? `blur(${(1 - k) * 16}px)` : undefined,
                    transform: `translateY(${(1 - k) * 22}px)`,
                  }}
                >
                  {wordText(w, p.edits, p.style)}
                </span>
              );
            })}
          </Center>
        );
      })}
    </>
  );
}

/** Phonk/hype edits: words slam in huge, every group lands at its own angle; emphasized words inverted. */
function Glitch({ p, gs, t }: TemplateProps) {
  const g = activeGroup(gs, t);
  if (!g) return null;
  const tilt = (rand(g.index + 1) - 0.5) * 12;
  const dy = (rand(g.index + 7) - 0.5) * 260;
  return (
    <Center p={p} style={{ gap: "0 0.2em", transform: `translateY(calc(-50% + ${dy}px)) rotate(${tilt}deg)`, opacity: exitOf(g, t, 0.08) }}>
      {g.words.map((w) => {
        const e = edit(p, w);
        const f = framesSince(t, w.t, p.rate);
        const k = clamp01(f / 4);
        const inv = e?.emph?.includes("accent");
        if (f < 0) return null; // not reserved: the group stays centered as it grows
        return (
          <span
            key={w.id}
            style={{
              ...look(p.style, e, inv ? "#000" : undefined),
              fontSize: fitOf(p.style, e, wordText(w, p.edits, p.style), 1, 0.25),
              whiteSpace: "nowrap",
              lineHeight: 0.95,
              display: "inline-block",
              transform: `scale(${2.4 - 1.4 * k}) skewX(${(1 - k) * -12}deg)`,
              filter: k < 1 ? `blur(${(1 - k) * 10}px)` : undefined,
              background: inv ? p.style.accent : undefined,
              padding: inv ? "0 0.1em" : undefined,
              textShadow: inv ? "none" : look(p.style, e).textShadow,
            }}
          >
            {wordText(w, p.edits, p.style)}
          </span>
        );
      })}
    </Center>
  );
}

/** Typed in bursts on a strip that whips in: every group lands somewhere else, tilted, the strip flashing on the beat. */
function Typewriter({ p, gs, t, beat }: TemplateProps) {
  const g = activeGroup(gs, t);
  if (!g) return null;
  const k = easeOut(framesSince(t, g.t, p.rate) / 5);
  const out = exitOf(g, t, 0.1);
  const y = (g.index % 2 ? -1 : 1) * (60 + rand(g.index * 5 + 3) * 260);
  const tilt = (rand(g.index * 5 + 4) - 0.5) * 10;
  const fromLeft = g.index % 2 === 0;
  const blink = Math.floor((t / p.rate) * 3) % 2 === 0;
  const strip = beat > 0.6 ? p.style.accent : p.style.color;
  return (
    <div
      style={{
        position: "absolute",
        left: MARGIN,
        right: MARGIN,
        top: p.style.posY * H + y,
        transform: `translateY(-50%) rotate(${tilt}deg) translateX(${(1 - k) * (fromLeft ? -120 : 120)}%) scale(${0.9 + 0.1 * out})`,
        opacity: out,
        textAlign: "center",
        fontSize: Math.min(...g.words.map((w) => fitOf(p.style, edit(p, w), wordText(w, p.edits, p.style), 1, 1.2))),
      }}
    >
      <span
        style={{
          background: p.style.box ? strip : undefined,
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
          padding: p.style.box ? "0.06em 0.3em" : undefined,
          lineHeight: 1.5,
        }}
      >
        {g.words.map((w, j) => {
          const e = edit(p, w);
          const text = wordText(w, p.edits, p.style);
          const n = Math.round(clamp01(framesSince(t, w.t, p.rate) / Math.max(2, text.length * 0.8)) * text.length);
          if (t < w.t) return null;
          return (
            <span key={w.id} style={{ ...look(p.style, e, p.style.box && !has(e, "accent") ? "#000" : undefined), textShadow: p.style.box ? "none" : look(p.style, e).textShadow }}>
              {j ? " " : ""}
              {text.slice(0, n)}
            </span>
          );
        })}
        <span style={{ color: p.style.box ? "#000" : p.style.color, opacity: blink ? 1 : 0 }}>▌</span>
      </span>
    </div>
  );
}

export const TEMPLATES: Record<TemplateId, (props: TemplateProps) => React.ReactNode> = {
  pop: Pop,
  stack: Stack,
  dreamy: Dreamy,
  glitch: Glitch,
  typewriter: Typewriter,
  bounce: Bounce,
  scatter: Scatter,
  zoom: Zoom,
  neon: Neon,
  echo: Echo,
  reel: Reel,
};
