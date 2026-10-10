export type Word = { id: string; t: number; end: number; w: string };
export type Line = { id: string; t: number; end: number; text: string; words: Word[] };

export type Emph = "accent" | "big" | "alt" | "hide";
/** Per-word overrides, keyed by Word.id ("line:word"). */
export type WordEdit = { emph?: Emph[]; text?: string; br?: boolean };

export type TemplateId =
  | "pop" | "stack" | "dreamy" | "glitch" | "typewriter"
  | "bounce" | "scatter" | "zoom" | "neon" | "echo" | "reel";

export type Style = {
  template: TemplateId;
  font: string;
  altFont: string;
  size: number; // multiplier
  color: string;
  accent: string;
  stroke: number; // 0..1
  glow: number; // 0..1
  shadow: number; // 0..1
  box: boolean; // highlight box behind the active word / line
  case: "upper" | "lower" | "none";
  chunk: number; // max words on screen, 0 = whole line
  posY: number; // 0..1, vertical center of the text
  bg: {
    kind: "gradient" | "media" | "solid";
    c1: string;
    c2: string;
    c3: string;
    cutEvery: number; // beats per media cut
    kenBurns: number;
    blur: number;
    darken: number;
    bw: boolean;
  };
  fx: {
    zoom: number;
    shake: number;
    flash: number;
    rgb: number;
    grain: number;
    vignette: number;
    leaks: number;
    letterbox: boolean;
    motion?: number; // camera move per line
    cut?: number; // zoom punch + blur when a line starts
    bounce?: number; // text bobbing on the beat
  };
  pitch: boolean; // speed changes pitch too (nightcore / slowed)
  mix?: TemplateId[]; // 2+ = every line takes one of these
  mixLooks?: boolean; // each mixed line also takes its template's fonts and sizes
  mixSeed?: number;
  mixBy?: "line" | "words"; // change template every line, or every mixMin..mixMax words
  mixMin?: number;
  mixMax?: number;
};

export type Media = { url: string; type: "image" | "video"; name: string };

/** Everything the composition needs; the editor builds it and the renderer gets the exact same object. */
export type EditProps = {
  lines: Line[];
  edits: Record<string, WordEdit>;
  style: Style;
  media: Media[];
  audio: string | null;
  start: number;
  end: number;
  rate: number;
  beats: number[];
  env: number[]; // loudness 0..1 at ENV_HZ, song time
  lineTpl?: Record<string, TemplateId>; // per line (Line.id) template, beats the mix
};
