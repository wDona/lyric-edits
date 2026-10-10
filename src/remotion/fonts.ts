import type { CSSProperties } from "react";
import * as Anton from "@remotion/google-fonts/Anton";
import * as ArchivoBlack from "@remotion/google-fonts/ArchivoBlack";
import * as BebasNeue from "@remotion/google-fonts/BebasNeue";
import * as CourierPrime from "@remotion/google-fonts/CourierPrime";
import * as DancingScript from "@remotion/google-fonts/DancingScript";
import * as DMSerifDisplay from "@remotion/google-fonts/DMSerifDisplay";
import * as InstrumentSerif from "@remotion/google-fonts/InstrumentSerif";
import * as Montserrat from "@remotion/google-fonts/Montserrat";
import * as PlayfairDisplay from "@remotion/google-fonts/PlayfairDisplay";
import * as SpaceGrotesk from "@remotion/google-fonts/SpaceGrotesk";
import * as Syne from "@remotion/google-fonts/Syne";

const latin = { subsets: ["latin", "latin-ext"] as ("latin" | "latin-ext")[] };
// only the cuts the fonts below use: each loadFont blocks the render until it is in
const loads = [
  Anton.loadFont("normal", { weights: ["400"], ...latin }),
  ArchivoBlack.loadFont("normal", { weights: ["400"], ...latin }),
  BebasNeue.loadFont("normal", { weights: ["400"], ...latin }),
  CourierPrime.loadFont("normal", { weights: ["400", "700"], ...latin }),
  DancingScript.loadFont("normal", { weights: ["700"], ...latin }),
  DMSerifDisplay.loadFont("italic", { weights: ["400"], ...latin }),
  InstrumentSerif.loadFont("normal", { weights: ["400"], ...latin }),
  InstrumentSerif.loadFont("italic", { weights: ["400"], ...latin }),
  Montserrat.loadFont("normal", { weights: ["800", "900"], ...latin }),
  Montserrat.loadFont("italic", { weights: ["900"], ...latin }),
  PlayfairDisplay.loadFont("italic", { weights: ["700"], ...latin }),
  SpaceGrotesk.loadFont("normal", { weights: ["700"], ...latin }),
  Syne.loadFont("normal", { weights: ["800"], ...latin }),
];

type Font = { label: string; family: string; weight: number; italic?: boolean };

export const FONTS: Record<string, Font> = {
  montserrat: { label: "Montserrat Black", family: Montserrat.fontFamily, weight: 900 },
  montserratItalic: { label: "Montserrat Black Italic", family: Montserrat.fontFamily, weight: 900, italic: true },
  anton: { label: "Anton", family: Anton.fontFamily, weight: 400 },
  bebas: { label: "Bebas Neue", family: BebasNeue.fontFamily, weight: 400 },
  archivo: { label: "Archivo Black", family: ArchivoBlack.fontFamily, weight: 400 },
  syne: { label: "Syne", family: Syne.fontFamily, weight: 800 },
  grotesk: { label: "Space Grotesk", family: SpaceGrotesk.fontFamily, weight: 700 },
  instrument: { label: "Instrument Serif", family: InstrumentSerif.fontFamily, weight: 400 },
  instrumentItalic: { label: "Instrument Serif Italic", family: InstrumentSerif.fontFamily, weight: 400, italic: true },
  playfair: { label: "Playfair Italic", family: PlayfairDisplay.fontFamily, weight: 700, italic: true },
  dmserif: { label: "DM Serif Italic", family: DMSerifDisplay.fontFamily, weight: 400, italic: true },
  dancing: { label: "Dancing Script", family: DancingScript.fontFamily, weight: 700 },
  courier: { label: "Courier Prime", family: CourierPrime.fontFamily, weight: 700 },
};

export function fontCss(id: string): CSSProperties {
  const f = FONTS[id] ?? FONTS.montserrat;
  return { fontFamily: `"${f.family}"`, fontWeight: f.weight, fontStyle: f.italic ? "italic" : "normal" };
}

/** Resolves once every font above is really in (document.fonts can answer before Remotion has even added them). */
export const fontsLoaded = () => Promise.all(loads.map((l) => l.waitUntilDone()));

let probe: HTMLSpanElement | null = null;
/**
 * Width of `text` at 100px in a font, laid out by the DOM. Not canvas: the render's headless Chrome
 * measures canvas text with the fallback font even once the web font is in. Not cached: the first
 * frames measure before the font has loaded.
 */
export function measure(text: string, id: string) {
  const f = FONTS[id] ?? FONTS.montserrat;
  if (!probe) {
    probe = document.createElement("span");
    Object.assign(probe.style, { position: "absolute", left: "-99999px", top: "0", whiteSpace: "pre", fontSize: "100px", lineHeight: "1" });
    document.body.appendChild(probe);
  }
  Object.assign(probe.style, { fontFamily: `"${f.family}"`, fontWeight: String(f.weight), fontStyle: f.italic ? "italic" : "normal" });
  probe.textContent = text;
  return probe.getBoundingClientRect().width || 1;
}
