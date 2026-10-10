import { useState, type ReactNode } from "react";
import { fontCss, FONTS } from "../remotion/fonts.ts";
import { PRESETS, presetStyle } from "../remotion/presets.ts";
import type { Style, TemplateId } from "../remotion/types.ts";
import * as api from "./api.ts";
import type { Preset, Project, Song } from "./api.ts";

type Set = (fn: (p: Project) => Project, tag?: string) => void;

function Section({ title, children, open = true }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="section" open={open}>
      <summary>{title}</summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01, fmt }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; fmt?: (v: number) => string }) {
  return (
    <label className="slider" onDoubleClick={(e) => e.preventDefault()}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
      <output>{fmt ? fmt(value) : Math.round((value / max) * 100)}</output>
    </label>
  );
}

function Seg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg-row">
      <span>{label}</span>
      <div className="seg">
        {options.map(([v, l]) => (
          <button key={String(v)} className={v === value ? "on" : ""} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="color">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <span>{label}</span>
    </label>
  );
}

function FontPick({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={fontCss(value)}>
        {Object.entries(FONTS).map(([id, f]) => (
          <option key={id} value={id} style={fontCss(id)}>
            {f.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Panels({
  project,
  song,
  set,
  busy,
  onSeparate,
  presets,
  onPresets,
}: {
  project: Project;
  song: Song | null;
  set: Set;
  busy: boolean;
  onSeparate: () => void;
  presets: Preset[];
  onPresets: (all: Preset[]) => void;
}) {
  const s = project.style;
  const [uploading, setUploading] = useState(0);
  const [presetName, setPresetName] = useState("");
  const mix = s.mix ?? [];
  const st = (patch: Partial<Style>, tag: string) => set((p) => ({ ...p, style: { ...p.style, ...patch } }), tag);
  const bg = (patch: Partial<Style["bg"]>, tag: string) => set((p) => ({ ...p, style: { ...p.style, bg: { ...p.style.bg, ...patch } } }), tag);
  const fx = (patch: Partial<Style["fx"]>, tag: string) => set((p) => ({ ...p, style: { ...p.style, fx: { ...p.style.fx, ...patch } } }), tag);

  const upload = async (files: FileList | null) => {
    const list = [...(files ?? [])].filter((f) => /^(image|video)\//.test(f.type));
    setUploading((n) => n + list.length);
    for (const f of list) {
      const m = await api.uploadMedia(f).finally(() => setUploading((n) => n - 1));
      set((p) => ({ ...p, media: [...p.media, m], style: { ...p.style, bg: { ...p.style.bg, kind: "media" } } }));
    }
  };

  return (
    <div className="panels">
      <Section title="Plantilla">
        <div className="templates">
          {(Object.keys(PRESETS) as TemplateId[]).map((id) => {
            const pre = presetStyle(id);
            return (
              <button
                key={id}
                className={`tpl ${s.template === id ? "on" : ""}`}
                onClick={() => set((p) => ({ ...p, style: { ...presetStyle(id), bg: { ...presetStyle(id).bg, kind: p.style.bg.kind } } }))}
                title={PRESETS[id].hint}
                style={{ background: `linear-gradient(135deg, ${pre.bg.c1}, ${pre.bg.c2})` }}
              >
                <span style={{ ...fontCss(pre.font), color: pre.accent, textTransform: pre.case === "upper" ? "uppercase" : pre.case === "lower" ? "lowercase" : "none" }}>
                  {PRESETS[id].label}
                </span>
                <small>{PRESETS[id].hint}</small>
              </button>
            );
          })}
        </div>
        <p className="muted small">Cambiar de plantilla restablece el aspecto; la letra marcada y las imágenes se quedan.</p>
        <div className="seg-row">
          <span>Mezcla entre frases {mix.length > 1 ? `· ${mix.length} plantillas` : "· elige 2 o más"}</span>
          <div className="seg">
            {(Object.keys(PRESETS) as TemplateId[]).map((id) => (
              <button
                key={id}
                className={mix.includes(id) ? "on" : ""}
                onClick={() => st({ mix: mix.includes(id) ? mix.filter((x) => x !== id) : [...mix, id] }, "")}
              >
                {PRESETS[id].label}
              </button>
            ))}
          </div>
        </div>
        <Seg label="Cambiar de plantilla cada" value={s.mixBy ?? "line"} options={[["line", "Verso"], ["words", "X palabras"]]} onChange={(v) => st({ mixBy: v }, "")} />
        {s.mixBy === "words" && (
          <>
            <Slider label="Mínimo" value={s.mixMin ?? 4} min={1} max={20} step={1} onChange={(v) => st({ mixMin: v, mixMax: Math.max(v, s.mixMax ?? 8) }, "mixMin")} fmt={(v) => `${v} pal.`} />
            <Slider label="Máximo" value={s.mixMax ?? 8} min={1} max={20} step={1} onChange={(v) => st({ mixMax: v, mixMin: Math.min(v, s.mixMin ?? 4) }, "mixMax")} fmt={(v) => `${v} pal.`} />
          </>
        )}
        <div className="mix-actions">
          <label className="check">
            <input type="checkbox" checked={!!s.mixLooks} onChange={(e) => st({ mixLooks: e.target.checked }, "")} /> Cada frase con su tipografía
          </label>
          <button disabled={mix.length < 2} onClick={() => st({ mixSeed: (s.mixSeed ?? 0) + 1 }, "")} title="Reparte de nuevo las plantillas entre los versos">
            🔀 Barajar
          </button>
          <button className="ghost" disabled={!mix.length} onClick={() => st({ mix: [] }, "")}>
            Quitar
          </button>
        </div>
        <p className="muted small">Cada tramo (un verso, o entre mínimo y máximo palabras al azar) toma una plantilla de la mezcla, nunca la misma que el anterior. En «Letra del clip» puedes fijar la de un verso.</p>
      </Section>

      <Section title="Mis presets">
        {presets.map((pr) => (
          <div key={pr.id} className="preset">
            <button className="link" onClick={() => set((p) => ({ ...p, style: structuredClone(pr.style), rate: pr.rate }))} title="Aplicar este estilo">
              {pr.name}
            </button>
            <span className="muted small">{PRESETS[pr.style.template]?.label}</span>
            <button className="ghost" title="Actualizar con el estilo actual" onClick={() => onPresets(presets.map((x) => (x.id === pr.id ? { ...x, style: structuredClone(s), rate: project.rate } : x)))}>
              ⟳
            </button>
            <button className="ghost" title="Borrar" onClick={() => confirm(`¿Borrar el preset «${pr.name}»?`) && onPresets(presets.filter((x) => x.id !== pr.id))}>
              ✕
            </button>
          </div>
        ))}
        <form
          className="add"
          onSubmit={(e) => {
            e.preventDefault();
            const name = presetName.trim();
            if (!name) return;
            onPresets([...presets, { id: `${Date.now().toString(36)}`, name, style: structuredClone(s), rate: project.rate }]);
            setPresetName("");
          }}
        >
          <input placeholder="Nombre del preset" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
          <button disabled={!presetName.trim()}>Guardar estilo</button>
        </form>
        <p className="muted small">Guarda plantilla, fuentes, colores, efectos, fondo y velocidad. Sale también en la biblioteca para el edit en un clic.</p>
      </Section>

      <Section title="Texto">
        <FontPick label="Fuente" value={s.font} onChange={(v) => st({ font: v }, "font")} />
        <FontPick label="Fuente 2 (destacadas)" value={s.altFont} onChange={(v) => st({ altFont: v }, "alt")} />
        <Seg label="Mayúsculas" value={s.case} options={[["none", "Tal cual"], ["upper", "MAYÚS"], ["lower", "minús"]]} onChange={(v) => st({ case: v }, "case")} />
        <Slider label="Tamaño" value={s.size} min={0.4} max={2} onChange={(v) => st({ size: v }, "size")} fmt={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Palabras a la vez" value={s.chunk} min={0} max={6} step={1} onChange={(v) => st({ chunk: v }, "chunk")} fmt={(v) => (v ? `${v}` : "verso")} />
        <Slider label="Altura" value={s.posY} min={0.15} max={0.85} onChange={(v) => st({ posY: v }, "posY")} fmt={(v) => `${Math.round(v * 100)}%`} />
        <div className="colors">
          <Color label="Texto" value={s.color} onChange={(v) => st({ color: v }, "color")} />
          <Color label="Acento" value={s.accent} onChange={(v) => st({ accent: v }, "accent")} />
        </div>
        <Slider label="Brillo" value={s.glow} onChange={(v) => st({ glow: v }, "glow")} />
        <Slider label="Sombra" value={s.shadow} onChange={(v) => st({ shadow: v }, "shadow")} />
        <Slider label="Contorno" value={s.stroke} onChange={(v) => st({ stroke: v }, "stroke")} />
        <label className="check">
          <input type="checkbox" checked={s.box} onChange={(e) => st({ box: e.target.checked }, "box")} /> Caja detrás (palabra activa / franja)
        </label>
      </Section>

      <Section title="Ritmo y efectos">
        <Beats song={song} busy={busy} onSeparate={onSeparate} />
        <Slider label="Cámara" value={s.fx.motion ?? 0} onChange={(v) => fx({ motion: v }, "motion")} />
        <Slider label="Golpe al cambiar" value={s.fx.cut ?? 0} onChange={(v) => fx({ cut: v }, "cut")} />
        <Slider label="Rebote al beat" value={s.fx.bounce ?? 0} onChange={(v) => fx({ bounce: v }, "bounce")} />
        <Slider label="Zoom al beat" value={s.fx.zoom} onChange={(v) => fx({ zoom: v }, "zoom")} />
        <Slider label="Temblor" value={s.fx.shake} onChange={(v) => fx({ shake: v }, "shake")} />
        <Slider label="Flash" value={s.fx.flash} onChange={(v) => fx({ flash: v }, "flash")} />
        <Slider label="RGB" value={s.fx.rgb} onChange={(v) => fx({ rgb: v }, "rgb")} />
        <Slider label="Grano" value={s.fx.grain} onChange={(v) => fx({ grain: v }, "grain")} />
        <Slider label="Viñeta" value={s.fx.vignette} onChange={(v) => fx({ vignette: v }, "vignette")} />
        <Slider label="Luces" value={s.fx.leaks} onChange={(v) => fx({ leaks: v }, "leaks")} />
        <label className="check">
          <input type="checkbox" checked={s.fx.letterbox} onChange={(e) => fx({ letterbox: e.target.checked }, "letterbox")} /> Franjas de cine
        </label>
        <Seg
          label="Velocidad"
          value={project.rate}
          options={[[0.8, "slowed"], [0.9, "0.9×"], [1, "1×"], [1.15, "1.15×"], [1.3, "sped up"]]}
          onChange={(v) => set((p) => ({ ...p, rate: v }))}
        />
        <label className="check">
          <input type="checkbox" checked={s.pitch} onChange={(e) => st({ pitch: e.target.checked }, "pitch")} /> El tono cambia con la velocidad (nightcore)
        </label>
      </Section>

      <Section title="Fondo">
        <Seg label="Tipo" value={s.bg.kind} options={[["gradient", "Degradado"], ["media", "Imágenes / vídeo"], ["solid", "Liso"]]} onChange={(v) => bg({ kind: v }, "kind")} />
        <div className="colors">
          <Color label="Base" value={s.bg.c1} onChange={(v) => bg({ c1: v }, "c1")} />
          <Color label="Luz 1" value={s.bg.c2} onChange={(v) => bg({ c2: v }, "c2")} />
          <Color label="Luz 2" value={s.bg.c3} onChange={(v) => bg({ c3: v }, "c3")} />
        </div>
        <div
          className="drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            upload(e.dataTransfer.files);
          }}
        >
          <label>
            Arrastra fotos o clips aquí, o <u>elige</u>
            <input type="file" accept="image/*,video/*" multiple hidden onChange={(e) => upload(e.target.files)} />
          </label>
          {uploading > 0 && <span className="muted"> · subiendo {uploading}…</span>}
        </div>
        {project.media.length > 0 && (
          <div className="media">
            {project.media.map((m, i) => (
              <div key={m.url} className="thumb">
                {m.type === "video" ? <video src={m.url} muted /> : <img src={m.url} alt="" />}
                <div className="thumb-actions">
                  <button disabled={i === 0} onClick={() => set((p) => ({ ...p, media: swap(p.media, i, i - 1) }))} title="Antes">‹</button>
                  <button onClick={() => set((p) => ({ ...p, media: p.media.filter((_, j) => j !== i) }))} title="Quitar">✕</button>
                  <button disabled={i === project.media.length - 1} onClick={() => set((p) => ({ ...p, media: swap(p.media, i, i + 1) }))} title="Después">›</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Seg label="Corte cada" value={s.bg.cutEvery} options={[[1, "1 beat"], [2, "2"], [4, "4"], [8, "8"]]} onChange={(v) => bg({ cutEvery: v }, "cut")} />
        <Slider label="Movimiento" value={s.bg.kenBurns} onChange={(v) => bg({ kenBurns: v }, "kb")} />
        <Slider label="Desenfoque" value={s.bg.blur} max={30} step={1} onChange={(v) => bg({ blur: v }, "blur")} fmt={(v) => `${v}px`} />
        <Slider label="Oscurecer" value={s.bg.darken} onChange={(v) => bg({ darken: v }, "darken")} />
        <label className="check">
          <input type="checkbox" checked={s.bg.bw} onChange={(e) => bg({ bw: e.target.checked }, "bw")} /> Blanco y negro
        </label>
      </Section>
    </div>
  );
}

function Beats({ song, busy, onSeparate }: { song: Song | null; busy: boolean; onSeparate: () => void }) {
  if (!song) return null;
  if (song.beats.length) return <p className="muted small">Pulsos de StemLab: {song.bpm} bpm{song.stemlab ? " · intensidad sacada de la batería" : ""}.</p>;
  return (
    <div className="notice">
      Sin pulsos: los efectos al beat no hacen nada.
      <button className="primary" disabled={busy || !song.audio} onClick={onSeparate}>
        Separar en StemLab
      </button>
      <small className="muted">Separa las pistas con la IA de StemLab (usa la GPU, ~1 min) y saca los pulsos. La canción queda también en StemLab.</small>
    </div>
  );
}

const swap = <T,>(a: T[], i: number, j: number) => {
  const b = [...a];
  [b[i], b[j]] = [b[j], b[i]];
  return b;
};
