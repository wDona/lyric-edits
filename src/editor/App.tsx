import { Player, type PlayerRef } from "@remotion/player";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Edit } from "../remotion/Edit.tsx";
import { durationOf, FPS, H, W } from "../remotion/timing.ts";
import type { EditProps } from "../remotion/types.ts";
import * as api from "./api.ts";
import type { Job, Preset, Project, Song, SongInfo } from "./api.ts";
import { applyPlan, autoEdit, brief } from "./auto.ts";
import { Lyrics } from "./Lyrics.tsx";
import { Panels } from "./Panels.tsx";
import { Timeline } from "./Timeline.tsx";
import { useHistory } from "./useHistory.ts";

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const abs = (u: string) => new URL(u, location.origin).href;

/** Claude's plan for the project's clip, applied over it. */
async function withAI(p: Project, song: Song) {
  const plan = applyPlan(await api.direct(brief(song, p.start, p.end)), p.style, new Set(song.lines.flatMap((l) => l.words.map((w) => w.id))));
  return { project: { ...p, style: plan.style, edits: plan.edits, lineTpl: plan.lineTpl, rate: plan.rate ?? p.rate }, why: plan.why };
}

export function App() {
  const [songs, setSongs] = useState<SongInfo[]>([]);
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof api.listProjects>>>([]);
  const hist = useHistory<Project | null>(null);
  const project = hist.state;
  const [song, setSong] = useState<Song | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [rendered, setRendered] = useState<{ url: string; path: string } | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [ai, setAi] = useState(false);
  const [note, setNote] = useState("");
  const seed = useRef(0);
  const loading = useRef(0); // bumped to cancel a load in flight: its result is then dropped
  const player = useRef<PlayerRef>(null);

  const refresh = useCallback(() => {
    api.listSongs().then(setSongs, (e) => setError(e.message));
    api.listProjects().then(setProjects, () => {});
    api.listPresets().then(setPresets, () => {});
    api.hasDirector().then(setAi);
  }, []);

  const changePresets = (all: Preset[]) => {
    setPresets(all);
    api.savePresets(all).catch((e) => setError(e.message));
  };

  const run = useCallback(async (start: Promise<Job>) => {
    setError("");
    try {
      return await api.follow(await start, setJob);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJob(null);
    }
  }, []);

  const open = useCallback(
    async (id: string) => {
      setError("");
      const my = ++loading.current;
      const p = await api.loadProject(id);
      if (my !== loading.current) return;
      setSong(null);
      hist.reset(p);
      history.replaceState(null, "", `?project=${id}`);
      const s = await api.loadSong(p.key);
      if (my === loading.current) setSong(s);
    },
    [hist.reset],
  );

  /** One click: song → finished edit. mode = "auto" (local rules), "ai" (Claude directs) or a preset id. */
  const create = useCallback(
    async (key: string, mode = "auto") => {
      setError("");
      setNote("");
      setJob({ id: "", label: "Cargando la canción", progress: 0, status: "running" });
      const my = ++loading.current;
      try {
        const s = await api.loadSong(key);
        if (my !== loading.current) return;
        const preset = presets.find((p) => p.id === mode);
        const a = autoEdit(s, { base: preset?.style });
        let p: Project = {
          id: `${key}-${Date.now().toString(36)}`.slice(-60).replace(/^-/, ""),
          name: s.title,
          key,
          start: a.start,
          end: a.end,
          rate: preset?.rate ?? 1,
          style: a.style,
          edits: a.edits,
          media: [],
          updated: Date.now(),
        };
        if (mode === "ai") {
          setJob({ id: "", label: "La IA está dirigiendo el edit", progress: 0.5, status: "running" });
          try {
            const r = await withAI(p, s);
            p = r.project;
            setNote(r.why);
          } catch (e) {
            setError(`${(e as Error).message} — queda el edit automático`);
          }
        }
        if (my !== loading.current) return;
        await api.saveProject(p);
        hist.reset(p);
        setSong(s);
        history.replaceState(null, "", `?project=${p.id}`);
      } catch (e) {
        if (my === loading.current) setError((e as Error).message);
      } finally {
        if (my === loading.current) setJob(null);
      }
    },
    [hist.reset, presets],
  );

  // ?song=<letras key> (other apps open a song here), ?project=<id> (reload)
  useEffect(() => {
    refresh();
    const q = new URLSearchParams(location.search);
    if (q.get("project")) open(q.get("project")!).catch((e) => setError(e.message));
    else if (q.get("song")) create(q.get("song")!);
  }, []);

  // autosave
  useEffect(() => {
    if (!project) return;
    const t = setTimeout(() => api.saveProject({ ...project, updated: Date.now() }).catch((e) => setError(e.message)), 600);
    return () => clearTimeout(t);
  }, [project]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest("input, textarea, select, [contenteditable]");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? hist.redo() : hist.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        hist.redo();
      } else if (e.key === " " && !typing) {
        e.preventDefault();
        player.current?.toggle();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [hist.undo, hist.redo]);

  const props: EditProps | null = useMemo(
    () =>
      project && song
        ? {
            lines: song.lines,
            edits: project.edits,
            style: project.style,
            media: project.media,
            audio: song.audio,
            start: project.start,
            end: project.end,
            rate: project.rate,
            beats: song.beats,
            env: song.env,
            lineTpl: project.lineTpl,
          }
        : null,
    [project, song],
  );

  const update = hist.set as (fn: (p: Project) => Project, tag?: string) => void;
  const set = useCallback((fn: (p: Project) => Project, tag?: string) => update((p) => fn(p!), tag), [update]);

  if (!project)
    return (
      <Home
        songs={songs}
        projects={projects}
        job={job}
        error={error}
        presets={presets}
        ai={ai}
        onCancel={() => {
          loading.current++;
          setJob(null);
        }}
        onOpen={(id) => open(id).catch((e) => setError(e.message))}
        onCreate={create}
        onDelete={(id) => api.deleteProject(id).then(refresh)}
        onAdd={async (artist, title, mode) => {
          const j = await run(api.addSong(artist, title));
          refresh();
          if (j?.result?.key) create(j.result.key, mode);
        }}
      />
    );

  const doRender = async () => {
    if (!props) return;
    setRendered(null);
    const j = await run(api.render({ ...props, audio: props.audio && abs(props.audio), media: props.media.map((m) => ({ ...m, url: abs(m.url) })) }, project.name));
    if (j) setRendered(j.result);
  };

  return (
    <div className="app">
      <header>
        <button className="ghost" onClick={() => (loading.current++, hist.reset(null), setSong(null), setJob(null), history.replaceState(null, "", "/"), refresh())} title="Volver a la biblioteca">
          ← Biblioteca
        </button>
        <input className="name" value={project.name} onChange={(e) => set((p) => ({ ...p, name: e.target.value }), "name")} />
        <span className="muted">{song ? `${song.artist} — ${song.title}` : "Cargando…"}</span>
        {note && <span className="note" title={note}>IA: {note}</span>}
        <div className="grow" />
        <button
          disabled={!song || !!job}
          title="Otra plantilla, colores y destacados para el mismo clip"
          onClick={() => {
            seed.current++;
            set((p) => ({ ...p, ...autoEdit(song!, { seed: seed.current, range: p }), lineTpl: {} }));
            setNote("");
          }}
        >
          🎲 Otra versión
        </button>
        {ai && (
          <button
            disabled={!song || !!job}
            title="Claude elige plantilla, colores, palabras destacadas y cortes para este clip"
            onClick={async () => {
              setError("");
              setJob({ id: "", label: "La IA está dirigiendo el edit", progress: 0.5, status: "running" });
              try {
                const r = await withAI(project, song!);
                set(() => r.project);
                setNote(r.why);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setJob(null);
              }
            }}
          >
            ✨ Dirigir con IA
          </button>
        )}
        <button className="ghost" disabled={!hist.canUndo} onClick={hist.undo} title="Deshacer (Ctrl+Z)">↶</button>
        <button className="ghost" disabled={!hist.canRedo} onClick={hist.redo} title="Rehacer (Ctrl+Shift+Z)">↷</button>
        {job ? (
          <div className="job">
            <span>{job.label}</span>
            <progress value={job.progress} max={1} />
          </div>
        ) : rendered ? (
          <a className="done" href={rendered.url} target="_blank" title={rendered.path}>
            Ver MP4 ↗
          </a>
        ) : null}
        <button className="primary" disabled={!props || !!job} onClick={doRender}>
          Exportar MP4
        </button>
      </header>
      {error && <div className="error" onClick={() => setError("")}>{error}</div>}
      <aside className="left">
        <Panels
          project={project}
          song={song}
          set={set}
          busy={!!job}
          presets={presets}
          onPresets={changePresets}
          onSeparate={async () => {
            if (await run(api.separate(project.key))) setSong(await api.loadSong(project.key));
          }}
        />
      </aside>
      <main className="stage">
        {props ? (
          <Player
            ref={player}
            component={Edit}
            inputProps={props}
            durationInFrames={durationOf(props)}
            fps={FPS}
            compositionWidth={W}
            compositionHeight={H}
            controls
            loop
            clickToPlay
            spaceKeyToPlayOrPause={false}
            acknowledgeRemotionLicense
            style={{ height: "100%", aspectRatio: "9 / 16", maxWidth: "100%", borderRadius: 14, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}
          />
        ) : (
          <div className="muted">Cargando audio…</div>
        )}
      </main>
      <aside className="right">{song && <Lyrics project={project} song={song} set={set} player={player} />}</aside>
      <footer>{song && <Timeline project={project} song={song} set={set} player={player} />}</footer>
    </div>
  );
}

function Home(props: {
  songs: SongInfo[];
  projects: { id: string; name: string; key: string; updated: number }[];
  job: Job | null;
  error: string;
  presets: Preset[];
  ai: boolean;
  onCancel: () => void;
  onOpen: (id: string) => void;
  onCreate: (key: string, mode: string) => void;
  onDelete: (id: string) => void;
  onAdd: (artist: string, title: string, mode: string) => void;
}) {
  const [mode, setMode] = useState(props.ai ? "ai" : "auto");
  useEffect(() => setMode((m) => (m === "auto" && props.ai ? "ai" : m)), [props.ai]);
  const [q, setQ] = useState("");
  const [artist, setArtist] = useState("");
  const [title, setTitle] = useState("");
  const shown = props.songs.filter((s) => norm(`${s.artist} ${s.title}`).includes(norm(q)));
  return (
    <div className="home">
      <h1>Lyric Edits</h1>
      {props.error && <div className="error">{props.error}</div>}
      {props.job && (
        <div className="job">
          <span>{props.job.label}</span>
          <progress value={props.job.progress} max={1} />
          <button className="ghost" onClick={props.onCancel} title="Dejar de esperar">
            ✕
          </button>
        </div>
      )}
      <div className="cols">
        <section>
          <h2>Tus edits</h2>
          {!props.projects.length && <p className="muted">Todavía ninguno: elige una canción.</p>}
          {props.projects.map((p) => (
            <div key={p.id} className="row">
              <button className="link" onClick={() => props.onOpen(p.id)}>
                {p.name}
              </button>
              <span className="muted">{new Date(p.updated).toLocaleString()}</span>
              <button className="ghost" onClick={() => confirm(`¿Borrar «${p.name}»?`) && props.onDelete(p.id)} title="Borrar">
                ✕
              </button>
            </div>
          ))}
        </section>
        <section>
          <h2>Canciones de Letras</h2>
          <div className="seg-row">
            <span>Un clic en una canción y sale el edit hecho:</span>
            <div className="seg">
              <button className={mode === "auto" ? "on" : ""} onClick={() => setMode("auto")} title="Estribillo, plantilla según el ritmo y la energía, palabras largas destacadas">
                Automático
              </button>
              <button
                className={mode === "ai" ? "on" : ""}
                disabled={!props.ai}
                onClick={() => setMode("ai")}
                title={props.ai ? "Claude elige plantilla, colores, destacados y cortes" : "Arranca con ANTHROPIC_API_KEY para usarlo"}
              >
                ✨ IA
              </button>
              {props.presets.map((p) => (
                <button key={p.id} className={mode === p.id ? "on" : ""} onClick={() => setMode(p.id)} title="Preset guardado">
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="songs">
            {shown.map((s) => (
              <button key={s.key} className="song" disabled={!s.audio || !!props.job} onClick={() => props.onCreate(s.key, mode)} title={s.audio ? "" : "Sin audio en caché: sincronízala con IA en Letras"}>
                <b>{s.title}</b>
                <span>{s.artist}</span>
                <small>
                  {s.words ? "palabra a palabra" : "por líneas"}
                  {s.stemlab ? " · StemLab" : ""}
                </small>
              </button>
            ))}
          </div>
          <form
            className="add"
            onSubmit={(e) => {
              e.preventDefault();
              if (artist && title) props.onAdd(artist, title, mode);
            }}
          >
            <input placeholder="Artista" value={artist} onChange={(e) => setArtist(e.target.value)} />
            <input placeholder="Canción" value={title} onChange={(e) => setTitle(e.target.value)} />
            <button className="primary" disabled={!!props.job}>
              Añadir con Letras
            </button>
          </form>
          <p className="muted small">Busca la letra y la sincroniza con la IA de Letras (y descarga el audio si hace falta).</p>
        </section>
      </div>
    </div>
  );
}
