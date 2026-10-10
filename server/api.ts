import { spawn } from "node:child_process";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir } from "node:os";
import { basename, extname, join, resolve, sep } from "node:path";
import type { Plugin } from "vite";

const HOME = homedir();
const XDG = process.env.XDG_DATA_HOME ?? join(HOME, ".local/share");

/** Same data-dir rules as each engine, so we read exactly what they write. */
function writable(dir: string) {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}
const LETRAS = resolve(process.env.LETRAS_DATA ?? (writable("/data") ? "/data/letras" : join(XDG, "letras")));
const STEMLAB = resolve(process.env.STEMLAB_DATA ?? (existsSync("/data/stemlab") ? "/data/stemlab" : join(XDG, "stemlab")));
const DATA = resolve(process.env.LYRIC_EDITS_DATA ?? join(XDG, "lyric-edits"));
const ENGINES = {
  letras: resolve(process.env.LETRAS_ENGINE ?? join(HOME, "Projects/letras/engine")),
  stemlab: resolve(process.env.STEMLAB_ENGINE ?? join(HOME, "Projects/stemlab/engine")),
};
const ROOTS: Record<string, string> = { letras: LETRAS, stemlab: STEMLAB, data: DATA };
const KEY = /^[a-z0-9-]+$/;

type Job = { id: string; label: string; progress: number; status: "running" | "done" | "error"; result?: unknown; error?: string };
const jobs = new Map<string, Job>();

function startJob(label: string, work: (job: Job) => Promise<unknown>) {
  const job: Job = { id: crypto.randomUUID(), label, progress: 0, status: "running" };
  jobs.set(job.id, job);
  work(job).then(
    (result) => Object.assign(job, { status: "done", progress: 1, result }),
    (e: Error) => Object.assign(job, { status: "error", error: e.message }),
  );
  return job;
}

/** `engine.py <args>` with the engine's own venv; resolves with its `done` event, like the Tauri apps do. */
function engine(name: keyof typeof ENGINES, args: string[], job?: Job): Promise<Record<string, any>> {
  const dir = ENGINES[name];
  return new Promise((ok, fail) => {
    const py = join(dir, ".venv/bin/python");
    if (!existsSync(py)) return fail(new Error(`No está el motor de ${name} en ${dir} (LETRAS_ENGINE / STEMLAB_ENGINE)`));
    const child = spawn(py, [join(dir, "engine.py"), ...args], { cwd: dir, env: { ...process.env, PYTHONUNBUFFERED: "1" } });
    let done: Record<string, any> | null = null;
    let error = "";
    let buf = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        let ev;
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }
        if (ev.event === "done") done = ev;
        else if (ev.event === "error") error = ev.message;
        else if (job && ev.label) {
          job.label = `${name}: ${ev.label}`;
          if (ev.total) job.progress = (ev.step - 1) / ev.total;
        }
      }
    });
    child.stderr.on("data", (d) => (stderr = (stderr + d).slice(-2000)));
    child.on("close", (code) =>
      done ? ok(done) : fail(new Error(error || `${name} ${args[0]} salió con ${code}: ${stderr.trim().split("\n").pop()}`)),
    );
  });
}

const stemDir = (key: string) => join(STEMLAB, "songs", key);
const readJson = async (p: string) => JSON.parse(await readFile(p, "utf8"));

