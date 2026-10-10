import { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, useCurrentFrame } from "remotion";
import { fontsLoaded } from "./fonts.ts";
import { Background } from "./Background.tsx";
import { TEMPLATES } from "./templates/index.tsx";
import { segments, styleFor } from "./mix.ts";
import { clamp01, envAt, FPS, framesSince, groupAt, groups, H, lastBeat, pulse, rand, songTime, W } from "./timing.ts";
import type { EditProps } from "./types.ts";

/** Text is sized by measuring it: hold the frame until the fonts are in, then draw again with real widths. */
function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const handle = delayRender("fonts");
    fontsLoaded().then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, []);
  return ready;
}

export function Edit(p: EditProps) {
  const fontsReady = useFontsReady();
  const frame = useCurrentFrame();
  const t = songTime(frame, p.start, p.rate);
  // only what is sung inside the clip: no tail of the line before it on the first frame
  const clip = useMemo(() => {
    const lines = p.lines.filter((l) => l.end > p.start && l.t < p.end);
    const segs = segments(lines, p.style, p.lineTpl);
    const runs = segs.map((s) => s.line);
    const tplOfRun = new Map(segs.map((s) => [s.line, s.tpl]));
    const gs = groups(runs, p.edits, (l) => styleFor(p.style, tplOfRun.get(l)!).chunk);
    return { lines: runs, gs, tplOf: gs.map((g) => segs[g.line].tpl) };
  }, [p.lines, p.edits, p.style, p.start, p.end, p.lineTpl]);
  const { fx } = p.style;
  const beat = pulse(p.beats, t);
  const energy = envAt(p.env, t);
  const b = lastBeat(p.beats, t);
  const hit = b.index >= 0 ? envAt(p.env, p.beats[b.index]) : 0; // how loud the last beat was

  const zoom = 1 + fx.zoom * (0.07 * beat + 0.04 * energy);
  const shake = fx.shake * beat * hit * 34;
  const dx = (rand(b.index * 2) - 0.5) * 2 * shake;
  const dy = (rand(b.index * 2 + 1) - 0.5) * 2 * shake;
  const rot = (rand(b.index * 3) - 0.5) * fx.shake * beat * hit * 4;
  const rgb = fx.rgb * (4 + 22 * beat * hit);

  // the group on screen picks the template; it only sees its run of same-template groups
  const { gs, tplOf, lines } = clip;
  const i = Math.max(0, groupAt(gs, t));
  const tpl = tplOf[i] ?? p.style.template;
  let a = i;
  let z = i;
  while (a > 0 && tplOf[a - 1] === tpl) a--;
  while (z < gs.length - 1 && tplOf[z + 1] === tpl) z++;
  const run = gs.slice(a, z + 1);
  const Template = TEMPLATES[tpl] ?? TEMPLATES.pop;
  const lp = { ...p, style: styleFor(p.style, tpl) };

  // camera: every line gets its own move, and a zoom punch + blur when it starts
  const line = gs[i] ? lines[gs[i].line] : null;
  const k = gs[i]?.line ?? 0;
  const motion = fx.motion ?? 0;
  const prog = line ? clamp01((t - line.t) / Math.max(0.5, line.end - line.t)) : 0;
  const dir = rand(k * 5 + 2) > 0.5 ? 1 : -1;
  const move = Math.floor(rand(k * 5 + 1 + (p.style.mixSeed ?? 0)) * 5);
  const cam = {
    s: [1 + 0.14 * prog, 1.14 - 0.14 * prog, 1.06, 1.08, 1.04 + 0.1 * prog][move] * motion + (1 - motion),
    r: [0, 0, (prog - 0.5) * 7 * dir, 0, 4 * dir][move] * motion,
    x: [0, 0, 0, (prog - 0.5) * 140 * dir, 0][move] * motion,
  };
  const c = line && t >= line.t ? (fx.cut ?? 0) * (1 - clamp01(framesSince(t, line.t, p.rate) / 7)) : 0;
  const bob = (fx.bounce ?? 0) * beat;

  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateX(${cam.x}px) rotate(${cam.r}deg)` }}>
        <AbsoluteFill style={{ transform: `translate(${dx + c * 140 * dir}px, ${dy}px) rotate(${rot}deg) scale(${(zoom + c * 0.12) * cam.s})` }}>
          <Background p={p} t={t} />
        </AbsoluteFill>
        <AbsoluteFill
          style={{
            transform: `translate(${dx * 0.6}px, ${dy * 0.6 - bob * 18}px) scale(${(1 + (zoom - 1) * 0.5) * (1 + (cam.s - 1) * 0.35) * (1 + c * 0.35 + bob * 0.04)})`,
            // RGB split as two colored shadows: SVG channel filters on a full frame stall Firefox
            filter:
              [rgb > 0.5 && `drop-shadow(${-rgb}px 0 0 rgba(255,0,60,.85)) drop-shadow(${rgb}px 0 0 rgba(0,220,255,.85))`, c > 0.02 && `blur(${c * 10}px)`]
                .filter(Boolean)
                .join(" ") || undefined,
          }}
        >
          {fontsReady && <Template p={lp} gs={run} t={t} beat={beat} />}
        </AbsoluteFill>
      </AbsoluteFill>
      {c > 0.02 && <AbsoluteFill style={{ background: "#fff", opacity: c * c * 0.3 }} />}
      <Overlays p={p} frame={frame} beat={beat} hit={hit} rgb={rgb} t={t} />
      {p.audio && (
        <Audio
          src={p.audio}
          trimBefore={Math.round(p.start * FPS)}
          playbackRate={p.rate}
          preservePitch={!p.style.pitch}
          toneFrequency={p.style.pitch && p.rate !== 1 ? p.rate : undefined}
        />
      )}
    </AbsoluteFill>
  );
}

let noiseUrl = "";
/**
 * One 256 px tile of grey noise, made once and shifted every frame. A per-frame feTurbulence over
 * 1080×1920 looks the same but Firefox computes it on the CPU and the editor freezes.
 */
function noise() {
  if (noiseUrl) return noiseUrl;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand(i / 4 + 0.123) * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return (noiseUrl = c.toDataURL());
}

function Overlays({ p, frame, beat, hit, rgb, t }: { p: EditProps; frame: number; beat: number; hit: number; rgb: number; t: number }) {
  const { fx } = p.style;
  const a = (t / p.rate) * 0.4;
  return (
    <>
      {fx.leaks > 0 && (
        <AbsoluteFill
          style={{
            mixBlendMode: "screen",
            opacity: fx.leaks * (0.55 + 0.25 * Math.sin(a * 1.7)),
            background: [
              `radial-gradient(40% 30% at ${10 + 20 * Math.sin(a)}% ${20 + 10 * Math.cos(a)}%, rgba(255,140,60,.8), transparent 70%)`,
              `radial-gradient(35% 28% at ${90 - 15 * Math.cos(a * 0.7)}% ${80 - 12 * Math.sin(a)}%, rgba(255,60,140,.7), transparent 70%)`,
            ].join(", "),
          }}
        />
      )}
      {fx.vignette > 0 && (
        <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${fx.vignette}) 100%)` }} />
      )}
      {fx.grain > 0 && (
        <AbsoluteFill
          style={{
            backgroundImage: `url(${noise()})`,
            backgroundPosition: `${Math.floor(rand(frame) * 256)}px ${Math.floor(rand(frame + 0.5) * 256)}px`,
            opacity: fx.grain * 0.5,
            mixBlendMode: "overlay",
          }}
        />
      )}
      {fx.flash > 0 && <AbsoluteFill style={{ background: "#fff", opacity: fx.flash * 0.7 * Math.pow(beat, 3) * hit * hit }} />}
      {fx.letterbox && (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: H * 0.1, background: "#000" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: H * 0.1, background: "#000" }} />
        </>
      )}
    </>
  );
}
