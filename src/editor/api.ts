import { ENV_HZ, fromLetras } from "../remotion/timing.ts";
import type { Line, Media, Style, TemplateId, WordEdit } from "../remotion/types.ts";

export type SongInfo = { key: string; artist: string; title: string; words: boolean; audio: boolean; stemlab: boolean };
export type Project = {
  id: string;
  name: string;
  key: string;
  start: number;
  end: number;
  rate: number;
  style: Style;
  edits: Record<string, WordEdit>;
  media: Media[];
  lineTpl?: Record<string, TemplateId>; // per line template
  updated: number;
};
export type Song = {
  key: string;
  artist: string;
  title: string;
  lines: Line[];
  audio: string | null;
  beats: number[];
  bpm: number | null;
  stemlab: boolean;
  peaks: Float32Array; // loudness per PEAK_HZ, 0..1
  env: number[];
  duration: number;
};
export type Job = { id: string; label: string; progress: number; status: "running" | "done" | "error"; result?: any; error?: string };

export const PEAK_HZ = 50;

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  // never hang forever: a request cut by a server restart would leave the screen waiting
  const r = await fetch(url, { signal: AbortSignal.timeout(90_000), ...init }).catch((e: Error) => {
    throw new Error(e.name === "TimeoutError" ? `El servidor no responde (${url})` : `Sin conexión con el servidor: ${e.message}`);
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? r.statusText);
  return data;
}

export const listSongs = () => req<SongInfo[]>("/api/songs");
export const listProjects = () => req<Pick<Project, "id" | "name" | "key" | "updated">[]>("/api/projects");
export const loadProject = (id: string) => req<Project>(`/api/projects/${id}`);
export const saveProject = (p: Project) => req(`/api/projects/${p.id}`, { method: "PUT", body: JSON.stringify(p) });
export const deleteProject = (id: string) => req(`/api/projects/${id}`, { method: "DELETE" });
export const uploadMedia = (f: File) => req<Media>(`/api/media?name=${encodeURIComponent(f.name)}`, { method: "POST", body: f });
const post = (url: string, body?: unknown) => req<Job>(url, { method: "POST", body: JSON.stringify(body ?? {}) });
export const addSong = (artist: string, title: string) => post("/api/add", { artist, title });
export const separate = (key: string) => post(`/api/separate/${key}`);
export const render = (props: unknown, name: string) => post("/api/render", { props, name });

export type Preset = { id: string; name: string; style: Style; rate: number };
export const listPresets = () => req<Preset[]>("/api/presets");
export const savePresets = (all: Preset[]) => req("/api/presets", { method: "PUT", body: JSON.stringify(all) });
export const hasDirector = () => req<{ ai: boolean }>("/api/director").then((r) => r.ai, () => false);
export const direct = (brief: unknown) => req<any>("/api/director", { method: "POST", body: JSON.stringify(brief) });

/** Poll a server job until it ends; `onTick` sees every update. */
export async function follow(job: Job, onTick: (j: Job) => void): Promise<Job> {
  while (job.status === "running") {
    onTick(job);
    await new Promise((r) => setTimeout(r, 700));
    job = await req<Job>(`/api/jobs/${job.id}`);
  }
  onTick(job);
  if (job.status === "error") throw new Error(job.error);
  return job;
}

async function decode(url: string) {
  const buf = await (await fetch(url)).arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, 44100);
  return ctx.decodeAudioData(buf);
}

/** Loudness per 1/ENV_HZ s, 0..1 against the loud end of the song (not its single loudest hit). */
function envelope(a: AudioBuffer) {
  const ch = a.getChannelData(0);
  const hop = Math.round(a.sampleRate / ENV_HZ);
  const out: number[] = [];
  for (let i = 0; i < ch.length; i += hop) {
    let s = 0;
    const end = Math.min(ch.length, i + hop);
    for (let j = i; j < end; j++) s += ch[j] * ch[j];
    out.push(Math.sqrt(s / (end - i)));
  }
  const ref = [...out].sort((x, y) => x - y)[Math.floor(out.length * 0.97)] || 1;
  return out.map((v) => Math.round(Math.min(1, v / ref) * 1000) / 1000);
}

function peaksOf(a: AudioBuffer) {
  const ch = a.getChannelData(0);
  const hop = Math.round(a.sampleRate / PEAK_HZ);
  const out = new Float32Array(Math.ceil(ch.length / hop));
  let max = 1e-9;
  for (let i = 0; i < out.length; i++) {
    let s = 0;
    const e = Math.min(ch.length, (i + 1) * hop);
    for (let j = i * hop; j < e; j++) s += ch[j] * ch[j];
    out[i] = Math.sqrt(s / Math.max(1, e - i * hop));
    max = Math.max(max, out[i]);
  }
  return out.map((v) => v / max);
}

export async function loadSong(key: string): Promise<Song> {
  const s = await req<any>(`/api/song/${key}`);
  const lines = fromLetras(s.doc);
  let peaks = new Float32Array();
  let env: number[] = [];
  let duration = lines.length ? lines[lines.length - 1].end + 5 : 60;
  if (s.audio) {
    const mix = await decode(s.audio);
    duration = mix.duration;
    peaks = peaksOf(mix);
    env = envelope(s.drums ? await decode(s.drums) : mix);
  }
  return {
    key,
    artist: s.doc.artist,
    title: s.doc.title,
    lines,
    audio: s.audio,
    beats: s.beats?.beats ?? [],
    bpm: s.beats?.bpm ?? null,
    stemlab: s.stemlab,
    peaks,
    env,
    duration,
  };
}
