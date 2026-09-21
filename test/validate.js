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

/* src/app.lang.js is pure — no DOM, no state — so the whole language
   engine can be lifted out of the build and exercised here against a
   table of hand-checked forms. It runs from its own banner to the first
   screen. */
const mStart = code.indexOf("/* ===================== biçimbilim");
const mEnd = code.indexOf("/* ===================== home");
if (mStart < 0 || mEnd < 0) { console.error("validate: cannot find the morphology engine in the build"); process.exit(1); }
const engine = code.slice(mStart, mEnd);

const sandbox = {};
try {
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, cut) + "\n" + foldSrc[0] + "\n" + engine +
    "\nthis.OUT={LEVELS:LEVELS,UNITS:UNITS,PLACEMENT:PLACEMENT,CHUNKS:CHUNKS,LEX:LEX,POS:POS,fold:fold," +
    "nAcc:nAcc,nDat:nDat,nLoc:nLoc,nAbl:nAbl,nGen:nGen,nP1:nP1,nP3:nP3,nPlur:nPlur,conj:conj};", sandbox, { filename: file });
} catch (e) {
  console.error("validate: the data does not evaluate — " + e.message);
  process.exit(1);
}
const { LEVELS, UNITS, PLACEMENT, CHUNKS, LEX, POS, fold } = sandbox.OUT;
const M = sandbox.OUT;

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

/* ---------- word classes ---------- */
/* POS only needs to list what cannot be derived, so a key that is not a
   word the course teaches is a typo — and a typo here silently files a
   word under the wrong heading for ever. */
const taught = new Map();
UNITS.forEach(u => u.vocab.forEach(w => { if (!taught.has(w[0])) taught.set(w[0], w[1]); }));
const CLASSES = ["n", "s", "z", "e", "i"];
Object.keys(POS || {}).forEach(k => {
  if (!taught.has(k)) err("POS", '"' + k + '" is classified but the course never teaches it');
  if (!CLASSES.includes(POS[k])) err("POS", '"' + k + '" has unknown class ' + JSON.stringify(POS[k]));
  if (/(mak|mek)$/.test(k.trim())) err("POS", '"' + k + '" is an infinitive — verbs classify themselves');
  /* Multiword entries SHOULD be listed: "hafta sonu" is a noun and
     "ara sıra" an adverb, and the space says neither. */
});
const wordClass = t => /(mak|mek)$/.test(t.trim()) ? "f" : (POS[t] || (/\s/.test(t.trim()) ? "i" : "n"));
const classCount = {};
taught.forEach((en, t) => { const c = wordClass(t); classCount[c] = (classCount[c] || 0) + 1; });
if ((classCount.f || 0) < 80) err("POS", "only " + classCount.f + " verbs found — the -mak/-mek test is not working");
if ((classCount.n || 0) < 100) err("POS", "only " + classCount.n + " nouns — the default is not being applied");

/* ---------- chunk bank (üretim) ---------- */
if (!Array.isArray(CHUNKS) || CHUNKS.length < 40) err("CHUNKS", "expected a bank of ~50 prefabs, found " + (CHUNKS ? CHUNKS.length : 0));
else {
  if (!pairs(CHUNKS)) err("CHUNKS", "must be [Turkish, English] string pairs");
  else {
    const tr = CHUNKS.map(c => c[0]);
    tr.forEach((t, i) => {
      const w = "CHUNKS[" + i + "]";
      if (tr.indexOf(t) !== i) err(w, 'repeats "' + t + '"');
      if (TAGS.test(t) || TAGS.test(CHUNKS[i][1])) warn(w, "carries HTML, which is escaped on screen");
      /* These are prefabs to be said whole, not sentences to parse. */
      if (t.split(/\s+/).length > 6) warn(w, '"' + t + '" is ' + t.split(/\s+/).length + " words — long for a prefab");
    });
  }
}

/* ---------- morphology: the golden set ---------- */
/* Every form below was checked by hand. The engine is allowed to be
   clever; it is not allowed to disagree with this table. Adding a word
   to LEX means adding its awkward forms here. */
