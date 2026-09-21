#!/usr/bin/env node
/* Data integrity for the course itself: sixty units in order, ten words
   each, five drills each, and every answer key actually answerable.

   The order tiles are the check that breaks most often when editing —
   w.join(" ") has to fold-equal c, or the learner can build the sentence
   the drill is asking for and still be told it is wrong.

   Errors fail the run. Warnings are shape drift from the schema in
   CLAUDE.md (passage length, gloss count, table rows) and only print.

   Usage: node test/validate.js [dist/index.html]                      */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const file = process.argv[2] || path.join(root, "dist", "index.html");

const errs = [], warns = [];
const err = (where, msg) => errs.push(where + ": " + msg);
const warn = (where, msg) => warns.push(where + ": " + msg);

/* ---------- load the data half of the built file ---------- */
let html;
try { html = fs.readFileSync(file, "utf8"); }
catch (e) { console.error("validate: cannot read " + file + " — run ./build.sh first"); process.exit(1); }

const open = html.indexOf("<script>");
const close = html.lastIndexOf("</script>");
if (open < 0 || close < 0) { console.error("validate: no <script> block in " + file); process.exit(1); }
const code = html.slice(open + "<script>".length, close);

/* Everything up to the app banner is pure data and runs without a DOM. */
let cut = code.indexOf("/* ===================== app ===================== */");
if (cut < 0) cut = code.indexOf("const APP_VERSION");
if (cut < 0) { console.error("validate: cannot find the start of app.js in the build"); process.exit(1); }

/* fold() is the app's own matcher — pull it out of the build rather than
   keeping a second copy here, so this test can never drift from it. */
const foldSrc = /function fold\(s\)\{[\s\S]*?\n\}/.exec(code);
if (!foldSrc) { console.error("validate: cannot find fold() in the build"); process.exit(1); }

const sandbox = {};
try {
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, cut) + "\n" + foldSrc[0] + "\nthis.D={LEVELS:LEVELS,UNITS:UNITS,PLACEMENT:PLACEMENT,fold:fold};", sandbox, { filename: file });
} catch (e) {
  console.error("validate: the data does not evaluate — " + e.message);
  process.exit(1);
}
const { LEVELS, UNITS, PLACEMENT, fold } = sandbox.D;

/* ---------- helpers ---------- */
const str = v => typeof v === "string" && v.trim().length > 0;
const pairs = v => Array.isArray(v) && v.every(p => Array.isArray(p) && p.length === 2 && str(p[0]) && str(p[1]));
/* Fields the app prints through esc(); raw tags there render as literal text. */
const TAGS = /<\/?(b|i|u|code|em|span|br)\b/i;

/* ---------- levels ---------- */
const WANT = ["A1", "A2", "B1", "B2", "C1", "C2"];
if (LEVELS.length !== 6) err("LEVELS", "expected 6 levels, found " + LEVELS.length);
LEVELS.forEach((l, i) => {
  if (l.id !== WANT[i]) err("LEVELS[" + i + "]", "expected " + WANT[i] + ", found " + l.id);
  ["tr", "en", "blurb"].forEach(k => { if (!str(l[k])) err("LEVELS " + l.id, "empty " + k); });
});

/* ---------- units ---------- */
if (UNITS.length !== 60) err("UNITS", "expected 60 units, found " + UNITS.length);

const seenId = new Set();
WANT.forEach(lv => {
  const us = UNITS.filter(u => u.lv === lv);
  if (us.length !== 10) err(lv, "expected 10 units, found " + us.length);
  /* unitsOf() filters UNITS in array order, so display order IS array order. */
  us.forEach((u, i) => {
    if (u.n !== i + 1) err(u.id, "n is " + u.n + " but the unit sits at position " + (i + 1) + " of " + lv);
    if (u.id !== lv.toLowerCase() + "u" + u.n) err(u.id, "id does not match " + lv.toLowerCase() + "u" + u.n);
  });
  const first = UNITS.findIndex(u => u.lv === lv);
  const last = UNITS.map(u => u.lv).lastIndexOf(lv);
  if (last - first !== us.length - 1) err(lv, "units of this level are not contiguous in UNITS");
});

