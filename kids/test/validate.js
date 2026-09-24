#!/usr/bin/env node
/* Türkçe Macera — data integrity and colour contrast.
   The units are the whole content of the app, and a slip in them shows up
   as a game that cannot be won: an emoji used twice in a unit makes a
   picture question with two right answers, a phrase of one word cannot be
   built from tiles, a word with a capital or a stray space cannot be spelt
   with letter tiles. Ids are permanent, so they are pinned.
   Usage: node kids/test/validate.js [dist/kids/index.html]             */
const fs = require("fs"), path = require("path"), vm = require("vm");
const file = process.argv[2] || path.join(__dirname, "..", "..", "dist", "kids", "index.html");
const errs = []; let checks = 0;
const err = (w, m) => errs.push(w + ": " + m);
const html = fs.readFileSync(file, "utf8");
const code = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
const cut = code.indexOf("/* ===================== macera · app");
if (cut < 0) { console.error("validate: cannot find the app banner"); process.exit(1); }
const sb = {}; vm.createContext(sb);
vm.runInContext(code.slice(0, cut) + "\nthis.OUT={KUNITS:KUNITS,CAST:CAST,fold:fold};", sb);
const { KUNITS, CAST, fold } = sb.OUT;

const IDS = ["k1","k2","k3","k4","k5","k6","k7","k8","k9","k10","k11","k12"];
const str = v => typeof v === "string" && v.trim().length > 0;
const INVIS = /[­​-‏⁠﻿]/;
const LETTERS = /^[a-zçğıöşüâîû ]+$/;
const SPELL = /^[a-zçğıöşüâîû]+$/;
if (KUNITS.length !== IDS.length) err("KUNITS", "expected " + IDS.length + " units, found " + KUNITS.length);
IDS.forEach((id, i) => { if (!KUNITS[i] || KUNITS[i].id !== id) err("KUNITS[" + i + "]", "expected " + id + " — unit ids are permanent and keyed to saved progress"); });
const clean = (w, t) => { checks++; if (!str(t)) err(w, "is empty"); else if (INVIS.test(t)) err(w, "has an invisible character"); };
KUNITS.forEach(u => {
  const at = u.id;
  ["tr", "en", "icon"].forEach(k => clean(at + " " + k, u[k]));
  if (!Array.isArray(u.words) || u.words.length !== 10) { err(at, "needs ten words"); return; }
  const em = new Set(), tr = new Set(), en = new Set();
  let spell = 0;
  u.words.forEach((w, i) => {
    const wa = at + " word " + i;
    if (!Array.isArray(w) || w.length !== 3) { err(wa, "must be [turkish, english, emoji]"); return; }
    /* The emoji is exempt from the invisible-character check: compound
       emoji such as 🧑‍🏫 are joined by U+200D and need it. */
    w.forEach((x, j) => { if (j < 2) clean(wa + "[" + j + "]", x); else if (!str(x)) err(wa, "has no emoji"); });
    if (!LETTERS.test(w[0])) err(wa, '"' + w[0] + '" must be lower-case Turkish letters and spaces only — it is spelt with tiles');
    if (SPELL.test(w[0]) && w[0].length <= 10) spell++;
    [[em, w[2], "emoji"], [tr, fold(w[0]), "Turkish"], [en, w[1], "English"]].forEach(([set, v, what]) => {
      if (set.has(v)) err(wa, "repeats the " + what + " " + JSON.stringify(v) + " — a picture or choice question would have two right answers");
      set.add(v);
    });
  });
  if (spell < 4) err(at, "has " + spell + " spellable words; the second lesson spells four");
  if (!Array.isArray(u.phrases) || u.phrases.length !== 4) err(at, "needs four phrases");
  else u.phrases.forEach((p, i) => {
    clean(at + " phrase " + i, p[0]); clean(at + " phrase " + i + " en", p[1]);
  });
  /* Sentence-building takes two phrases of two words or more; a one-word
     phrase is still fine to say aloud. */
  if (Array.isArray(u.phrases) && u.phrases.filter(p => String(p[0]).trim().split(/\s+/).length >= 2).length < 2)
    err(at, "needs at least two phrases of two words or more to build from tiles");
  const t = u.tip || {};
  clean(at + " tip.t", t.t); clean(at + " tip.en", t.en);
  if (!Array.isArray(t.eg) || t.eg.length !== 2) err(at, "tip needs two examples");
  else t.eg.forEach((e, i) => { clean(at + " tip.eg " + i, e[0]); clean(at + " tip.eg " + i + " en", e[1]); });
  if (!Array.isArray(u.talk) || u.talk.length < 4) err(at, "the comic needs four lines or more");
  else u.talk.forEach((l, i) => {
    if (!CAST[l[0]]) err(at + " talk " + i, "speaker " + JSON.stringify(l[0]) + " is not in CAST");
    clean(at + " talk " + i, l[1]); clean(at + " talk " + i + " en", l[2]);
  });
});

/* WCAG AA in both themes, on every pair the stylesheet paints text in. */
const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
const tokens = block => { const o = {}; for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) o[m[1]] = m[2]; return o; };
const light = tokens(/:root\{([^}]*)\}/.exec(css)[1]);
const darkMq = tokens(/prefers-color-scheme: dark\)\{:root:not\(\[data-theme="light"\]\)\{([^}]*)\}/.exec(css)[1]);
const darkTg = tokens(/:root\[data-theme="dark"\]\{([^}]*)\}/.exec(css)[1]);
if (JSON.stringify(darkMq) !== JSON.stringify(darkTg)) err("contrast", "the two copies of the dark palette have drifted");
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const PAIRS = [["ink","bg"],["ink","card"],["ink","sunk"],["ink2","card"],["ink2","bg"],["faint","card"],["faint","bg"],["faint","sunk"],
  ["on-brand","brand"],["on-brand","ok"],["brand-ink","card"],["brand-ink","bg"],["brand-ink","brand-soft"],["ink","brand-soft"],
  ["ok","ok-bg"],["no","no-bg"],["ink","ok-bg"],["ink","no-bg"],["faint","ok-bg"],["faint","no-bg"],["no","bg"],["sun-ink","bg"],["sun-ink","card"]];
[["light", light], ["dark", Object.assign({}, light, darkMq)]].forEach(([th, T]) => PAIRS.forEach(([f, b]) => {
  checks++;
  if (!T[f] || !T[b]) { err("contrast", th + ": --" + (T[f] ? b : f) + " is not defined"); return; }
  const r = ratio(T[f], T[b]);
  if (r < 4.5) err("contrast", th + " --" + f + " on --" + b + " is " + r.toFixed(2) + ":1, needs 4.5");
}));
if (/color:\s*(#fff\b|#ffffff\b|white\b)/i.test(css)) err("contrast", "a rule paints literal white text — use var(--on-brand)");

if (errs.length) { errs.forEach(e => console.error("  ERROR " + e)); console.error("\nkids validate: " + errs.length + " error(s)"); process.exit(1); }
console.log("kids validate ok · " + KUNITS.length + " units · " + KUNITS.length * 10 + " words · " + checks + " checks");