const slug = (s: string) => s.normalize("NFKD").replace(/[^\x00-\x7f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const size = (p: string) => (existsSync(p) ? statSync(p).size : 0);

/**
 * The StemLab song holding this Letras song. Separated from here it has the Letras key as id; separated in StemLab
 * by hand it is named after its file (e.g. "dna"), so the title must match and the audio be the same length.
 */
function stemIdFor(key: string, title = "") {
  if (existsSync(join(stemDir(key), "meta.json"))) return key;
  const t = slug(title);
  const ours = size(join(LETRAS, "audio", `${key}.wav`));
  if (!t || !ours || !existsSync(join(STEMLAB, "songs"))) return null;
  for (const id of readdirSync(join(STEMLAB, "songs"))) {
    if (id !== t && !id.endsWith(`-${t}`) && !id.startsWith(`${t}-`)) continue;
    const theirs = size(join(stemDir(id), "mix.wav"));
    if (theirs && Math.abs(theirs - ours) / ours < 0.02) return id; // same 44.1 kHz WAV: size is length
  }
  return null;
}

/** Beats from StemLab: its `beats` once the song is there. */
async function beatsOf(id: string) {
  const dir = stemDir(id);
  if (!existsSync(join(dir, "beats.json"))) await engine("stemlab", ["beats", id]);
  return readJson(join(dir, "beats.json"));
}

async function song(key: string) {
  const doc = await readJson(join(LETRAS, "lyrics", `${key}.json`));
  const id = stemIdFor(key, doc.title);
  const meta = id ? await readJson(join(stemDir(id), "meta.json")) : null;
  const drums = meta?.stems?.find((s: any) => s.name === "drums" && s.present);
  return {
    doc,
    audio: existsSync(join(LETRAS, "audio", `${key}.wav`)) ? `/file/letras/audio/${key}.wav` : meta ? `/file/stemlab/songs/${id}/mix.wav` : null,
    // loudness for the beat effects reads better from the drums alone
    drums: drums ? `/file/stemlab/songs/${id}/${drums.file}` : null,
    beats: id ? await beatsOf(id).catch(() => null) : null,
    stemlab: !!meta,
  };
}

async function add(artist: string, title: string, job: Job) {
  job.label = "letras: buscando la letra";
  const found = await engine("letras", ["find", artist, title], job);
  const doc = found.lyrics;
  const words = doc.lines?.some((l: any) => l.words?.length);
  if (!words) {
    // same rule as Letras: no timings → AI transcribes or times it; line timings only → fast mode
    const timed = doc.lines?.some((l: any) => l.t != null);
    await engine("letras", ["ai", artist, title, "", "0", timed ? "lineas" : ""], job);
  }
  return { key: found.key };
}

async function separate(key: string, job: Job) {
  const wav = join(LETRAS, "audio", `${key}.wav`);
  if (!existsSync(wav)) throw new Error("Letras no tiene el audio de esta canción en caché");
  const doc = await readJson(join(LETRAS, "lyrics", `${key}.json`)).catch(() => ({}));
  const id = stemIdFor(key, doc.title) ?? key;
  if (!existsSync(join(stemDir(id), "meta.json"))) await engine("stemlab", ["separate", wav], job);
  job.label = "stemlab: buscando los pulsos";
  await engine("stemlab", ["beats", id], job);
  return { key };
}

async function render(props: any, name: string, job: Job) {
  const { bundle } = await import("@remotion/bundler");
  const { renderMedia, selectComposition } = await import("@remotion/renderer");
  job.label = "Preparando el render";
  const serveUrl = await bundle({ entryPoint: resolve("src/remotion/index.ts") });
  const composition = await selectComposition({ serveUrl, id: "LyricEdit", inputProps: props });
  await mkdir(join(DATA, "renders"), { recursive: true });
  const file = `${name.replace(/[^\w.-]+/g, "-").slice(0, 60) || "edit"}-${Date.now().toString(36)}.mp4`;
  job.label = "Renderizando";
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 18,
    inputProps: props,
    outputLocation: join(DATA, "renders", file),
    onProgress: ({ progress }) => (job.progress = progress),
  });
  return { url: `/file/data/renders/${file}`, path: join(DATA, "renders", file) };
}

const DIRECTOR = `You direct viral TikTok lyric edits (CapCut-style kinetic typography, fanfic and aesthetic edits).
Given a lyrics clip with word ids and how long each word is held (d, seconds), choose how the edit should look and which words to push.
Templates: pop (words spring in a few at a time, CapCut captions), stack (one word per row stretched full width, mixed fonts),
dreamy (soft serif fading in from blur, sad/fanfic), glitch (huge caps slamming, RGB split, shake, flashes; hype/phonk),
typewriter (bursts typed on strips whipping in, intimate), bounce (letters spring in one by one, playful),
scatter (messy collage of words with mixed sizes, fonts and tilts), zoom (words fly in from the distance and out through the camera),
neon (neon tubes flickering on as sung, night/romantic), echo (filled word with outlined copies stacked around it, hype),
reel (words rolling in a slot-machine column).
Great edits are very dynamic and change look between lines: use a "mix" of 3-5 templates that fit the song, and pin special
lines (the hook, the drop, the quiet line) to the template that hits hardest via "lines".
Push few words: the hook, held notes, emotional or punchy words; at most one or two per line. Breaks start a new on-screen group at that word:
use them so phrases split where a human editor would cut. Hide only fillers like "uh", "oh" when they hurt the read.
Reply with only JSON: {"template": id, "chunk": 0-6 (max words on screen, 0 = whole line), "case": "upper"|"lower"|"none",
"colors": {"base": hex, "light1": hex, "light2": hex, "accent": hex}, "fx": {"zoom": 0-1, "shake": 0-1, "flash": 0-1, "rgb": 0-1, "grain": 0-1, "vignette": 0-1, "leaks": 0-1, "motion": 0-1 (camera move per line), "cut": 0-1 (zoom punch when a line starts), "bounce": 0-1 (text bobbing on the beat)},
"mix": [template ids], "mixLooks": true (each line also takes its template's fonts), "lines": {"<line id>": template id},
"emphasis": {"<word id>": ["accent"|"big"|"alt"|"hide"]}, "breaks": ["<word id>"], "rate": 0.8|0.9|1|1.15|1.3, "why": "one short sentence in Spanish"}`;

