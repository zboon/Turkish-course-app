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
let dChecked = 0;
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

/* The number engine is pure in exactly the same way, up to the point where
   a sitting is assembled and it starts needing S — so the forms half is
   lifted out and hand-checked here, and the behaviour half (the clock, the
   judge, the screens) is exercised in sim.js against a real state. */
/* DIA_REPAIR lives in the app half, but what it has to agree with — the
   chunk bank — lives in the data half, so it is lifted out on its own. */
const repSrc = /const DIA_REPAIR=\[[\s\S]*?\n\];/.exec(code);
if (!repSrc) { console.error("validate: cannot find DIA_REPAIR in the build"); process.exit(1); }

const nStart = code.indexOf("/* ===================== sayılar");
const nEnd = code.indexOf("/* --- what a sitting is made of ---");
if (nStart < 0 || nEnd < 0) { console.error("validate: cannot find the number engine in the build"); process.exit(1); }
const numbers = code.slice(nStart, nEnd);

const sandbox = {};
try {
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, cut) + "\n" + foldSrc[0] + "\n" + engine + "\n" + numbers + "\n" + repSrc[0] +
    "\nthis.OUT={LEVELS:LEVELS,UNITS:UNITS,PLACEMENT:PLACEMENT,CHUNKS:CHUNKS,LEX:LEX,POS:POS,CORE:CORE,fold:fold," +
    "nAcc:nAcc,nDat:nDat,nLoc:nLoc,nAbl:nAbl,nGen:nGen,nP1:nP1,nP3:nP3,nPlur:nPlur,conj:conj," +
    "dictScore:dictScore,dictPass:dictPass,DICT_PASS:DICT_PASS," +
    "numText:numText,hourAcc:hourAcc,hourDat:hourDat,timeText:timeText,timeAt:timeAt,priceText:priceText," +
    "parsePlain:parsePlain,parseTime:parseTime,parsePrice:parsePrice," +
    "MONTHS:MONTHS,WEEKDAYS:WEEKDAYS,dateWords:dateWords,dateDigits:dateDigits," +
    "DIYALOG:DIYALOG,DIA_REPAIR:DIA_REPAIR,ATASOZU:ATASOZU,DEYIM:DEYIM,SIK:SIK," +
    "diagnose:diagnose,diagnoseLine:diagnoseLine,diagAny:diagAny," +
    "SPOKEN:SPOKEN,spokenForms:spokenForms,spokenToward:spokenToward," +
    "spokenOf:spokenOf,pronounSlack:pronounSlack,shortOf:shortOf};", sandbox, { filename: file });
} catch (e) {
  console.error("validate: the data does not evaluate — " + e.message);
  process.exit(1);
}
const { LEVELS, UNITS, PLACEMENT, CHUNKS, LEX, POS, CORE, fold } = sandbox.OUT;
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
    } else if (d.t === "fill") {
      if (!d.q.includes("___")) err(w, "fill prompt has no ___ blank");
      if (!str(d.c)) err(w, "fill has no answer");
      else if (d.c.includes("___")) err(w, "fill answer is still the blank");
    } else if (d.t === "order") {
      if (!Array.isArray(d.w) || d.w.length < 2 || !d.w.every(str)) err(w, "order needs at least two tiles");
      else if (!str(d.c)) err(w, "order has no target sentence");
      else if (fold(d.w.join(" ")) !== fold(d.c)) {
        err(w, "tiles do not build the answer\n      tiles → " + d.w.join(" ") + "\n      c     → " + d.c);
      }
    } else err(w, "unknown drill type " + JSON.stringify(d.t));
    /* The why is the explanation a learner gets after every answer, right
       or wrong, and it is the only grammar feedback the quiz gives. It
       used to be optional on sentence-building items (sixty had none) and
       half of the rest were under 33 characters — "Last vowel e → -ler."
       names a rule without applying it. Fifty characters is roughly the
       least that can name the rule and apply it to this question's words. */
    if (!str(d.why)) err(w, d.t + " needs why — it is the only explanation the learner gets");
    else {
      if (d.why.trim().length < 50) err(w, "why is " + d.why.trim().length + " characters — say which rule applies and how, not just the answer");
      if (/!/.test(d.why)) err(w, "why has an exclamation mark — house style is plain, not cheerleading");
    }
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

/* ---------- çekirdek (the core word list) ---------- */
/* Additive by construction: a core word that the course already teaches
   is not extra vocabulary, it is a duplicate row in the word list. */
if (!Array.isArray(CORE) || CORE.length < 200) err("CORE", "expected a few hundred core words, found " + (CORE ? CORE.length : 0));
else {
  const seenCore = new Set();
  CORE.forEach((e, i) => {
    const at = "CORE[" + i + "]" + (e.t ? ' "' + e.t + '"' : "");
    if (!str(e.t) || !str(e.en) || !str(e.k)) { err(at, "needs t, en and k"); return; }
    const key = e.t.toLocaleLowerCase("tr");
    if (seenCore.has(key)) err(at, "appears twice in the core list");
    seenCore.add(key);
    if (taught.has(e.t)) err(at, "is already taught in the course — the core list is meant to add words, not repeat them");
    if (e.c !== undefined && !["s", "z", "e", "i"].includes(e.c)) err(at, "unknown class " + JSON.stringify(e.c));
    if (e.c && /(mak|mek)$/.test(e.t.trim())) err(at, "is an infinitive — verbs classify themselves");
    /* A stray soft hyphen or zero-width space is invisible on screen and
       breaks every match it touches. */
    if (/[\u00ad\u200b-\u200d\ufeff]/.test(e.t) || /[\u00ad\u200b-\u200d\ufeff]/.test(e.en))
      err(at, "contains an invisible character (soft hyphen or zero-width space)");
    if (TAGS.test(e.t) || TAGS.test(e.en)) warn(at, "carries HTML, which is escaped on screen");
  });
  const topics = [...new Set(CORE.map(e => e.k))];
  if (topics.length < 5) err("CORE", "only " + topics.length + " topics — the list is meant to be grouped");
  topics.forEach(k => { if (CORE.filter(e => e.k === k).length < 5) warn("CORE", 'topic "' + k + '" has very few words'); });
}

/* ---------- teşhis (naming a mistake) ---------- */
/* diagnose() names the rule behind a wrong typed form, and only when one
   rule turns what was typed into what was right. A wrong diagnosis looks
   exactly like a right one to a learner, so the table holds both halves:
   every rule it should name, and the misses it must NOT explain — an
   unrelated word, a missed accusative (ambiguous with the possessive), a
   loanword that breaks harmony, two mistakes at once. */
