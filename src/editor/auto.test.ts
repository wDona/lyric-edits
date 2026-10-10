import assert from "node:assert/strict";
import { presetStyle } from "../remotion/presets.ts";
import { segments } from "../remotion/mix.ts";
import { fromLetras } from "../remotion/timing.ts";
import { applyPlan, autoEdit } from "./auto.ts";

const w = (s: string, t: number, d: number) => ({ w: s, t, end: t + d });
const lines = fromLetras({
  lines: [
    { t: 10, text: "I'll be the villain", words: [w("I'll", 10, 0.2), w("be", 10.2, 0.2), w("the", 10.4, 0.2), w("villain", 10.6, 1.2)] },
    { t: 12, text: "I'll be the villain", words: [w("I'll", 12, 0.2), w("be", 12.2, 0.2), w("the", 12.4, 0.2), w("villain", 12.6, 0.3)] },
  ],
});
const song = { key: "x", title: "Villain", lines, beats: [], bpm: 70, env: [] };
const a = autoEdit(song);
assert.equal(a.start, 9.75, "clip starts at the repeated line");
assert.equal(a.style.template, "dreamy", "slow song → dreamy");
assert.ok(a.edits["0:3"].emph!.includes("big"), "held word pushed");
assert.deepEqual(a.edits["1:3"], { emph: ["accent"] }, "title word in accent");
assert.equal(a.style.fx.shake, 0, "no beats → no beat shake");

const ids = new Set(lines.flatMap((l) => l.words.map((x) => x.id)));
const p = applyPlan({ template: "evil", chunk: 99, colors: { accent: "red", base: "#112233" }, fx: { zoom: 7 }, emphasis: { "0:1": ["big", "nope"], "9:9": ["big"] }, breaks: ["1:2", 5], rate: 2 }, presetStyle("pop"), ids);
assert.equal(p.style.template, "pop", "unknown template ignored");
assert.equal(p.style.chunk, 3);
assert.equal(p.style.bg.c1, "#112233");
assert.equal(p.style.accent, presetStyle("pop").accent, "bad color ignored");
assert.equal(p.style.fx.zoom, 1, "clamped");
assert.deepEqual(p.edits, { "0:1": { emph: ["big"] }, "1:2": { br: true } });
assert.equal(p.rate, null);
const many = fromLetras({ lines: Array.from({ length: 12 }, (_, i) => ({ t: i * 2, text: "la la", words: [w("la", i * 2, 0.5), w("la", i * 2 + 0.6, 0.5)] })) });
const mixed = presetStyle("pop");
mixed.mix = ["pop", "stack", "echo"];
const tpls = segments(many, mixed, { "4": "neon" }).map((s) => s.tpl);
assert.ok(tpls.every((x, i) => i === 0 || x !== tpls[i - 1]), "no two lines in a row with the same template");
assert.equal(tpls[4], "neon", "per-line override wins");
assert.ok(new Set(tpls).size >= 3, "the mix is actually used");
mixed.mixBy = "words";
mixed.mixMin = 3;
mixed.mixMax = 5;
const segs = segments(many, mixed);
assert.equal(segs.flatMap((s) => s.line.words).length, 24, "every word in exactly one run");
// a run crossing into the next line is two segments with the same template: merge them back
const runs: { tpl: string; n: number }[] = [];
for (const s of segs) {
  const last = runs[runs.length - 1];
  if (last && last.tpl === s.tpl) last.n += s.line.words.length;
  else runs.push({ tpl: s.tpl, n: s.line.words.length });
}
assert.ok(runs.slice(0, -1).every((r) => r.n >= 3 && r.n <= 5), `runs of 3..5 words: ${runs.map((r) => r.n)}`);
assert.ok(new Set(runs.map((r) => r.tpl)).size >= 3, "the mix is used across runs");
console.log("auto ok");
