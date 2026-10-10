import type { PlayerRef } from "@remotion/player";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { FPS, songTime } from "../remotion/timing.ts";
import type { Project, Song } from "./api.ts";

type Set = (fn: (p: Project) => Project, tag?: string) => void;

/** Current player frame, live. */
export function useFrame(player: RefObject<PlayerRef | null>) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const on = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    p.addEventListener("frameupdate", on);
    p.addEventListener("seeked", on);
    return () => {
      p.removeEventListener("frameupdate", on);
      p.removeEventListener("seeked", on);
    };
  }, [player.current]);
  return frame;
}

export function seek(player: RefObject<PlayerRef | null>, p: Project, t: number) {
  const f = Math.round(((t - p.start) / p.rate) * FPS);
  player.current?.seekTo(Math.max(0, Math.min(f, Math.round(((p.end - p.start) / p.rate) * FPS) - 1)));
}

export const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

const WAVE = 74;
const ROW = 26;
const HEIGHT = WAVE + ROW + 8;

export function Timeline({ project, song, set, player }: { project: Project; song: Song; set: Set; player: RefObject<PlayerRef | null> }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(800);
  const drag = useRef<{ mode: "start" | "end" | "move" | "new"; t0: number; start: number; end: number; moved: boolean } | null>(null);
  const frame = useFrame(player);
  const now = songTime(frame, project.start, project.rate);
  const dur = song.duration;
  const t2x = (t: number) => (t / dur) * width;
  const x2t = (x: number) => Math.max(0, Math.min(dur, (x / width) * dur));

  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(box.current!);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current!;
    const dpr = devicePixelRatio;
    c.width = width * dpr;
    c.height = HEIGHT * dpr;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    const css = getComputedStyle(c);
    const accent = css.getPropertyValue("--accent").trim() || "#ff4d8d";
    // waveform
    const n = song.peaks.length;
    for (let x = 0; x < width; x++) {
      let m = 0;
      const a = Math.floor((x / width) * n);
      const e = Math.min(n, Math.max(a + 1, Math.floor(((x + 1) / width) * n)));
      for (let i = a; i < e; i++) m = Math.max(m, song.peaks[i]);
      const t = (x / width) * dur;
      g.fillStyle = t >= project.start && t <= project.end ? accent : "rgba(255,255,255,.22)";
      const h = Math.max(1, m * m * (WAVE - 6)); // squared: mastered songs are loud everywhere
      g.fillRect(x, (WAVE - h) / 2, 1, h);
    }
    // beats
    g.fillStyle = "rgba(255,255,255,.12)";
    for (const b of song.beats) g.fillRect(Math.round(t2x(b)), 0, 1, WAVE);
    // lines
    song.lines.forEach((l) => {
      const inside = l.t < project.end && l.end > project.start;
      g.fillStyle = inside ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.18)";
      g.beginPath();
      g.roundRect(t2x(l.t), WAVE + 6, Math.max(2, t2x(l.end) - t2x(l.t) - 1), ROW - 8, 3);
      g.fill();
    });
    // range
    g.fillStyle = "rgba(255,255,255,.06)";
    g.fillRect(t2x(project.start), 0, t2x(project.end) - t2x(project.start), HEIGHT);
    g.fillStyle = accent;
    g.fillRect(t2x(project.start) - 2, 0, 4, HEIGHT);
    g.fillRect(t2x(project.end) - 2, 0, 4, HEIGHT);
  }, [width, song, project.start, project.end]);

  const snap = (t: number, kind: "start" | "end", free: boolean) => {
    if (free) return t;
    let best = t;
    let dist = (8 / width) * dur;
    for (const l of song.lines) {
      const c = kind === "start" ? Math.max(0, l.t - 0.15) : l.end + 0.3;
      if (Math.abs(c - t) < dist) [best, dist] = [c, Math.abs(c - t)];
    }
    return best;
  };

  const xOf = (e: React.PointerEvent | React.MouseEvent) => e.clientX - canvas.current!.getBoundingClientRect().left;

  const down = (e: React.PointerEvent) => {
    const x = xOf(e);
    const t = x2t(x);
    const mode =
      Math.abs(x - t2x(project.start)) < 8 ? "start" : Math.abs(x - t2x(project.end)) < 8 ? "end" : t > project.start && t < project.end ? "move" : "new";
    drag.current = { mode, t0: t, start: project.start, end: project.end, moved: false };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) {
      const x = xOf(e);
      const edge = Math.abs(x - t2x(project.start)) < 8 || Math.abs(x - t2x(project.end)) < 8;
      const t = x2t(x);
      canvas.current!.style.cursor = edge ? "ew-resize" : t > project.start && t < project.end ? "grab" : "crosshair";
      return;
    }
    const t = x2t(xOf(e));
    if (!d.moved && Math.abs(t2x(t) - t2x(d.t0)) < 3) return;
    d.moved = true;
    let { start, end } = d;
    if (d.mode === "start") start = Math.min(snap(t, "start", e.shiftKey), end - 1);
    else if (d.mode === "end") end = Math.max(snap(t, "end", e.shiftKey), start + 1);
    else if (d.mode === "move") {
      const dt = Math.max(-start, Math.min(dur - end, t - d.t0));
      start += dt;
      end += dt;
    } else {
      start = snap(Math.min(d.t0, t), "start", e.shiftKey);
      end = Math.max(start + 1, snap(Math.max(d.t0, t), "end", e.shiftKey));
    }
    set((p) => ({ ...p, start, end }), "range");
  };
  const up = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const t = d.t0;
    if (t >= project.start && t <= project.end) return seek(player, project, t);
    // click outside: move the clip there, same length
    const len = project.end - project.start;
    const start = Math.min(snap(t, "start", e.shiftKey), dur - len);
    set((p) => ({ ...p, start, end: start + len }));
  };
  const dbl = (e: React.MouseEvent) => {
    const t = x2t(xOf(e));
    const l = song.lines.find((l) => t >= l.t && t <= l.end);
    if (!l) return;
    set((p) =>
      e.shiftKey ? { ...p, start: Math.min(p.start, l.t - 0.15), end: Math.max(p.end, l.end + 0.3) } : { ...p, start: Math.max(0, l.t - 0.15), end: l.end + 0.3 },
    );
  };

  return (
    <div className="timeline">
      <div className="tl-head">
        <span>
          Clip <b>{fmt(project.start)}</b> → <b>{fmt(project.end)}</b> · {((project.end - project.start) / project.rate).toFixed(1)} s de vídeo
        </span>
        <span className="muted">
          {song.beats.length ? `${song.bpm} bpm · ${song.beats.length} pulsos` : "sin pulsos"} · arrastra los bordes o el clip · doble clic en un verso lo
          selecciona (⇧ amplía) · ⇧ sin imán
        </span>
        <span className="mono">{fmt(now)}</span>
      </div>
      <div ref={box} className="tl-canvas" style={{ height: HEIGHT }}>
        <canvas ref={canvas} style={{ width, height: HEIGHT }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onDoubleClick={dbl} />
        <div className="playhead" style={{ left: t2x(now) }} />
      </div>
    </div>
  );
}