let diagChecked = 0;
{
  const D = M.diagnose;
  [["okulde", "okulda", "uyum"], ["pencerelar", "pencereler", "uyum"], ["kapıyu", "kapıyı", "uyum"],
   ["evimuz", "evimiz", "uyum"], ["Evlar", "Evler", "uyum"],
   ["kitapı", "kitabı", "yumusama"], ["gitiyorum", "gidiyorum", "yumusama"], ["renki", "rengi", "yumusama"],
   ["kitabta", "kitapta", "yumusama"],
   ["gitdim", "gittim", "dt"], ["sokakda", "sokakta", "dt"], ["okulta", "okulda", "dt"], ["yaptığım", "yaptığım", null],
   ["arabaı", "arabayı", "kaynastirma"], ["öğrenciim", "öğrenciyim", "kaynastirma"], ["kapıın", "kapının", "kaynastirma"],
   ["evyi", "evi", "kaynastirma"],
   ["okulda", "okula", "hal"], ["eve", "evde", "hal"], ["ev", "eve", "hal"], ["masa", "masada", "hal"],
   ["Ankarada", "Ankara'dan", "hal"], ["okuldan", "okulda", "hal"],
   ["aile", "ailem", "ek"], ["kitap", "kitabım", "ek"], ["kalem", "kalemler", "ek"],
   /* must stay silent */
   ["kedi", "köpek", null], ["gitti", "geldi", null], ["okula", "okulu", null], ["geldim", "gelmedim", null],
   ["saatda", "saatte", null], ["saatta", "saatte", null], ["ağaçı", "ağacı", null], ["kitabi", "kitabı", null],
   ["", "okul", null], ["okul", "", null], ["evler", "ev", null]
  ].forEach(([t, c, want]) => {
    diagChecked++;
    const d = D(t, c), got = d ? d.k : null;
    if (got !== want) err("teşhis", JSON.stringify(t) + " for " + JSON.stringify(c) + " is diagnosed " + JSON.stringify(got) + ", hand-checked answer is " + JSON.stringify(want));
    else if (d && (!d.t || /undefined|NaN/.test(d.t))) err("teşhis", JSON.stringify(t) + " → " + JSON.stringify(c) + " produced a broken message: " + d.t);
  });
  /* The answer is shown as written, not as the lower-case letters the
     rule was worked out on. */
  const shown = D("Ankarada", "Ankara'dan");
  diagChecked++;
  if (!shown || shown.t.indexOf("Ankara'dan") < 0) err("teşhis", "the answer is not shown as written: " + (shown && shown.t));
  /* A saatte that harmony does not predict must not be explained by it. */
  diagChecked++;
  if (D("saatla", "saatle")) err("teşhis", "saat breaks harmony, and the rule was applied to it anyway");
  /* Sentences: each missed word paired with the typed word nearest it. */
  [["Okulda çalışıyorum.", "Okulde çalışıyorum", ["uyum"]],
   ["Kitabı okudum.", "Kitapı okudum", ["yumusama"]],
   ["Eve gidiyorum.", "Evde gidiyorum", ["hal"]],
   ["Eve gidiyorum.", "Eve gidiyorum", []],
   ["Eve gidiyorum.", "Okula gittim", []]
  ].forEach(([model, typed, want]) => {
    diagChecked++;
    const got = M.diagnoseLine(model, typed, 2).map(d => d.k);
    if (got.join() !== want.join()) err("teşhis", JSON.stringify(typed) + " against " + JSON.stringify(model) + " gives [" + got + "], expected [" + want + "]");
  });
  /* Alternatives and phrases, as Tekrar's answers come. */
  diagChecked++;
  if (M.diagAny("kedi", "ad / isim")) err("teşhis", "an unrelated word was diagnosed against an alternative");
  diagChecked++;
  if (!M.diagAny("okulde", "ad / okulda")) err("teşhis", "the second alternative of an answer was never tried");
  /* Every written word in every passage, against itself: nothing to name. */
  UNITS.forEach(u => u.read.lines.forEach(l => l[0].split(/\s+/).forEach(w => {
    diagChecked++;
    if (w && D(w, w)) err("teşhis", u.id + ": " + JSON.stringify(w) + " is diagnosed against itself");
  })));
}

/* ---------- konuşma dili (spoken forms) ---------- */
/* A typed spoken spelling is taken as the written word it renders — and
   only toward the answer's own words, so nothing here can make a wrong
   word right. Both halves are held: every form it should accept, and the
   near misses it must not (a different tense, a different person, a
   different word that happens to share a stem). */
let spokenChecked = 0;
{
  const T = (t, a) => M.spokenToward(t, a);
  [["Gidicem.", "Gideceğim."], ["yapıcam", "yapacağım"], ["görücem", "göreceğim"], ["olucam", "olacağım"],
   ["gelmicem", "gelmeyeceğim"], ["yapmıcam", "yapmayacağım"], ["gidicek", "gidecek"], ["gidicez", "gideceğiz"],
   ["gidicen", "gideceksin"], ["gidiceksin", "gideceksin"],
   ["geliyom", "geliyorum"], ["geliyosun", "geliyorsun"], ["geliyon", "geliyorsun"], ["geliyo", "geliyor"],
   ["geliyoz", "geliyoruz"], ["geliyodum", "geliyordum"], ["okuyo", "okuyor"],
   ["Bu bi kitap", "Bu bir kitap."], ["bişey", "bir şey"], ["hiçbişey", "hiçbir şey"], ["Napıyorsun?", "Ne yapıyorsun?"],
   ["napıyosun", "ne yapıyorsun"], ["n'oldu", "ne oldu"], ["napcan", "ne yapacaksın"], ["burda", "burada"],
   ["nerde", "nerede"], ["bi dakka", "bir dakika"], ["senle", "seninle"], ["Buyrun", "Buyurun"],
   ["Öğretmen di mi", "Öğretmen, değil mi?"], ["Yarın gidicem", "Yarın gideceğim."],
   ["bişeyi", "bir şeyi"], ["hiçbişeyi", "hiçbir şeyi"], ["bişeyler", "bir şeyler"],
   /* vowel stems, as a native speaker wrote them */
   ["okuycam", "okuyacağım"], ["bekliycem", "bekleyeceğim"], ["beklicem", "bekleyeceğim"],
   ["söyliycem", "söyleyeceğim"], ["söylicem", "söyleyeceğim"], ["yiycem", "yiyeceğim"],
   ["başlıcaz", "başlayacağız"]
  ].forEach(([t, a]) => {
    spokenChecked++;
    const r = T(t, a);
    if (r.text !== M.fold(a) || !r.used.length)
      err("konuşma", JSON.stringify(t) + " should be accepted for " + JSON.stringify(a) + ", got " + JSON.stringify(r));
  });
  /* Must stay wrong. */
  [["gidicem", "gittim"], ["gidicem", "gideceksin"], ["gidiyom", "gidiyorsun"], ["geliyo", "gelir"],
   ["bi", "bu"], ["di", "dün"], ["burda", "burası"], ["okuyucam", "okuyacağım"], ["kicak", "kaçak"],
   ["yorgun", "yorgun"], ["gidicem", "gidecek"], ["yapıcam", "gideceğim"], ["senle", "benimle"],
   ["bekliycem", "bekleyeceksin"], ["okuycam", "okuyacak"], ["yiycem", "yiyeceğiz"]
  ].forEach(([t, a]) => {
    spokenChecked++;
    const r = T(t, a);
    if (r.text === M.fold(a) && r.used.length)
      err("konuşma", JSON.stringify(t) + " was accepted for " + JSON.stringify(a) + " — it is not a spoken form of it");
  });
  /* A word that is already right is not a spoken form of itself. */
  spokenChecked++;
  if (T("gideceğim", "gideceğim").used.length) err("konuşma", "a correct word was reported as a spoken form");
  /* -Iyor follows a vowel, so a word that merely starts with yor is left alone. */
  spokenChecked++;
  if (M.spokenForms("yorgun").length) err("konuşma", "yorgun was given a spoken form");

  /* The notes. Every one names a real unit, says who it is for, and
     explains itself; and a note that claims to be a respelling must be
     one the judge accepts, or the screen teaches a form the marking
     then refuses. */
  const unitIds = new Set(UNITS.map(u => u.id));
  Object.keys(M.SPOKEN).forEach(id => {
    if (!unitIds.has(id)) err("SPOKEN." + id, "is not a unit id");
    const ns = M.SPOKEN[id];
    if (!Array.isArray(ns) || !ns.length) { err("SPOKEN." + id, "has no notes"); return; }
    ns.forEach((x, i) => {
      spokenChecked++;
      const w = "SPOKEN." + id + "[" + i + "]";
      if (!str(x.w) || !str(x.s) || !str(x.n)) { err(w, "needs w, s and n"); return; }
      if (x.r !== "herkes" && x.r !== "samimi") err(w, "register is " + JSON.stringify(x.r) + ", not herkes or samimi");
      if (x.w === x.s) err(w, "the spoken form is the written one");
      if (x.n.trim().length < 40) err(w, "note is " + x.n.trim().length + " characters — say what changes and when");
      if (/!/.test(x.n + x.w + x.s)) err(w, "has an exclamation mark — house style");
      if (x.re) {
        const r = T(x.s, x.w);
        if (r.text !== M.fold(x.w) || !r.used.length)
          err(w, JSON.stringify(x.s) + " is marked as a respelling of " + JSON.stringify(x.w) + " but the judge would refuse it");
      }
    });
  });
}

/* ---------- başka türlü (the other ways to say it) ---------- */
/* After an answer the app offers the other ways to say it: the spoken
   form, the form without the pronoun. An alternative the app offers and
   then marks wrong would be worse than none, so every one it can offer
   anywhere in A1–B2 is run back through the judge here. */