UNITS.forEach(u => {
  const at = u.id || "unit?";
  if (seenId.has(u.id)) err(at, "duplicate unit id — ids are permanent and keyed to saved progress");
  seenId.add(u.id);
  if (!WANT.includes(u.lv)) err(at, "unknown level " + u.lv);
  ["tr", "en", "focus", "speak"].forEach(k => { if (!str(u[k])) err(at, "empty " + k); });

  /* vocabulary */
  if (!pairs(u.vocab)) err(at, "vocab must be [tr, en] string pairs");
  else {
    if (u.vocab.length !== 10) err(at, "expected 10 vocab pairs, found " + u.vocab.length);
    const tr = u.vocab.map(w => w[0]);
    tr.forEach((w, i) => { if (tr.indexOf(w) !== i) err(at, 'vocab repeats "' + w + '"'); });
    u.vocab.forEach(w => { if (TAGS.test(w[0]) || TAGS.test(w[1])) warn(at, 'vocab "' + w[0] + '" carries HTML, which is escaped on screen'); });
  }

  /* grammar */
  const g = u.gram || {};
  if (!str(g.t) || !str(g.en)) err(at, "gram needs both t and en");
  if (!Array.isArray(g.body) || !g.body.length || !g.body.every(str)) err(at, "gram.body must be a non-empty array of strings");
  if (g.tbl !== undefined) {
    if (!pairs(g.tbl)) err(at, "gram.tbl must be string pairs");
    else if (g.tbl.length < 4 || g.tbl.length > 6) warn(at, "gram.tbl has " + g.tbl.length + " rows (schema says 4–6)");
  }
  if (!pairs(g.eg)) err(at, "gram.eg must be [tr, en] string pairs");
  else {
    if (g.eg.length !== 3) warn(at, "gram.eg has " + g.eg.length + " examples (schema says 3)");
    g.eg.forEach(e => { if (TAGS.test(e[0]) || TAGS.test(e[1])) warn(at, "gram.eg carries HTML, which is escaped on screen"); });
  }

  /* reading */
  const r = u.read || {};
  ["t", "kind", "src"].forEach(k => { if (!str(r[k])) err(at, "read." + k + " is empty — every passage must declare what it is"); });
  if (!pairs(r.lines)) err(at, "read.lines must be [Turkish, English] string pairs");
  else {
    if (r.lines.length < 6 || r.lines.length > 10) warn(at, "read.lines has " + r.lines.length + " lines (schema says 6–10)");
    r.lines.forEach((ln, i) => {
      if (TAGS.test(ln[0]) || TAGS.test(ln[1])) warn(at, "read.lines[" + i + "] carries HTML, which is escaped on screen");
    });
  }
  if (r.gloss !== undefined) {
    const keys = Object.keys(r.gloss);
    if (!keys.length || !keys.every(k => str(k) && str(r.gloss[k]))) err(at, "read.gloss must map headwords to non-empty English");
    else if (keys.length < 4 || keys.length > 7) warn(at, "read.gloss has " + keys.length + " headwords (schema says 4–7)");
  }

  /* drills */
  if (!Array.isArray(u.drill) || u.drill.length !== 5) { err(at, "expected 5 drills, found " + (u.drill ? u.drill.length : 0)); return; }
  u.drill.forEach((d, i) => {
    const w = at + " drill[" + i + "]";
    if (!str(d.q)) err(w, "empty question");
    if (d.t === "mc") {
      if (!Array.isArray(d.a) || d.a.length < 2 || !d.a.every(str)) err(w, "mc needs at least two non-empty options");
      else {
        if (!Number.isInteger(d.c) || d.c < 0 || d.c >= d.a.length) err(w, "mc answer key c=" + d.c + " is outside a[0…" + (d.a.length - 1) + "]");
        d.a.forEach((o, j) => { if (d.a.indexOf(o) !== j) err(w, 'mc repeats the option "' + o + '"'); });
      }
      if (!str(d.why)) err(w, "mc needs why — it is shown on right answers too");
    } else if (d.t === "fill") {
      if (!d.q.includes("___")) err(w, "fill prompt has no ___ blank");
      if (!str(d.c)) err(w, "fill has no answer");
      else if (d.c.includes("___")) err(w, "fill answer is still the blank");
      if (!str(d.why)) err(w, "fill needs why");
    } else if (d.t === "order") {
      if (!Array.isArray(d.w) || d.w.length < 2 || !d.w.every(str)) err(w, "order needs at least two tiles");
      else if (!str(d.c)) err(w, "order has no target sentence");
      else if (fold(d.w.join(" ")) !== fold(d.c)) {
        err(w, "tiles do not build the answer\n      tiles → " + d.w.join(" ") + "\n      c     → " + d.c);
      }
    } else err(w, "unknown drill type " + JSON.stringify(d.t));
  });
});

/* ---------- placement ---------- */
if (!Array.isArray(PLACEMENT) || PLACEMENT.length !== 12) err("PLACEMENT", "expected 12 questions, found " + (PLACEMENT ? PLACEMENT.length : 0));
(PLACEMENT || []).forEach((p, i) => {
  const w = "PLACEMENT[" + i + "]";
  if (!WANT.includes(p.lv)) err(w, "unknown level " + p.lv);
  if (!str(p.q)) err(w, "empty question");
  if (!Array.isArray(p.a) || p.a.length < 2 || !p.a.every(str)) err(w, "needs at least two options");
  else if (!Number.isInteger(p.c) || p.c < 0 || p.c >= p.a.length) err(w, "answer key c=" + p.c + " is outside the options");
});
/* renderScore() walks LEVELS looking for a level answered perfectly, so
   every level needs questions of its own to be reachable. */
WANT.forEach(lv => { if (!(PLACEMENT || []).some(p => p.lv === lv)) err("PLACEMENT", "no question for " + lv); });

/* ---------- report ---------- */
const words = UNITS.reduce((n, u) => n + (u.vocab ? u.vocab.length : 0), 0);
const lines = UNITS.reduce((n, u) => n + (u.read && u.read.lines ? u.read.lines.length : 0), 0);
const drills = UNITS.reduce((n, u) => n + (u.drill ? u.drill.length : 0), 0);

warns.forEach(w => console.log("  warn  " + w));
if (errs.length) {
  errs.forEach(e => console.error("  ERROR " + e));
  console.error("\nvalidate: " + errs.length + " error" + (errs.length > 1 ? "s" : ""));
  process.exit(1);
}
console.log("validate ok · " + UNITS.length + " units · " + words + " words · " + lines +
  " graded lines · " + drills + " drills · " + PLACEMENT.length + " placement questions" +
  (warns.length ? " · " + warns.length + " warning" + (warns.length > 1 ? "s" : "") : ""));
