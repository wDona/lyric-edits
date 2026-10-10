import type { Style, TemplateId } from "./types.ts";

const base: Style = {
  template: "pop",
  font: "montserrat",
  altFont: "playfair",
  size: 1,
  color: "#ffffff",
  accent: "#ffe14d",
  stroke: 0,
  glow: 0,
  shadow: 0.6,
  box: false,
  case: "none",
  chunk: 3,
  posY: 0.5,
  bg: { kind: "gradient", c1: "#1a0b2e", c2: "#ff2e7e", c3: "#2b59ff", cutEvery: 4, kenBurns: 0.5, blur: 0, darken: 0.35, bw: false },
  fx: { zoom: 0.6, shake: 0.15, flash: 0.15, rgb: 0, grain: 0.15, vignette: 0.45, leaks: 0, letterbox: false, motion: 0.7, cut: 0.7, bounce: 0.6 },
  pitch: true,
};

type Preset = { label: string; hint: string; style: Partial<Omit<Style, "bg" | "fx">> & { bg?: Partial<Style["bg"]>; fx?: Partial<Style["fx"]> } };

/** A template is a layout + the look it is known for; picking one resets the look, the media stays. */
export const PRESETS: Record<TemplateId, Preset> = {
  pop: {
    label: "Pop",
    hint: "Palabras que saltan de 3 en 3, estilo CapCut",
    style: { box: true, accent: "#ffe14d", size: 1.3 },
  },
  stack: {
    label: "Stack",
    hint: "Tipografía apilada a todo el ancho, fuentes mezcladas",
    style: {
      font: "anton", altFont: "instrumentItalic", case: "upper", chunk: 5, shadow: 0.3, accent: "#ff4d8d",
      bg: { c1: "#050505", c2: "#3a0d1e", c3: "#0d1a3a" }, fx: { zoom: 0.35, grain: 0.3, vignette: 0.6 },
    },
  },
  dreamy: {
    label: "Dreamy",
    hint: "Serif en cursiva que aparece desenfocada, con brillo y grano",
    style: {
      font: "instrumentItalic", altFont: "dancing", case: "lower", chunk: 3, size: 1.2, glow: 0.7, shadow: 0, accent: "#ffd6f0",
      bg: { c1: "#0b0b14", c2: "#6b4a7a", c3: "#2d3f66", bw: true, darken: 0.45, blur: 4 },
      fx: { zoom: 0.25, shake: 0, flash: 0, grain: 0.45, vignette: 0.75, leaks: 0.6, motion: 0.5, cut: 0.35, bounce: 0.2 },
    },
  },
  glitch: {
    label: "Glitch",
    hint: "Golpes en mayúsculas, RGB, temblor y flashes en cada beat",
    style: {
      font: "anton", altFont: "montserratItalic", case: "upper", chunk: 2, size: 1.25, stroke: 0, shadow: 0.4, accent: "#ff1f3d",
      bg: { c1: "#000000", c2: "#3d0008", c3: "#1a1a1a", darken: 0.5, cutEvery: 2 },
      fx: { zoom: 0.9, shake: 0.8, flash: 0.6, rgb: 0.8, grain: 0.3, vignette: 0.5, motion: 0.9, cut: 1, bounce: 0.8 },
    },
  },
  typewriter: {
    label: "Máquina",
    hint: "Ráfagas tecleadas en franjas que entran de lado, cada una en otro sitio",
    style: {
      font: "courier", altFont: "courier", chunk: 3, size: 1.1, box: true, shadow: 0, accent: "#ff5f5f",
      bg: { c1: "#101010", c2: "#2e2a24", c3: "#1b1f24", bw: true }, fx: { zoom: 0.1, grain: 0.35, vignette: 0.6 },
    },
  },
  bounce: {
    label: "Ola",
    hint: "Cada letra salta por turnos y las palabras rebotan al beat",
    style: { font: "syne", altFont: "dmserif", chunk: 3, size: 1.15, shadow: 0.5, accent: "#9dff6a", bg: { c1: "#03140f", c2: "#00b386", c3: "#0047ab" } },
  },
  scatter: {
    label: "Collage",
    hint: "El verso se amontona: cada palabra con su tamaño, fuente y giro",
    style: {
      font: "archivo", altFont: "dmserif", chunk: 0, size: 0.95, shadow: 0.5, accent: "#ff7a1a",
      bg: { c1: "#1a0a00", c2: "#ff7a1a", c3: "#ff1f3d" }, fx: { grain: 0.35, vignette: 0.5 },
    },
  },
  zoom: {
    label: "Vuelo 3D",
    hint: "Las palabras llegan desde el fondo y salen atravesando la cámara",
    style: {
      font: "montserrat", case: "upper", chunk: 1, size: 1.35, shadow: 0.5, accent: "#00e5ff",
      bg: { c1: "#020617", c2: "#1e3a8a", c3: "#7c3aed" }, fx: { zoom: 0.8, rgb: 0.35, motion: 0.9, cut: 0.8 },
    },
  },
  neon: {
    label: "Neón",
    hint: "Tubos de neón que parpadean al encenderse cuando se cantan",
    style: {
      font: "dancing", altFont: "syne", chunk: 3, size: 1.3, shadow: 0, accent: "#ff3df5",
      bg: { c1: "#06000f", c2: "#2a0a4a", c3: "#001a33", darken: 0.55 }, fx: { grain: 0.25, vignette: 0.7, leaks: 0.2, flash: 0 },
    },
  },
  echo: {
    label: "Eco",
    hint: "La palabra rellena en el centro y copias en contorno que se abren al beat",
    style: {
      font: "anton", altFont: "playfair", case: "upper", chunk: 1, size: 1.3, shadow: 0, accent: "#ff4d8d",
      bg: { c1: "#000000", c2: "#26001a", c3: "#001426" }, fx: { zoom: 0.8, shake: 0.4, flash: 0.3, motion: 0.8, cut: 0.9 },
    },
  },
  reel: {
    label: "Rueda",
    hint: "Las palabras en columna giran como una tragaperras hasta la que suena",
    style: {
      font: "bebas", altFont: "instrumentItalic", case: "upper", chunk: 0, size: 1.2, shadow: 0.4, accent: "#ffe14d",
      bg: { c1: "#0a0a0a", c2: "#3d2a00", c3: "#1a1033" }, fx: { zoom: 0.5, bounce: 0.3 },
    },
  },
};

/** Per-template type: fonts, sizes and grouping, without colors, background or effects. */
export function looksOf(id: TemplateId): Partial<Style> {
  const s = presetStyle(id);
  return { font: s.font, altFont: s.altFont, case: s.case, chunk: s.chunk, size: s.size, glow: s.glow, shadow: s.shadow, box: s.box, posY: s.posY };
}

export function presetStyle(id: TemplateId): Style {
  const p = PRESETS[id].style;
  return { ...base, ...p, template: id, bg: { ...base.bg, ...p.bg }, fx: { ...base.fx, ...p.fx } };
}
