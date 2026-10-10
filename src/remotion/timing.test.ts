import assert from "node:assert/strict";
import { activeGroup, fromLetras, groups, lastBeat } from "./timing.ts";

const lines = fromLetras({
  offset: 0.5,
  word_offset: 0.1,
  lines: [
    { t: 1, end: 3, text: "I don't know why, I'm like this", words: ["I", "don't", "know", "why,", "I'm", "like", "this"].map((w, i) => ({ t: 1 + i * 0.25, end: 1.2 + i * 0.25, w })) },
    { t: null, text: "untimed" },
    { t: 4, text: "no words here" },
  ],
});
assert.equal(lines.length, 2, "untimed lines dropped");
assert.equal(lines[0].t, 1.5, "line offset");
assert.equal(lines[0].words[0].t, 1.6, "words get offset + word_offset");
assert.equal(lines[1].words[0].id, "2:0", "ids keep the letras line index");
assert.equal(lines[1].words.length, 3, "untimed words spread over the line");

const gs = groups(lines, {}, 3);
assert.deepEqual(gs.map((g) => g.words.map((w) => w.w).join(" ")), ["I don't know", "why,", "I'm like this", "no words here"]);
assert.deepEqual(groups(lines, {}, 0).map((g) => g.words.length), [7, 3], "chunk 0 = whole line");
assert.deepEqual(groups(lines, { "0:2": { br: true }, "0:5": { emph: ["hide"] } }, 0).map((g) => g.words.length), [2, 4, 3], "manual break and hidden word");
assert.equal(activeGroup(gs, 1.7)?.index, 0);
assert.equal(activeGroup(gs, 0.5), null);
assert.deepEqual(lastBeat([1, 2, 3], 2.5), { index: 1, since: 0.5 });
console.log("timing ok");