/** Claude picks template, colors, emphasis and cuts. Needs ANTHROPIC_API_KEY; without it the client uses its own rules. */
async function direct(brief: unknown) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.LYRIC_EDITS_MODEL ?? "claude-sonnet-5-5",
      max_tokens: 3000,
      system: DIRECTOR,
      messages: [{ role: "user", content: JSON.stringify(brief) }],
    }),
  });
  const data: any = await r.json();
  if (!r.ok) throw new Error(`Claude: ${data.error?.message ?? r.statusText}`);
  const text: string = data.content?.find((c: any) => c.type === "text")?.text ?? "";
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

const MIME: Record<string, string> = {
  ".wav": "audio/wav", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".json": "application/json",
};

/** Static file with Range support: players seek audio/video with byte ranges. */
function sendFile(req: IncomingMessage, res: ServerResponse, path: string) {
  const size = statSync(path).size;
  const type = MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*" };
  if (range && (range[1] || range[2])) {
    const start = range[1] ? +range[1] : size - +range[2];
    const end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
    createReadStream(path, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...headers, "Content-Length": size });
    createReadStream(path).pipe(res);
  }
}

const body = (req: IncomingMessage) =>
  new Promise<Buffer>((ok, fail) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c)).on("end", () => ok(Buffer.concat(chunks))).on("error", fail);
  });

const json = (res: ServerResponse, data: unknown, status = 200) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url!, "http://x");
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const method = req.method;

  if (parts[0] === "file") {
    const root = ROOTS[parts[1]];
    const path = resolve(root ?? "/nonexistent", ...parts.slice(2));
    if (!root || !path.startsWith(root + sep) || !existsSync(path)) return json(res, { error: "no existe" }, 404);
    return sendFile(req, res, path);
  }
  if (parts[0] !== "api") return false;
  const [, what, id] = parts;

  if (what === "songs") {
    const lib = await engine("letras", ["library"]);

    return json(res, lib.songs.filter((s: any) => s.timed && !s.instrumental).map((s: any) => ({
      key: s.key, artist: s.artist, title: s.title, words: s.words, audio: s.audio.wav || !!stemIdFor(s.key, s.title), stemlab: !!stemIdFor(s.key, s.title),
    })));
  }
  if (what === "song" && id && KEY.test(id)) return json(res, await song(id));
  if (what === "add" && method === "POST") {
    const { artist, title } = JSON.parse((await body(req)).toString());
    return json(res, startJob("letras", (job) => add(artist, title, job)));
  }
  if (what === "separate" && id && KEY.test(id) && method === "POST") return json(res, startJob("stemlab", (job) => separate(id, job)));
  if (what === "render" && method === "POST") {
    const { props, name } = JSON.parse((await body(req)).toString());
    return json(res, startJob("render", (job) => render(props, name ?? "edit", job)));
  }
  if (what === "director" && method === "GET") return json(res, { ai: !!process.env.ANTHROPIC_API_KEY });
  if (what === "director" && method === "POST") {
    const plan = await direct(JSON.parse((await body(req)).toString()));
    return plan ? json(res, plan) : json(res, { error: "Sin ANTHROPIC_API_KEY: uso el director local" }, 501);
  }
  if (what === "presets") {
    const file = join(DATA, "presets.json");
    if (method === "PUT") {
      await mkdir(DATA, { recursive: true });
      await writeFile(file, await body(req));
      return json(res, { ok: true });
    }
    return json(res, existsSync(file) ? await readJson(file) : []);
  }
  if (what === "jobs" && id) return json(res, jobs.get(id) ?? { error: "no existe" }, jobs.has(id) ? 200 : 404);

  if (what === "projects") {
    const dir = join(DATA, "projects");
    await mkdir(dir, { recursive: true });
    if (!id) {
      const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
      const all = await Promise.all(files.map((f) => readJson(join(dir, f)).catch(() => null)));
      return json(res, all.filter(Boolean).map((p) => ({ id: p.id, name: p.name, key: p.key, updated: p.updated })).sort((a, b) => b.updated - a.updated));
    }
    if (!KEY.test(id)) return json(res, { error: "id no válido" }, 400);
    const file = join(dir, `${id}.json`);
    if (method === "PUT") {
      await writeFile(file, await body(req));
      return json(res, { ok: true });
    }
    if (method === "DELETE") {
      await rm(file, { force: true });
      return json(res, { ok: true });
    }
    return existsSync(file) ? sendFile(req, res, file) : json(res, { error: "no existe" }, 404);
  }
  if (what === "media" && method === "POST") {
    const name = basename(url.searchParams.get("name") ?? "media").replace(/[^\w.-]+/g, "-");
    await mkdir(join(DATA, "media"), { recursive: true });
    const file = `${Date.now().toString(36)}-${name}`;
    await writeFile(join(DATA, "media", file), await body(req));
    return json(res, { url: `/file/data/media/${file}`, name, type: /\.(mp4|webm|mov)$/i.test(name) ? "video" : "image" });
  }
  return json(res, { error: "no existe" }, 404);
}

export function api(): Plugin {
  return {
    name: "lyric-edits-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        handle(req, res)
          .then((handled) => handled === false && next())
          .catch((e: Error) => json(res, { error: e.message }, 500));
      });
    },
  };
}