const NOUN_GOLD = [
  /* stem, acc, dat, loc, abl, gen, poss1, poss3, plural */
  ["kitap", "kitabı", "kitaba", "kitapta", "kitaptan", "kitabın", "kitabım", "kitabı", "kitaplar"],
  ["ev", "evi", "eve", "evde", "evden", "evin", "evim", "evi", "evler"],
  ["araba", "arabayı", "arabaya", "arabada", "arabadan", "arabanın", "arabam", "arabası", "arabalar"],
  ["çocuk", "çocuğu", "çocuğa", "çocukta", "çocuktan", "çocuğun", "çocuğum", "çocuğu", "çocuklar"],
  ["şehir", "şehri", "şehre", "şehirde", "şehirden", "şehrin", "şehrim", "şehri", "şehirler"],
  ["burun", "burnu", "burna", "burunda", "burundan", "burnun", "burnum", "burnu", "burunlar"],
  ["isim", "ismi", "isme", "isimde", "isimden", "ismin", "ismim", "ismi", "isimler"],
  ["renk", "rengi", "renge", "renkte", "renkten", "rengin", "rengim", "rengi", "renkler"],
  ["top", "topu", "topa", "topta", "toptan", "topun", "topum", "topu", "toplar"],
  ["su", "suyu", "suya", "suda", "sudan", "suyun", "suyum", "suyu", "sular"],
  ["kalp", "kalbi", "kalbe", "kalpte", "kalpten", "kalbin", "kalbim", "kalbi", "kalpler"],
  ["saat", "saati", "saate", "saatte", "saatten", "saatin", "saatim", "saati", "saatler"],
  ["göz", "gözü", "göze", "gözde", "gözden", "gözün", "gözüm", "gözü", "gözler"],
  ["gece", "geceyi", "geceye", "gecede", "geceden", "gecenin", "gecem", "gecesi", "geceler"],
  ["kapı", "kapıyı", "kapıya", "kapıda", "kapıdan", "kapının", "kapım", "kapısı", "kapılar"],
  ["uçak", "uçağı", "uçağa", "uçakta", "uçaktan", "uçağın", "uçağım", "uçağı", "uçaklar"]
];
const VERB_GOLD = [
  /* infinitive, prog.1sg, past.1sg, fut.1sg, aor.1sg, prog.3sg, aor.3sg */
  ["gelmek", "geliyorum", "geldim", "geleceğim", "gelirim", "geliyor", "gelir"],
  ["gitmek", "gidiyorum", "gittim", "gideceğim", "giderim", "gidiyor", "gider"],
  ["okumak", "okuyorum", "okudum", "okuyacağım", "okurum", "okuyor", "okur"],
  ["beklemek", "bekliyorum", "bekledim", "bekleyeceğim", "beklerim", "bekliyor", "bekler"],
  ["yapmak", "yapıyorum", "yaptım", "yapacağım", "yaparım", "yapıyor", "yapar"],
  ["yemek", "yiyorum", "yedim", "yiyeceğim", "yerim", "yiyor", "yer"],
  ["demek", "diyorum", "dedim", "diyeceğim", "derim", "diyor", "der"],
  ["etmek", "ediyorum", "ettim", "edeceğim", "ederim", "ediyor", "eder"],
  ["almak", "alıyorum", "aldım", "alacağım", "alırım", "alıyor", "alır"],
  ["görmek", "görüyorum", "gördüm", "göreceğim", "görürüm", "görüyor", "görür"],
  ["uyumak", "uyuyorum", "uyudum", "uyuyacağım", "uyurum", "uyuyor", "uyur"],
  ["başlamak", "başlıyorum", "başladım", "başlayacağım", "başlarım", "başlıyor", "başlar"],
  ["konuşmak", "konuşuyorum", "konuştum", "konuşacağım", "konuşurum", "konuşuyor", "konuşur"],
  ["açmak", "açıyorum", "açtım", "açacağım", "açarım", "açıyor", "açar"],
  ["kalkmak", "kalkıyorum", "kalktım", "kalkacağım", "kalkarım", "kalkıyor", "kalkar"],
  ["oturmak", "oturuyorum", "oturdum", "oturacağım", "otururum", "oturuyor", "oturur"],
  ["yürümek", "yürüyorum", "yürüdüm", "yürüyeceğim", "yürürüm", "yürüyor", "yürür"],
  ["unutmak", "unutuyorum", "unuttum", "unutacağım", "unuturum", "unutuyor", "unutur"],
  ["içmek", "içiyorum", "içtim", "içeceğim", "içerim", "içiyor", "içer"],
  ["satmak", "satıyorum", "sattım", "satacağım", "satarım", "satıyor", "satar"]
];
/* The negative, where Turkish stops being tidy: the aorist loses its r
   in the first person and turns into -mez elsewhere. */
const NEG_GOLD = [
  ["gelmek", "prog", 0, "gelmiyorum"], ["okumak", "prog", 0, "okumuyorum"],
  ["gelmek", "past", 0, "gelmedim"],   ["gelmek", "fut", 0, "gelmeyeceğim"],
  ["gelmek", "aor", 0, "gelmem"],      ["gelmek", "aor", 1, "gelmezsin"],
  ["gelmek", "aor", 3, "gelmeyiz"],    ["okumak", "aor", 3, "okumayız"],
  ["okumak", "fut", 0, "okumayacağım"],["gitmek", "prog", 0, "gitmiyorum"]
];
const PERSON_GOLD = [
  ["gelmek", "prog", 1, "geliyorsun"], ["gelmek", "prog", 3, "geliyoruz"],
  ["gelmek", "prog", 4, "geliyorsunuz"], ["gelmek", "prog", 5, "geliyorlar"],
  ["gelmek", "fut", 3, "geleceğiz"], ["okumak", "fut", 2, "okuyacak"],
  ["gitmek", "past", 3, "gittik"], ["gelmek", "past", 4, "geldiniz"]
];