let altChecked = 0;
{
  [["Yarın İstanbul'a gideceğim.", "Yarın İstanbul'a gidicem."], ["Ne yapıyorsun?", "Napıyorsun?"],
   ["Bu bir defter.", "Bu bi defter."], ["Hiçbir şey görmedim.", "Hiçbişey görmedim."], ["Ne oldu?", "N'oldu?"],
   ["Göreceğiz.", "Görücez."], ["Gelmeyeceğim.", "Gelmicem."], ["Kalacaksın.", "Kalıcaksın."],
   ["Türkçe öğreniyorum.", null], ["Okuyacağım.", null], ["Bu kitap benim.", null], ["Saat beşte.", null],
   ["Bir şeyi unuttum.", "Bişeyi unuttum."], ["Kazanılan bir şeymiş.", "Kazanılan bişeymiş."],
   ["Gelecek ay geleceğim.", "Gelecek ay gelicem."], ["Yarın gidecek.", null], ["Bir şeker.", "Bi şeker."]
  ].forEach(([w, want]) => {
    altChecked++;
    const got = M.spokenOf(w);
    if (got !== want) err("başka türlü", "spokenOf(" + JSON.stringify(w) + ") is " + JSON.stringify(got) + ", hand-checked " + JSON.stringify(want));
  });
  [["Benim adım Deniz.", "Adım Deniz", "drop"], ["Ben Türküm.", "Türküm", "drop"], ["Sen iyisin.", "İyisin", "drop"],
   ["Türkçe öğreniyorum.", "Ben Türkçe öğreniyorum", "add"], ["Adım Deniz.", "Benim adım Deniz", "add"],
   ["Gidiyoruz.", "Biz gidiyoruz", "add"], ["Geliyor musunuz?", "Siz geliyor musunuz", "add"],
   /* must stay wrong */
   ["Türkçe öğreniyorum.", "Sen Türkçe öğreniyorum", null], ["Gidiyoruz.", "Siz gidiyoruz", null],
   ["Ben de iyiyim.", "De iyiyim", null], ["Bu kitap benim.", "Bu kitap", null], ["O çalışmıyor.", "Çalışmıyor", null],
   ["Onlar geldi.", "Geldi", null], ["Adım Deniz.", "Senin adım Deniz", null], ["Ben Türküm.", "Ben", null],
   ["Benim adım Deniz.", "Adım", null], ["Bu hediye senin için.", "Bu hediye için", null],
   ["Ben çıkarken o giriyordu.", "Çıkarken o giriyordu", null], ["Benim iki kardeşim var.", "İki kardeşim var", "drop"],
   /* an answer that is only a pronoun: dropping it leaves nothing */
   ["Sen.", "", null], ["Onlar.", "", null]
  ].forEach(([m, t, want]) => {
    altChecked++;
    const r = M.pronounSlack(m, t), got = r ? r.k : null;
    if (got !== want) err("başka türlü", JSON.stringify(t) + " against " + JSON.stringify(m) + " gives " + JSON.stringify(got) + ", hand-checked " + JSON.stringify(want));
  });
  [["Benim adım Deniz.", "Adım Deniz."], ["Ben Türküm.", "Türküm."], ["Ben de iyiyim.", null], ["Bu kitap benim.", null], ["Bu hediye senin için.", null],
   ["Ben çıkarken o giriyordu.", null], ["Benim iki kardeşim var.", "İki kardeşim var."], ["Sen.", null],
   ["O öğretmen değil.", null]].forEach(([m, want]) => {
    altChecked++;
    if (M.shortOf(m) !== want) err("başka türlü", "shortOf(" + JSON.stringify(m) + ") is " + JSON.stringify(M.shortOf(m)) + ", hand-checked " + JSON.stringify(want));
  });
  /* The sweep: everything the app can offer, back through the judge. */
  const early = UNITS.filter(u => ["A1", "A2", "B1", "B2"].includes(u.lv));
  const texts = [];
  early.forEach(u => {
    u.gram.eg.forEach(e => texts.push([u.id + " eg", e[0]]));
    u.read.lines.forEach(l => texts.push([u.id + " line", l[0]]));
    u.vocab.forEach(v => texts.push([u.id + " vocab", v[0]]));
  });
  texts.forEach(([where, x]) => {
    const sp = M.spokenOf(x);
    if (sp !== null) {
      altChecked++;
      const r = M.spokenToward(sp, x);
      if (r.text !== M.fold(x)) err("başka türlü", where + ": offers " + JSON.stringify(sp) + " for " + JSON.stringify(x) + " and the judge refuses it");
    }
  });
  UNITS.forEach(u => u.gram.eg.forEach(e => {
    const sh = M.shortOf(e[0]);
    if (sh === null) return;
    altChecked++;
    const r = M.pronounSlack(e[0], sh);
    if (!r || r.k !== "drop") err("başka türlü", u.id + ": offers " + JSON.stringify(sh) + " as the short form of " + JSON.stringify(e[0]) + " and the judge refuses it");
  }));
}

/* ---------- sık kelimeler (the frequency layer) ---------- */
/* The commonest spoken words the units never teach, in the order a
   learner meets them. Additive by the same rule CORE is — and it has to
   be checked against CORE as well as the course, because the two lists
   were written at different times by the same hand. Progress is keyed by
   the word, so a duplicate would be one record serving two rows. */
const SIK = M.SIK;
let sikChecked = 0;
if (!Array.isArray(SIK) || SIK.length < 1000) err("SIK", "expected a thousand or more frequent words, found " + (SIK ? SIK.length : 0));
else {
  const seenSik = new Set();
  const coreSet = new Set((CORE || []).map(e => e.t.toLocaleLowerCase("tr")));
  const NUMW = /^(bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|yirmi|otuz|kırk|elli|altmış|yetmiş|seksen|doksan|yüz|bin|milyon|milyar)$/;
  SIK.forEach((e, i) => {
    sikChecked++;
    const at = "SIK[" + i + "]" + (Array.isArray(e) && e[0] ? ' "' + e[0] + '"' : "");
    if (!Array.isArray(e) || e.length < 2 || e.length > 3 || !str(e[0]) || !str(e[1])) { err(at, "must be [word, gloss] or [word, gloss, class]"); return; }
    const [t, en, c] = e;
    if (t !== t.trim() || / {2}/.test(t)) err(at, "has stray spaces");
    if (t !== t.toLocaleLowerCase("tr")) err(at, "headwords are lower case, as a dictionary prints them");
    if (seenSik.has(t)) err(at, "appears twice");
    seenSik.add(t);
    if (taught.has(t)) err(at, "is already taught in the course — this list only adds");
    if (coreSet.has(t)) err(at, "is already in CORE");
    if (NUMW.test(t)) err(at, "is a number — numbers belong to Sayılar, which drills them against a clock");
    if (c !== undefined && !["s", "z", "e", "i"].includes(c)) err(at, "unknown class " + JSON.stringify(c));
    if (c && /(mak|mek)$/.test(t)) err(at, "is an infinitive — verbs classify themselves");
    if (/[\u00ad\u200b-\u200d\ufeff]/.test(t) || /[\u00ad\u200b-\u200d\ufeff]/.test(en))
      err(at, "contains an invisible character (soft hyphen or zero-width space)");
    if (TAGS.test(t) || TAGS.test(en)) err(at, "carries HTML, which would be escaped on screen");
  });
  /* The words that made the case for this list. If an edit ever drops one,
     the list has stopped doing the job it was built for. */
  ["çünkü", "zaten", "lazım", "aslında", "kendi", "bütün", "diğer", "bazı", "veya", "umarım"].forEach(w => {
    if (!seenSik.has(w)) err("SIK", '"' + w + '" is missing — it is one of the gaps this list exists to fill');
  });
}

/* ---------- chunk bank (üretim) ---------- */
/* The bank is append-only — Üretim keys it by index — so the count can
   only ever grow. A drop below this floor means the file was truncated,
   which would silently re-point nothing but would lose the tail. */
if (!Array.isArray(CHUNKS) || CHUNKS.length < 300) err("CHUNKS", "expected a bank of 300+ prefabs, found " + (CHUNKS ? CHUNKS.length : 0));
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

