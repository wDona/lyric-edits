import type { PlayerRef } from "@remotion/player";
import { useEffect, useRef, useState, type RefObject } from "react";
import { has, songTime } from "../remotion/timing.ts";
import { segments } from "../remotion/mix.ts";
import { PRESETS } from "../remotion/presets.ts";
import type { Emph, TemplateId, WordEdit } from "../remotion/types.ts";
import type { Project, Song } from "./api.ts";
import { fmt, seek, useFrame } from "./Timeline.tsx";

type Set = (fn: (p: Project) => Project, tag?: string) => void;

const MARKS: { k: Emph; key: string; label: string; title: string }[] = [
  { k: "accent", key: "a", label: "Color", title: "Color de acento (A)" },
  { k: "big", key: "b", label: "Grande", title: "Más grande (B)" },
  { k: "alt", key: "f", label: "Fuente 2", title: "Segunda fuente (F)" },
  { k: "hide", key: "h", label: "Ocultar", title: "No sale en el vídeo (H)" },
];

export function Lyrics({ project, song, set, player }: { project: Project; song: Song; set: Set; player: RefObject<PlayerRef | null> }) {
  const [sel, setSel] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const frame = useFrame(player);
  const now = songTime(frame, project.start, project.rate);
  const lines = song.lines.filter((l) => l.end > project.start && l.t < project.end);
  const order = lines.flatMap((l) => l.words.map((w) => w.id));
  // what each line gets without an override: its runs' templates in order
  const auto = new Map<string, string>();
  for (const s of segments(lines, project.style)) {
    const prev = auto.get(s.line.id);
    const label = PRESETS[s.tpl]?.label ?? s.tpl;
    auto.set(s.line.id, prev ? `${prev} → ${label}` : label);
  }
  const word = (id: string) => song.lines.flatMap((l) => l.words).find((w) => w.id === id);

  const editWords = (ids: string[], fn: (e: WordEdit) => WordEdit) =>
    set((p) => {
      const edits = { ...p.edits };
      for (const id of ids) {
        const e = fn(edits[id] ?? {});
        if (!e.emph?.length && e.text == null && !e.br) delete edits[id];
        else edits[id] = e;
      }
      return { ...p, edits };
    });

  const toggle = (k: Emph) => {
    const on = sel.every((id) => has(project.edits[id], k));
    editWords(sel, (e) => ({ ...e, emph: on ? e.emph?.filter((x) => x !== k) : [...(e.emph ?? []).filter((x) => x !== k), k] }));
  };
  const toggleBreak = () => {
    const on = sel.every((id) => project.edits[id]?.br);
    editWords(sel, (e) => ({ ...e, br: !on || undefined }));
  };
  const clear = () => editWords(sel, () => ({}));

  const click = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey && anchor) {
      const [a, b] = [order.indexOf(anchor), order.indexOf(id)].sort((x, y) => x - y);
      setSel(order.slice(a, b + 1));
    } else if (e.ctrlKey || e.metaKey) {
      setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
      setAnchor(id);
    } else {
      setSel([id]);
      setAnchor(id);
      const w = word(id);
      if (w) seek(player, project, w.t);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select") || !sel.length || e.ctrlKey || e.metaKey || e.altKey) return;
      const m = MARKS.find((m) => m.key === e.key.toLowerCase());
      if (m) toggle(m.k);
      else if (e.key === "/") toggleBreak();
      else if (e.key === "Enter") setEditing(sel[0]);
      else if (e.key === "Escape") setSel([]);
      else if (e.key === "Backspace" || e.key === "Delete") clear();
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  // keep the sung line in view while playing
  const activeLine = lines.findIndex((l) => now >= l.t && now < l.end);
  useEffect(() => {
    box.current?.querySelector(`[data-line="${activeLine}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeLine]);

  return (
    <div className="lyrics">
      <h3>Letra del clip</h3>
      <div className="toolbar">
        {MARKS.map((m) => (
          <button key={m.k} disabled={!sel.length} className={sel.length && sel.every((id) => has(project.edits[id], m.k)) ? "on" : ""} onClick={() => toggle(m.k)} title={m.title}>
            {m.label}
          </button>
        ))}
        <button disabled={!sel.length} className={sel.length && sel.every((id) => project.edits[id]?.br) ? "on" : ""} onClick={toggleBreak} title="Empieza un grupo nuevo en esta palabra (/)">
          Corte
        </button>
        <button disabled={sel.length !== 1} onClick={() => setEditing(sel[0])} title="Cambiar el texto (Enter)">
          Texto
        </button>
        <button disabled={!sel.length} onClick={clear} title="Quitar todo (Supr)">
          Limpiar
        </button>
      </div>
      <p className="muted small">Clic: elegir y saltar ahí · ⇧ clic: tramo · Ctrl clic: sueltas</p>
      <div className="lines" ref={box}>
        {lines.map((l, i) => (
          <div key={l.words[0]?.id ?? i} data-line={i} className={`line ${i === activeLine ? "active" : ""}`}>
            <div className="t">
              <span className="mono">{fmt(l.t)}</span>
              <select
                className="line-tpl"
                value={project.lineTpl?.[l.id] ?? ""}
                title="Plantilla de este verso"
                onChange={(e) =>
                  set((p) => {
                    const lineTpl = { ...p.lineTpl };
                    if (e.target.value) lineTpl[l.id] = e.target.value as TemplateId;
                    else delete lineTpl[l.id];
                    return { ...p, lineTpl };
                  })
                }
              >
                <option value="">{auto.get(l.id)}</option>
                {(Object.keys(PRESETS) as TemplateId[]).map((id) => (
                  <option key={id} value={id}>
                    📌 {PRESETS[id].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              {l.words.map((w) => {
                const e = project.edits[w.id];
                const cls = ["word", sel.includes(w.id) && "sel", now >= w.t && now < w.end && "now", ...(e?.emph ?? []), e?.br && "br", e?.text != null && "edited"]
                  .filter(Boolean)
                  .join(" ");
                if (editing === w.id)
                  return (
                    <input
                      key={w.id}
                      className="word-input"
                      autoFocus
                      defaultValue={e?.text ?? w.w}
                      onBlur={(ev) => {
                        const v = ev.target.value.trim();
                        editWords([w.id], (x) => ({ ...x, text: v && v !== w.w ? v : undefined }));
                        setEditing(null);
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
                        if (ev.key === "Escape") setEditing(null);
                      }}
                      style={{ width: `${Math.max(3, (e?.text ?? w.w).length + 1)}ch` }}
                    />
                  );
                return (
                  <span key={w.id} className={cls} onClick={(ev) => click(w.id, ev)} onDoubleClick={() => setEditing(w.id)}>
                    {e?.text ?? w.w}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        {!lines.length && <p className="muted">No hay letra en este tramo.</p>}
      </div>
    </div>
  );
}