let mChecked = 0;
if (!Array.isArray(LEX) || !LEX.length) err("LEX", "the drill lexicon is empty");
else {
  const find = t => LEX.find(x => x.t === t);
  const cell = (t, fn, want, what) => {
    const e = find(t);
    if (!e) { err("LEX", t + " is in the golden set but not in the lexicon"); return; }
    mChecked++;
    const got = M[fn](e);
    if (got !== want) err("morphology", t + " " + what + ': generated "' + got + '", hand-checked form is "' + want + '"');
  };
  NOUN_GOLD.forEach(r => {
    ["nAcc", "nDat", "nLoc", "nAbl", "nGen", "nP1", "nP3", "nPlur"].forEach((fn, i) => cell(r[0], fn, r[i + 1], fn.slice(1).toLowerCase()));
  });
  const vcell = (t, tense, p, neg, want) => {
    const e = find(t);
    if (!e) { err("LEX", t + " is in the golden set but not in the lexicon"); return; }
    mChecked++;
    const got = M.conj(e, tense, p, neg);
    if (got !== want) err("morphology", t + " " + tense + "." + p + (neg ? ".neg" : "") + ': generated "' + got + '", hand-checked form is "' + want + '"');
  };
  VERB_GOLD.forEach(r => {
    vcell(r[0], "prog", 0, false, r[1]); vcell(r[0], "past", 0, false, r[2]);
    vcell(r[0], "fut", 0, false, r[3]);  vcell(r[0], "aor", 0, false, r[4]);
    vcell(r[0], "prog", 2, false, r[5]); vcell(r[0], "aor", 2, false, r[6]);
  });
  NEG_GOLD.forEach(r => vcell(r[0], r[1], r[2], true, r[3]));
  PERSON_GOLD.forEach(r => vcell(r[0], r[1], r[2], false, r[3]));

  /* Collocations must point at nouns that exist, or a frame will build a
     sentence around a word the app has never heard of. */
  const nouns = new Set(LEX.filter(e => e.p === "n").map(e => e.t));
  LEX.forEach(e => {
    ["obj", "dat", "loc", "n"].forEach(k => {
      if (!e[k]) return;
      if (!Array.isArray(e[k]) || !e[k].length) { err("LEX " + e.t, k + " must be a non-empty list"); return; }
      e[k].forEach(w => { if (!nouns.has(w)) err("LEX " + e.t, k + ' names "' + w + '", which is not a noun in the lexicon'); });
    });
    if (e.p === "v" && !e.aux && (!Array.isArray(e.e) || e.e.length !== 4 || !e.e.every(str)))
      err("LEX " + e.t, "a drillable verb needs English [base, -ing, past, he-form]");
    if (e.p === "a" && (!Array.isArray(e.n) || !e.n.length))
      err("LEX " + e.t, "an adjective needs the nouns it can describe");
  });

  /* Nothing generated may come out with a stray marker or empty. */
  LEX.forEach(e => {
    if (!["n", "v", "a"].includes(e.p)) err("LEX " + e.t, "unknown part of speech " + JSON.stringify(e.p));
    if (!str(e.en)) err("LEX " + e.t, "no English gloss");
    if (e.p === "v" && !/(mak|mek)$/.test(e.t)) err("LEX " + e.t, "a verb must be listed as an infinitive");
    if (e.p === "n") {
      ["nAcc", "nDat", "nLoc", "nAbl", "nGen"].forEach(fn => {
        const g = M[fn](e);
        if (!g || /undefined|NaN/.test(g) || g === e.t) err("LEX " + e.t, fn + " produced " + JSON.stringify(g));
      });
    }
    if (e.p === "v") {
      ["prog", "past", "fut", "aor"].forEach(t => [0, 2].forEach(p => [false, true].forEach(n => {
        const g = M.conj(e, t, p, n);
        if (!g || /undefined|NaN/.test(g)) err("LEX " + e.t, t + " produced " + JSON.stringify(g));
      })));
    }
  });
}

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
  " graded lines · " + drills + " drills · " + PLACEMENT.length + " placement questions · " +
  CHUNKS.length + " chunks · " + (lines + CHUNKS.length) + " üretim prompts · " +
  LEX.length + " drill stems · " + mChecked + " hand-checked forms · " +
  taught.size + " distinct words in " + Object.keys(classCount).length + " classes" +
  (warns.length ? " · " + warns.length + " warning" + (warns.length > 1 ? "s" : "") : ""));