/* Üretim keys this bank "k:<index>", so a chunk's position IS its
   identity in every learner's saved schedule. Insert one at the top and
   every box after it silently re-points to a different phrase — the same
   hazard as renumbering a unit, and just as invisible from the outside.
   These are the fifty the bank shipped with, pinned by index. Growing the
   bank is appending; it is never rearranging. */
const CHUNK_HEAD = [
  "ne demek istiyorsun",
  "bir dakika müsaade",
  "ne yapacağımı bilmiyorum",
  "nasıl desem",
  "şöyle söyleyeyim",
  "bana kalırsa",
  "bence de",
  "haklısın",
  "emin değilim",
  "hiç fikrim yok",
  "yanlış anlama",
  "öyle bir şey değil",
  "anlamadım, tekrar eder misin",
  "biraz yavaş konuşur musun",
  "ne dedin",
  "bir şey soracaktım",
  "rahatsız ediyor muyum",
  "müsait misin",
  "acelem var",
  "hiç vaktim yok",
  "sonra konuşalım",
  "görüşmek üzere",
  "kendine iyi bak",
  "geçmiş olsun",
  "kolay gelsin",
  "eline sağlık",
  "afiyet olsun",
  "estağfurullah",
  "rica ederim",
  "zahmet olmazsa",
  "mümkün mü acaba",
  "olur mu",
  "tabii ki",
  "ne yazık ki",
  "maalesef olmaz",
  "belki de haklısın",
  "o kadar da değil",
  "fark etmez",
  "ne olursa olsun",
  "her ihtimale karşı",
  "bir bakayım",
  "hemen geliyorum",
  "az kalsın unutuyordum",
  "aklımdan çıkmış",
  "ne kadar sürer",
  "nerede buluşalım",
  "bilmiyorum ama öğrenirim",
  "sana bir şey söyleyeyim",
  "doğrusunu istersen",
  "neyse, boş ver"
];
CHUNK_HEAD.forEach((t, i) => {
  if (!CHUNKS[i] || CHUNKS[i][0] !== t)
    err("CHUNKS[" + i + "]", 'moved: k:' + i + ' was "' + t + '", now "' +
        (CHUNKS[i] ? CHUNKS[i][0] : "(gone)") + '" — every saved schedule on it now points elsewhere');
});
/* In Üretim the English IS the prompt, so two entries sharing one English
   ask for an answer the prompt cannot determine. Passage lines are
   prompted the same way and from the same screen, so they count too. */
{
  const seen = {};
  CHUNKS.forEach((c, i) => {
    if (seen[c[1]] !== undefined) err("CHUNKS[" + i + "]", 'shares the prompt "' + c[1] + '" with CHUNKS[' + seen[c[1]] + ']');
    else seen[c[1]] = i;
  });
  UNITS.forEach(u => u.read.lines.forEach(ln => {
    if (seen[ln[1]] !== undefined)
      err("CHUNKS[" + seen[ln[1]] + "]", 'shares the prompt "' + ln[1] + '" with a passage line in ' + u.id);
  }));
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

/* ---------- dictation scoring ---------- */
/* dictScore is the only judge in the app that is not the learner, so what
   it forgives and what it does not is a decision rather than an
   implementation detail. Hand-checked, like the morphology table:
   expected percentage, and whether it counts as a pass. */
{
  const DS = M.dictScore, DP = M.dictPass;
  if (!DS || !DP) err("dikte", "dictScore is not in the build");
  else {
    const said = "Sabah saat yedide kalkıyorum.";
    const cases = [
      [said, "Sabah saat yedide kalkıyorum.", 100, true,  "typed exactly"],
      [said, "sabah saat yedide kalkiyorum",  100, true,  "no Turkish keyboard — folded, so it passes"],
      [said, "SABAH SAAT YEDİDE KALKIYORUM",  100, true,  "shouting is not an error"],
      [said, "Sabah  saat   yedide kalkıyorum", 100, true, "extra spaces"],
      [said, "Sabah saat yedide kalkıyorum!!", 100, true, "punctuation folds away"],
      [said, "Sabah yedide kalkıyorum",         75, false, "one word of four missed"],
      [said, "saat yedide kalkıyorum",          75, false, "the first word missed"],
      [said, "Sabah saat yedide çok kalkıyorum",100, false, "every word, plus one invented"],
      [said, "kalkıyorum",                      25, false, "only the verb"],
      [said, "",                                 0, false, "nothing typed"],
      [said, "kalkıyorum yedide saat Sabah",    25, false, "right words, wrong order"],
      ["Hepsi ne kadar?", "hepsi ne kadar",     100, true,  "short line, folded"],
      ["Kazan ölebilir mi?", "kazan olebilir",   67, false, "the question particle dropped"],
      ["— Merhaba! Benim adım Deniz.", "Merhaba benim adım Deniz", 100, true, "dash folds away"]
    ];
    cases.forEach(function (c) {
      const r = DS(c[0], c[1]);
      if (r.pct !== c[2]) err("dikte", c[4] + ": scored " + r.pct + "%, expected " + c[2] + "%");
      if (DP(r) !== c[3]) err("dikte", c[4] + ": pass was " + DP(r) + ", expected " + c[3]);
      dChecked++;
    });
    /* Word order has to count, or dictation is a bag-of-words quiz. */
    if (DS("bir iki üç dört", "dört üç iki bir").pct === 100)
      err("dikte", "a scrambled line still scored 100%");
    /* Every real line has to score clean against itself, or the tokeniser
       is dropping something the learner would be marked down for. */
    UNITS.forEach(function (u) {
      u.read.lines.forEach(function (ln) {
        const r = DS(ln[0], ln[0]);
        if (!r.clean) err("dikte " + u.id, "a line does not score clean against itself: " + ln[0]);
        if (r.of === 0) err("dikte " + u.id, "a line tokenised to nothing: " + ln[0]);
        dChecked++;
      });
    });
    if (M.DICT_PASS !== 80) warn("dikte", "DICT_PASS is " + M.DICT_PASS + ", the golden table assumes 80");
  }
}

/* ---------- numbers, the clock and prices ---------- */
/* Turkish numbers are regular enough to generate and irregular enough in
   two places to get wrong: yüz and bin drop their "bir" where milyon
   keeps it, and dört softens before a vowel. Hand-checked, like the
   morphology table, because a drill that teaches a wrong number is worse
   than no drill. */
let nChecked = 0;
{
  const N = M.numText;
  [[0, "sıfır"], [1, "bir"], [9, "dokuz"], [10, "on"], [11, "on bir"], [19, "on dokuz"],
   [20, "yirmi"], [42, "kırk iki"], [60, "altmış"], [70, "yetmiş"], [99, "doksan dokuz"],
   [100, "yüz"], [101, "yüz bir"], [110, "yüz on"], [175, "yüz yetmiş beş"],
   [200, "iki yüz"], [342, "üç yüz kırk iki"], [900, "dokuz yüz"],
   [999, "dokuz yüz doksan dokuz"], [1000, "bin"], [1001, "bin bir"], [1100, "bin yüz"],
   [1900, "bin dokuz yüz"], [2000, "iki bin"], [2020, "iki bin yirmi"],
   [1994, "bin dokuz yüz doksan dört"], [11000, "on bir bin"], [100000, "yüz bin"],
   [123456, "yüz yirmi üç bin dört yüz elli altı"], [1000000, "bir milyon"],
   [2500000, "iki milyon beş yüz bin"], [1000000000, "bir milyar"]
  ].forEach(([n, want]) => {
    nChecked++;
    const got = N(n);
    if (got !== want) err("numbers", n + ' reads "' + got + '", hand-checked form is "' + want + '"');
  });

  /* The hour before geçiyor and before var. dört is the only awkward one,
     and it is awkward in both. */
  const ACC = ["biri", "ikiyi", "üçü", "dördü", "beşi", "altıyı", "yediyi",
               "sekizi", "dokuzu", "onu", "on biri", "on ikiyi"];
  const DAT = ["bire", "ikiye", "üçe", "dörde", "beşe", "altıya", "yediye",
               "sekize", "dokuza", "ona", "on bire", "on ikiye"];
  for (let h = 1; h <= 12; h++) {
    nChecked += 2;
    if (M.hourAcc(h) !== ACC[h - 1]) err("numbers", "hour " + h + ' accusative is "' + M.hourAcc(h) + '", expected "' + ACC[h - 1] + '"');
    if (M.hourDat(h) !== DAT[h - 1]) err("numbers", "hour " + h + ' dative is "' + M.hourDat(h) + '", expected "' + DAT[h - 1] + '"');
  }

  /* Four shapes and no others, and after half past it counts down to the
     NEXT hour — which wraps, so 12:55 is "bire beş var". */
  /* The live clock on the home screen reads every minute, not just the
     multiples of five a generated prompt uses — so the odd ones are
     hand-checked too, and the sweep below walks all 720. */
  [[3, 0, "saat üç"], [3, 5, "üçü beş geçiyor"], [3, 15, "üçü çeyrek geçiyor"],
   [3, 20, "üçü yirmi geçiyor"], [3, 30, "üç buçuk"], [3, 35, "dörde yirmi beş var"],
   [3, 45, "dörde çeyrek var"], [3, 55, "dörde beş var"], [4, 45, "beşe çeyrek var"],
   [1, 15, "biri çeyrek geçiyor"], [11, 50, "on ikiye on var"], [12, 55, "bire beş var"],
   [3, 1, "üçü bir geçiyor"], [3, 13, "üçü on üç geçiyor"], [3, 29, "üçü yirmi dokuz geçiyor"],
   [3, 31, "dörde yirmi dokuz var"], [3, 37, "dörde yirmi üç var"], [3, 59, "dörde bir var"],
   [12, 31, "bire yirmi dokuz var"], [11, 59, "on ikiye bir var"]
  ].forEach(([h, m, want]) => {
    nChecked++;
    const got = M.timeText(h, m);
    if (got !== want) err("numbers", h + ":" + String(m).padStart(2, "0") + ' reads "' + got + '", hand-checked form is "' + want + '"');
  });

  /* Every hour and every minute: a shape the clock can reach but no drill
     ever did is still a shape a learner reads off the home screen. */
  {
    let shapes = 0;
    for (let h = 1; h <= 12; h++) for (let m = 0; m < 60; m++) {
      const t = M.timeText(h, m);
      shapes++;
      if (!t || /undefined|NaN|  /.test(t))
        err("numbers", h + ":" + m + " reads " + JSON.stringify(t));
      else if (!/^saat /.test(t) && !/ (geçiyor|var)$/.test(t) && !/ buçuk$/.test(t))
        err("numbers", h + ":" + m + ' reads "' + t + '", which is none of the four shapes');
    }
    nChecked += shapes;
  }

  /* AT a time — geçe and kala, and the locative on the hour and the half.
     The hour's locative never softens (dörtte, not *dördde), its
     accusative and dative do (dördü, dörde); both are in here. */
  [[3, 0, "saat üçte"], [4, 0, "saat dörtte"], [6, 0, "saat altıda"], [10, 0, "saat onda"],
   [11, 0, "saat on birde"], [1, 0, "saat birde"], [3, 30, "üç buçukta"], [12, 30, "on iki buçukta"],
   [3, 15, "üçü çeyrek geçe"], [4, 10, "dördü on geçe"], [6, 20, "altıyı yirmi geçe"],
   [9, 5, "dokuzu beş geçe"], [3, 45, "dörde çeyrek kala"], [3, 40, "dörde yirmi kala"],
   [1, 50, "ikiye on kala"], [12, 55, "bire beş kala"], [5, 45, "altıya çeyrek kala"]
  ].forEach(([h, m, want]) => {
    nChecked++;
    const got = M.timeAt(h, m);
    if (got !== want) err("numbers", "at " + h + ":" + String(m).padStart(2, "0") + ' reads "' + got + '", hand-checked form is "' + want + '"');
  });

  [[45, 0, "kırk beş lira"], [42, 50, "kırk iki lira elli kuruş"], [0, 50, "elli kuruş"],
   [1, 5, "bir lira beş kuruş"], [175, 25, "yüz yetmiş beş lira yirmi beş kuruş"],
   [1250, 75, "bin iki yüz elli lira yetmiş beş kuruş"]
  ].forEach(([l, k, want]) => {
    nChecked++;
    const got = M.priceText(l, k);
    if (got !== want) err("numbers", l + "," + k + ' reads "' + got + '", hand-checked form is "' + want + '"');
  });

  /* Months are proper nouns and the course teaches none of them; weekdays
     get only a1u6's drill and one -DA example. The live clock's date line
     is the only place this app exposes either, so the two arrays are the
     whole risk — numText() already carries 266+827 hand-checked forms of
     its own, and dateWords()/dateDigits() do nothing but concatenate. A
     linear sweep of every month and every weekday covers each string in
     both arrays at least once; the four hand-typed forms after it pin the
     word order and the boundary of the digit form's zero-padding. */
  if (M.MONTHS.length !== 12) err("dates", "MONTHS has " + M.MONTHS.length + " entries, expected 12");
  if (M.WEEKDAYS.length !== 7) err("dates", "WEEKDAYS has " + M.WEEKDAYS.length + " entries, expected 7");
  if (new Set(M.MONTHS).size !== M.MONTHS.length) err("dates", "MONTHS has a duplicate");
  if (new Set(M.WEEKDAYS).size !== M.WEEKDAYS.length) err("dates", "WEEKDAYS has a duplicate");
  const MONTH_WANT = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  MONTH_WANT.forEach((want, i) => {
    nChecked++;
    const got = M.dateWords(1, i, 0);
    if (got !== "bir " + want + " Pazar")
      err("dates", "month " + i + ' reads "' + got + '", expected "bir ' + want + ' Pazar"');
  });
  const WEEKDAY_WANT = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  WEEKDAY_WANT.forEach((want, i) => {
    nChecked++;
    const got = M.dateWords(1, 0, i);
    if (got !== "bir Ocak " + want)
      err("dates", "weekday " + i + ' reads "' + got + '", expected "bir Ocak ' + want + '"');
  });
  [[23, 8, 3, "yirmi üç Eylül Çarşamba"], [31, 11, 0, "otuz bir Aralık Pazar"],
   [9, 4, 6, "dokuz Mayıs Cumartesi"], [29, 1, 4, "yirmi dokuz Şubat Perşembe"]
  ].forEach(([d, mi, wi, want]) => {
    nChecked++;
    const got = M.dateWords(d, mi, wi);
    if (got !== want) err("dates", d + "/" + mi + "/" + wi + ' reads "' + got + '", hand-checked form is "' + want + '"');
  });
  /* DD.MM.YYYY, and the padding is the whole risk: a single-digit day or
     month must still carry its leading zero, or 3 Ocak reads as "3.1.2026"
     next to a date that reads "23.09.2026" — inconsistent widths are what
     a learner half-remembers wrong. */
  [[1, 0, 2000, "01.01.2000"], [3, 0, 2026, "03.01.2026"], [23, 8, 2026, "23.09.2026"],
   [31, 11, 2026, "31.12.2026"], [9, 4, 2030, "09.05.2030"]
  ].forEach(([d, mi, y, want]) => {
    nChecked++;
    const got = M.dateDigits(d, mi, y);
    if (got !== want) err("dates", d + "." + mi + "." + y + ' reads "' + got + '", hand-checked form is "' + want + '"');
  });

  /* What the learner may type. A Turkish keyboard writes 1.234 and an
     English one 1,234, so both separators are forgiven — but 1.342 is one
     thousand three hundred and forty-two, and must not read as 342. */
  [["342", 342], ["3 4 2", 342], [" 342 ", 342], ["1.342", 1342], ["1,342", 1342],
   ["", null], ["üç yüz", null], ["12a", null]
  ].forEach(([raw, want]) => {
    nChecked++;
    const got = M.parsePlain(raw);
    if (got !== want) err("numbers", "parsePlain(" + JSON.stringify(raw) + ") = " + got + ", expected " + want);
  });
  /* A clock face has no am and pm and neither does the spoken Turkish, so
     15:15 and 3:15 are one answer — but 27:15 is not a time. */
  [["3:15", "3,15"], ["3.15", "3,15"], ["315", "3,15"], ["1515", "3,15"], ["15:15", "3,15"],
   ["03:15", "3,15"], ["0:15", "12,15"], ["27:15", null], ["3:75", null], ["3", null]
  ].forEach(([raw, want]) => {
    nChecked++;
    const g = M.parseTime(raw);
    const got = g ? g.join(",") : null;
    if (got !== want) err("numbers", "parseTime(" + JSON.stringify(raw) + ") = " + got + ", expected " + want);
  });
  [["42,50", "42,50"], ["42.50", "42,50"], ["42,5", "42,50"], ["42,50 TL", "42,50"],
   ["42", "42,0"], ["4250", "4250,0"], ["", null]
  ].forEach(([raw, want]) => {
    nChecked++;
    const g = M.parsePrice(raw);
    const got = g ? g.join(",") : null;
    if (got !== want) err("numbers", "parsePrice(" + JSON.stringify(raw) + ") = " + got + ", expected " + want);
  });
}

/* ---------- diyalog (branching conversations) ---------- */
/* A dead end in a dialogue tree is not a wrong answer on a screen — it is
   a conversation the learner cannot get out of, in a mode whose entire
   thesis is that you never get stuck. So every branch is walked here. */
let gChecked = 0;
{
  const D = M.DIYALOG || [], R = M.DIA_REPAIR || [];
  if (D.length < 4) err("diyalog", "expected at least 4 scenarios, found " + D.length);
  const ids = {};
  D.forEach(sc => {
    gChecked++;
    if (!sc.id || !/^[a-z]+$/.test(sc.id)) err("diyalog", "scenario id " + JSON.stringify(sc.id) + " is not a plain lowercase key");
    if (ids[sc.id]) err("diyalog", "two scenarios share the id " + sc.id);
    ids[sc.id] = 1;
    if (!str(sc.tr) || !str(sc.en) || !str(sc.blurb)) err("diyalog", sc.id + ": missing tr, en or blurb");
    if (!sc.beats || !sc.beats[sc.start]) { err("diyalog", sc.id + ": start beat " + sc.start + " does not exist"); return; }

    /* Walk every branch from the start. Anything unreachable is dead
       weight; anything with nowhere to go is a learner with nowhere to
       go. */
    /* A destination is a key, or a list of keys the OTHER person chooses
       between at random. A list must be a real choice: two or more, all
       different, all there. */
    let surprises = 0;
    const dests = (to, where) => {
      if (!Array.isArray(to)) return to ? [to] : [];
      surprises++;
      if (to.length < 2 || new Set(to).size !== to.length) err("diyalog", sc.id + "." + where + ": a list destination must name two or more different beats");
      return to;
    };
    const seen = {}, stack = [sc.start];
    let ends = 0;
    while (stack.length) {
      const k = stack.pop();
      if (seen[k]) continue;
      seen[k] = 1;
      const b = sc.beats[k];
      if (!b) { err("diyalog", sc.id + ": nothing at beat " + k); continue; }
      if (!str(b.say)) err("diyalog", sc.id + "." + k + ": the other person says nothing");
      if (b.end) { ends++; continue; }
      if (b.opts && b.want) err("diyalog", sc.id + "." + k + ": has both opts and want");
      if (!b.opts && !b.want) err("diyalog", sc.id + "." + k + ": neither a choice nor a number, and not an end");
      if (b.want) {
        if (!sc.vars || !sc.vars[b.want]) err("diyalog", sc.id + "." + k + ": wants " + b.want + ", which is not a slot");
        const ds = dests(b.to, k);
        if (!ds.length) err("diyalog", sc.id + "." + k + ": a typed beat with nowhere to go");
        ds.forEach(t => { if (!sc.beats[t]) err("diyalog", sc.id + "." + k + ": goes to " + t + ", which does not exist"); else stack.push(t); });
      }
      (b.opts || []).forEach((o, i) => {
        gChecked++;
        if (!str(o.en) || !str(o.tr)) err("diyalog", sc.id + "." + k + " option " + i + ": missing en or tr");
        const ds = dests(o.to, k + " option " + i);
        if (!ds.length) err("diyalog", sc.id + "." + k + " option " + i + ": no destination");
        ds.forEach(t => {
          if (!sc.beats[t]) err("diyalog", sc.id + "." + k + " option " + i + ": goes to " + t + ", which does not exist");
          else stack.push(t);
        });
      });
    }
    Object.keys(sc.beats).forEach(k => {
      if (!seen[k]) err("diyalog", sc.id + ": beat " + k + " can never be reached");
    });
    if (!ends) err("diyalog", sc.id + ": no beat ends the conversation");

    /* The mode's thesis, held in the data: what comes back depends on what
       you said, and sometimes on nothing you said. The first version had
       fifteen choices of which eleven led to the same next line, three
       scenarios with a single route, and no surprise anywhere. */
    const next = b => b.end ? [] : b.opts ? [].concat(...b.opts.map(o => [].concat(o.to))) : [].concat(b.to);
    let routes = 0;
    const walk = (k, on) => {
      const b = sc.beats[k];
      if (!b || on.has(k) || routes > 999) return;
      if (b.end) { routes++; return; }
      on.add(k); new Set(next(b)).forEach(t => walk(t, on)); on.delete(k);
    };
    walk(sc.start, new Set());
    if (routes < 3) err("diyalog", sc.id + ": only " + routes + " route" + (routes === 1 ? "" : "s") + " through it — a conversation that cannot go differently is a script");
    if (!surprises) err("diyalog", sc.id + ": the other person never does anything the learner did not choose — give one beat a list destination");

    /* Every {slot} must exist, and every {slot.field} must exist on EVERY
       option of a pick — "Bursa'ya" and "İzmir'e" differ by a vowel the
       engine could derive, but a proper name is the last place to let a
       generated ending loose, so the data lists them and this checks the
       list is complete. */
    const texts = [];
    Object.keys(sc.beats).forEach(k => {
      const b = sc.beats[k];
      ["say", "slow", "easy"].forEach(f => { if (b[f]) texts.push([k + "." + f, b[f]]); });
      (b.opts || []).forEach((o, i) => { texts.push([k + ".opt" + i + ".tr", o.tr]); texts.push([k + ".opt" + i + ".en", o.en]); });
    });
    texts.forEach(([where, t]) => {
      gChecked++;
      const m = t.match(/\{[a-z0-9]+(?:\.[a-z0-9]+)?\}/gi) || [];
      m.forEach(tok => {
        const parts = tok.slice(1, -1).split(".");
        const v = sc.vars && sc.vars[parts[0]];
        if (!v) { err("diyalog", sc.id + " " + where + ": no slot named " + parts[0]); return; }
        if (parts[1] && (v.time || v.later)) {
          if (parts[1] !== "at") err("diyalog", sc.id + " " + where + ": a time has {" + parts[0] + "} and {" + parts[0] + ".at}, not " + tok);
        } else if (parts[1]) {
          if (!v.pick) err("diyalog", sc.id + " " + where + ": " + tok + " asks for a form of a slot that is not a pick");
          else v.pick.forEach(o => {
            if (o[parts[1]] === undefined) err("diyalog", sc.id + " " + where + ": " + JSON.stringify(o.t) + " has no " + parts[1] + " form");
          });
        }
      });
      if (/[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/.test(t))
        err("diyalog", sc.id + " " + where + ": invisible character in the text");
    });
    Object.keys(sc.vars || {}).forEach(k => {
      const v = sc.vars[k];
      if (v.x2 && !sc.vars[v.x2]) err("diyalog", sc.id + ": slot " + k + " doubles " + v.x2 + ", which does not exist");
      if (v.later && !(sc.vars[v.later] && sc.vars[v.later].time)) err("diyalog", sc.id + ": slot " + k + " is later than " + v.later + ", which is not a time");
      if (Array.isArray(v.time) && !(v.time[0] >= 1 && v.time[1] <= 12 && v.time[0] <= v.time[1]))
        err("diyalog", sc.id + ": slot " + k + " has an hour range outside 1–12");
      if (v.price && v.step && (v.price[0] % v.step || v.price[1] % v.step))
        err("diyalog", sc.id + ": slot " + k + " is rounded to " + v.step + " but its range is not");
      if (v.pick && !v.pick.every(o => str(o.t))) err("diyalog", sc.id + ": slot " + k + " has a pick with no t");
      /* An option's English label renders the slot's OWN English. Without
         one it falls back to the Turkish and the label reads "how much is
         the soğan?", which is how this was found. */
      if (v.pick) v.pick.forEach(o => {
        if (!str(o.e)) err("diyalog", sc.id + ": " + JSON.stringify(o.t) + " in slot " + k + " has no English form");
      });
    });
  });

  /* The repair kit is prefabs, not new material. If a chunk is ever
     reworded these stop being the same phrase the learner drilled, and
     this is what says so. */
  const bank = {};
  CHUNKS.forEach(c => { bank[c[0]] = 1; });
  if (R.length < 3) err("diyalog", "the repair kit has only " + R.length + " moves");
  R.forEach(r => {
    gChecked++;
    if (!bank[r.tr]) err("diyalog", "repair move " + JSON.stringify(r.tr) + " is not in the chunk bank");
    if (!(r.rate > 0 && r.rate <= 1)) err("diyalog", "repair move " + JSON.stringify(r.tr) + " has a nonsense rate");
  });
  if (!R.some(r => r.lv >= 2)) err("diyalog", "no repair move reaches the rephrase");
}

/* ---------- the crest is drawn in three places ---------- */
/* src/icon.svg is the source. The favicon is that file inlined, so the
   single published page carries its own icon; crest() redraws it with CSS
   variables so it can follow the theme. Three copies of one drawing is two
   chances to change one and forget the others, so check they agree: the
   favicon byte for byte, the crest on the numbers that set its shape. */
const svgFile = path.join(root, "src", "icon.svg");
if (fs.existsSync(svgFile)) {                       // absent when run on a lone dist file
  const svg = fs.readFileSync(svgFile, "utf8");
  const minify = t => t.replace(/<!--[\s\S]*?-->/g, "").replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
  const want = Buffer.from(minify(svg)).toString("base64");
  const got = /<link rel="icon" href="data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)">/.exec(html);
  if (!got) err("icon", "no inline favicon in the build");
  else if (got[1] !== want) err("icon", "the inline favicon is not src/icon.svg — rebuild the data URI");

  /* Same figure, different notation: the icon names its petals in <defs>,
     crest() holds them in constants and rotates them in a loop. */
  const pair = (label, re, text) => {
    const m = re.exec(text);
    if (!m) err("icon", "cannot find " + label);
    return m ? m[1] : null;
  };
  const shape = [
    ["outer petal", /<path id="o" d="([^"]+)"/, /const PETAL_OUT="([^"]+)"/],
    ["inner petal", /<path id="i" d="([^"]+)"/, /const PETAL_IN="([^"]+)"/]
  ];
  shape.forEach(([label, inSvg, inApp]) => {
    const a = pair(label + " in src/icon.svg", inSvg, svg);
    const b = pair(label + " in crest()", inApp, code);
    if (a && b && a !== b) err("icon", label + " differs: icon.svg has " + a + ", crest() has " + b);
  });
  /* Colours. crest() fills from --crest-*, which sit outside the light and
     dark palettes precisely so the crest stays the icon; check the two
     agree element for element, in the order each file draws them. */
  const rootCss = /:root\{([^}]*)\}/.exec(html);
  const vars = {};
  if (rootCss) rootCss[1].replace(/(--crest-[a-z]+)\s*:\s*(#[0-9A-Fa-f]{6})/g, (_, k, v) => vars[k] = v.toUpperCase());
  const baked = (svg.slice(svg.indexOf("<g transform")).match(/(?:fill|stroke)="(#[0-9A-Fa-f]{6})"/g) || [])
    .map(x => x.slice(x.indexOf("#"), -1).toUpperCase());
  const named = (code.slice(code.indexOf("function crest(")).match(/var\(--crest-[a-z]+\)/g) || [])
    .map(x => x.slice(4, -1));
  if (named.length !== baked.length) {
    err("icon", "crest() paints " + named.length + " elements, src/icon.svg " + baked.length);
  } else {
    named.forEach((v, i) => {
      if (!vars[v]) err("icon", v + " is used by crest() but not defined on :root");
      else if (vars[v] !== baked[i]) err("icon", v + " is " + vars[v] + " but src/icon.svg paints that element " + baked[i]);
    });
  }

  /* Radii and the gold band, in the order both files draw them. */
  const nums = t => (t.match(/(?:r|stroke-width)="(\d+)"/g) || []).map(x => x.replace(/\D/g, "")).join(",");
  const svgNums = nums(svg.slice(svg.indexOf("<g transform")));
  const appNums = nums(code.slice(code.indexOf("function crest(")));
  if (svgNums && appNums && !appNums.startsWith(svgNums)) {
    err("icon", "crest() draws different circles (" + appNums.split(",").slice(0, 6).join(",") +
      ") from src/icon.svg (" + svgNums + ")");
  }
}

/* ---------- contrast ---------- */
/* Every pair the stylesheet actually paints text in, held to WCAG AA in
   both themes. Eleven failed when this was written — the clock digits at
   2.6:1, every dark-mode primary button at 2.3:1, and the glossed word in
   the reading tooltip at 1.6:1 in dark mode — and all eleven were
   invisible to every other check here, because nothing else reads colour.
   The dark palette is written out twice (the media query and the explicit
   toggle), so the two copies are also held to each other. */
let contrastPairs = 0;
{
  const block = re => { const m = re.exec(html); return m ? m[1] : null; };
  const toks = b => { const o = {}; (b || "").replace(/--([a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g, (_, k, v) => o[k] = v.toUpperCase()); return o; };
  const light = toks(block(/:root\{([^}]*)\}/));
  const darkMq = toks(block(/:root:not\(\[data-theme="light"\]\)\{([^}]*)\}/));
  const darkEx = toks(block(/:root\[data-theme="dark"\]\{([^}]*)\}/));
  if (!Object.keys(light).length || !Object.keys(darkMq).length || !Object.keys(darkEx).length) {
    err("contrast", "could not find the light palette and both dark palettes in the build");
  }
  new Set(Object.keys(darkMq).concat(Object.keys(darkEx))).forEach(k => {
    if (darkMq[k] !== darkEx[k]) err("contrast", "the two dark palettes disagree on --" + k + ": " + darkMq[k] + " (media query) vs " + darkEx[k] + " (toggle)");
  });

  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = h => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  /* [text, background, minimum, where]. 4.5 is AA for body-size text;
     3 is AA for an icon, which is what .star.on is. Add a row whenever a
     rule starts painting a new colour on a new ground. */
  const PAIRS = [
    ["ink", "paper", 4.5, "body text"], ["ink2", "paper", 4.5, ".sub"], ["ink2", "card", 4.5, ".sub in a card"],
    ["ink2", "sunk", 4.5, "segmented control"],
    ["faint", "paper", 4.5, "clock digits, .tiny, the road"], ["faint", "card", 4.5, ".src, .qn, .tiny in a card"],
    ["turk", "paper", 4.5, "the clock"], ["turk", "card", 4.5, ".q .blank, .spd.on"], ["turk", "turk-soft", 4.5, ".pill.turk"],
    ["cobalt", "paper", 4.5, "links"], ["cobalt", "card", 4.5, ".btn.ghost"], ["cobalt", "cobalt-soft", 4.5, ".pill.cob"],
    ["cobalt", "sunk", 4.5, "code"],
    ["bole", "card", 4.5, "a wrong answer"], ["bole", "bole-soft", 4.5, ".dw.miss"],
    ["gold-ink", "card", 4.5, ".tick.here"], ["gold-ink", "gold-soft", 4.5, ".pill.gold, .savewarn button"],
    ["ink", "gold-soft", 4.5, ".savewarn"], ["gold", "card", 3, ".star.on (icon)"],
    ["paper", "ink", 4.5, "the gloss tooltip"], ["gold-inv", "ink", 4.5, "the glossed word in the tooltip"],
    ["on-accent", "cobalt", 4.5, ".btn, .lvl-badge.on"], ["on-accent", "turk", 4.5, ".tick.done, .vb.on"]
  ];
  [["light", light], ["dark", Object.assign({}, light, darkMq)]].forEach(([theme, T]) => {
    PAIRS.forEach(([fg, bg, min, where]) => {
      if (!T[fg] || !T[bg]) { err("contrast", theme + ": --" + (T[fg] ? bg : fg) + " is not defined"); return; }
      const r = ratio(T[fg], T[bg]);
      contrastPairs++;
      if (r < min) err("contrast", theme + " --" + fg + " on --" + bg + " is " + r.toFixed(2) + ":1, needs " + min + " (" + where + ")");
    });
  });
  /* White text on an accent is the one colour a token cannot catch, and
     it was how the dark buttons broke: the accents there are pale. */
  const rules = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  if (/color:\s*(#fff\b|#ffffff\b|white\b)/i.test(rules)) err("contrast", "a rule paints literal white text — use var(--on-accent), which flips in dark mode");
}

/* ---------- atasözleri ve deyimler ---------- */
/* The judge here is the strictest in the app — every word, in order,
   nothing extra — so the data has to be able to survive it. Two ways
   that goes wrong and neither is visible by reading the file:

   1. A saying the tokeniser cannot score against ITSELF. dictScore
      folds and splits, and an apostrophe or a dash can leave the model
      unable to match its own text, which would fail a learner who typed
      it perfectly. Same check the 432 dictation lines get.
   2. Two entries sharing one English prompt. The prompt IS the question
      here, exactly as in Üretim, so two entries with the same prompt
      make one of them unanswerable. CHUNKS has the same rule and it
      caught a real collision when that bank was written. */
let aChecked = 0;
{
  const A = M.ATASOZU, D = M.DEYIM, DS = M.dictScore;
  if (!Array.isArray(A) || !A.length) err("söz", "ATASOZU is not in the build");
  if (!Array.isArray(D) || !D.length) err("söz", "DEYIM is not in the build");

  const ids = new Set(), prompts = new Map();
  /* Invisible characters: a soft hyphen or a zero-width space looks
     perfect on screen and breaks every match it touches. CORE is checked
     for exactly this, and a saying matched EXACTLY has even less room. */
  const INVIS = /[­​‌‍⁠﻿]/;

  const common = (it, kind, where) => {
    if (!str(it.id)) { err(where, "no id"); return; }
    /* ids are permanent, like unit ids: S.ata is keyed by them. Keep them
       boring so nothing has to be escaped or normalised later. */
    if (!/^[a-z][a-z0-9]*$/.test(it.id)) err(where, "id \"" + it.id + "\" is not a plain lowercase slug");
    const key = kind + ":" + it.id;
    if (ids.has(key)) err(where, "duplicate id \"" + it.id + "\" — S.ata would merge two sayings into one box");
    ids.add(key);
    ["t", "en"].forEach(f => { if (!str(it[f])) err(where, "no " + f); });
    [it.t, it.en, it.s, it.lit].concat(it.alt || []).forEach(v => {
      if (typeof v === "string" && INVIS.test(v)) err(where, "invisible character in \"" + v + "\"");
      if (typeof v === "string" && TAGS.test(v)) err(where, "raw HTML in a field the app escapes");
    });
  };

  A.forEach(p => {
    const where = "atasözü " + (p.id || "?");
    common(p, "a", where);
    aChecked++;
    /* The prompt is the situation, never the gloss: knowing WHEN to say
       one is the skill, and prompting with the meaning would drill
       recognition instead. */
    if (!str(p.s)) err(where, "no situation — the prompt for a proverb is the moment it answers, not its meaning");
    /* A proverb is a whole utterance and is punctuated as one; an idiom
       is a citation form and is not. The shapes must not drift. */
    if (!/[.!?]$/.test(p.t || "")) err(where, "a proverb is a whole utterance and should end in a full stop");
    if (/^[a-zçğıöşü]/.test(p.t || "")) err(where, "a proverb starts with a capital");
    (p.alt || []).forEach(v => {
      if (v === p.t) err(where, "alt repeats the main wording");
      if (!/[.!?]$/.test(v)) err(where, "alt \"" + v + "\" should be punctuated like the main wording");
    });
  });

  D.forEach(d => {
    const where = "deyim " + (d.id || "?");
    common(d, "d", where);
    aChecked++;
    if (!str(d.lit)) err(where, "no literal gloss — the gap between the words and the meaning is the whole lesson");
    if (/[.!?]$/.test(d.t || "")) err(where, "an idiom is a citation form, not a sentence — no full stop");
    if (!Array.isArray(d.ex) || d.ex.length !== 2 || !str(d.ex[0]) || !str(d.ex[1]))
      err(where, "needs one example sentence as [tr, en]");
  });

  /* One prompt, one answer. */
  A.concat(D).forEach(it => {
    const q = fold(it.s || it.en);
    const who = (it.s ? "atasözü " : "deyim ") + it.id;
    if (prompts.has(q)) err(who, "shares its English prompt with " + prompts.get(q) + " — one of them cannot be answered");
    else prompts.set(q, who);
  });

  /* Nothing here may duplicate what the sixty units or CORE already
     teach: this bank is additive by the same rule CORE is, and it did
     collide eight times while it was being written. */
  const already = new Set();
  UNITS.forEach(u => (u.vocab || []).forEach(v => already.add(fold(v[0]))));
  (CORE || []).forEach(c => already.add(fold(c.t)));
  A.concat(D).forEach(it => {
    if (already.has(fold(it.t)))
      err("söz " + it.id, "\"" + it.t + "\" is already taught by the course — this bank is additive");
  });

  /* Every accepted wording must score clean against itself, or a learner
     who typed it exactly would be marked wrong. */
  if (DS) {
    A.concat(D).forEach(it => {
      [it.t].concat(it.alt || []).forEach(f => {
        const r = DS(f, f);
        aChecked++;
        if (!r.clean) err("söz " + it.id, "\"" + f + "\" does not score clean against itself (" + r.hit + "/" + r.of + ")");
      });
    });

    /* The three invariants of an exact judge, swept across every entry.
       The third is what separates this mode from Dilbilgisi, where a
       reordering is deliberately allowed: a proverb is a fixed string,
       so moving a word has to fail. */
    A.concat(D).forEach(it => {
      const w = it.t.split(/\s+/);
      if (w.length < 2) return;
      aChecked += 3;
      const dropped = w.slice(0, -1).join(" ");
      if (DS(it.t, dropped).clean) err("söz " + it.id, "a dropped word still passes");
      if (DS(it.t, it.t + " filanca").clean) err("söz " + it.id, "an invented word still passes");
      const swapped = w.slice();
      swapped[0] = w[1]; swapped[1] = w[0];
      if (fold(swapped.join(" ")) !== fold(it.t) && DS(it.t, swapped.join(" ")).clean)
        err("söz " + it.id, "a reordering still passes — a fixed saying is not order-free like a grammar target");
    });
  }

  /* An example sentence has to actually contain its idiom, or it
     illustrates nothing. Matched the way the repetition engine matches a
     phrase: by prefix, because the last word inflects — "kafa patlatmak"
     turns up as "kafa patlattım". Stems under three letters prove
     nothing and are skipped, the same reasoning as REP_PREFIX_MIN. */
  D.forEach(d => {
    if (!Array.isArray(d.ex)) return;
    const hay = fold(d.ex[0]).split(" ");
    const parts = fold(d.t).split(" ");
    parts.forEach((w, i) => {
      const last = i === parts.length - 1;
      const stem = last ? w.replace(/(ma|me)?(mak|mek)$/, "") : w;
      const need = Math.min(last ? 3 : 4, stem.length);
      if (stem.length < 3) return;
      aChecked++;
      const hit = hay.some(h => h.slice(0, need) === stem.slice(0, need));
      if (!hit) err("deyim " + d.id, "the example does not contain \"" + w + "\"");
    });
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
  dChecked + " dictation scores · " + nChecked + " number forms · " +
  gChecked + " dialogue checks · " + aChecked + " saying checks · " + contrastPairs + " contrast pairs · " + diagChecked + " diagnosis checks · " + spokenChecked + " spoken-form checks · " + altChecked + " alternative checks · " +
  taught.size + " course words + " + (CORE ? CORE.length : 0) + " core words + " + (SIK ? SIK.length : 0) + " frequent words in " + Object.keys(classCount).length + " classes" +
  (warns.length ? " · " + warns.length + " warning" + (warns.length > 1 ? "s" : "") : ""));
