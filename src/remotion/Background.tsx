import { AbsoluteFill, Img, OffthreadVideo, Sequence } from "remotion";
import { framesSince, lastBeat } from "./timing.ts";
import type { EditProps } from "./types.ts";

/** Song times where the background media cuts: every `cutEvery` beats, or every 2 s without beats. */
export function cuts(p: EditProps) {
  const every = Math.max(1, p.style.bg.cutEvery);
  const inRange = p.beats.filter((b) => b > p.start && b < p.end);
  if (inRange.length) return [p.start, ...inRange.filter((_, i) => (i + 1) % every === 0)];
  const out = [];
  for (let t = p.start; t < p.end; t += 0.5 * every) out.push(t);
  return out;
}

export function Background({ p, t }: { p: EditProps; t: number }) {
  const { bg } = p.style;
  const filter = [bg.bw && "grayscale(1) contrast(1.15)", bg.blur && `blur(${bg.blur}px)`].filter(Boolean).join(" ") || undefined;
  let layer;
  if (bg.kind === "media" && p.media.length) {
    const cs = cuts(p);
    const i = Math.max(0, lastBeat(cs, t).index);
    const from = cs[i];
    const to = cs[i + 1] ?? p.end;
    const m = p.media[i % p.media.length];
    const prog = (t - from) / Math.max(0.01, to - from);
    const startFrame = Math.round(framesSince(from, p.start, p.rate));
    const len = Math.max(1, Math.round(framesSince(to, from, p.rate)));
    const css = {
      width: "100%",
      height: "100%",
      objectFit: "cover" as const,
      transform: `scale(${1.04 + bg.kenBurns * 0.18 * prog}) rotate(${(i % 2 ? 1 : -1) * bg.kenBurns * prog}deg)`,
    };
    layer = (
      <Sequence key={i} from={startFrame} durationInFrames={len} layout="none">
        {m.type === "video" ? <OffthreadVideo src={m.url} muted style={css} /> : <Img src={m.url} style={css} />}
      </Sequence>
    );
  } else if (bg.kind === "solid") {
    layer = <AbsoluteFill style={{ background: bg.c1 }} />;
  } else {
    const a = (t / p.rate) * 0.25;
    layer = (
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(60% 45% at ${50 + 30 * Math.sin(a)}% ${30 + 15 * Math.cos(a * 1.3)}%, ${bg.c2}cc, transparent 70%)`,
            `radial-gradient(55% 40% at ${50 + 30 * Math.cos(a * 0.8)}% ${72 + 12 * Math.sin(a)}%, ${bg.c3}cc, transparent 70%)`,
            bg.c1,
          ].join(", "),
        }}
      />
    );
  }
  return (
    <AbsoluteFill style={{ filter, transform: bg.blur ? "scale(1.06)" : undefined }}>
      {layer}
      <AbsoluteFill style={{ background: `rgba(0,0,0,${bg.darken})` }} />
    </AbsoluteFill>
  );
}
