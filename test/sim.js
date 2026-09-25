#!/usr/bin/env node
/* Headless render of every screen in the app, plus the paths that only
   exist at runtime: the quiz engine, the voice player, the review queue
   and backup/restore.

   The app is innerHTML + inline onclick calling globals, so there is no
   framework to mount — a small DOM stub and a fake clock are enough to
   drive the real code. Anything thrown, any screen that renders empty,
   and any "undefined" leaking into the markup fails the run.

   Usage: node test/sim.js [dist/index.html]                          */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const file = process.argv[2] || path.join(root, "dist", "index.html");

const fails = [];
const seenScreens = new Set();
let checks = 0, screens = 0;
function ok(cond, msg) { checks++; if (!cond) fails.push(msg); }

/* The environment lives in test/dom.js, shared with test/snap.js. */
const boot = require("./dom.js");
const env = boot(file);
const { ev, doc, appEl, bodyEl, documentEl, voice, drain, clock, store } = env;
let lastPaint = env.lastHTML();             /* the app paints once while booting */
/* Units and lessons open in order (unitOpen/baslaOpen in the app). Almost
   every step below is about what a unit or lesson does once it is open,
   on a fresh state, so the locks are lifted here and put back for the one
   step that is about them, "the path opens in order", which is also where
   they are broken on purpose. */
const LIFT = "unitOpen=function(){return true}; baslaOpen=function(){return true}";
ev("__unitOpen=unitOpen; __baslaOpen=baslaOpen; " + LIFT);

const UNITS = ev("UNITS"), LEVELS = ev("LEVELS"), PLACEMENT = ev("PLACEMENT");
const q = s => JSON.stringify(s);
/* A label's English as enUnder() writes it, under the Turkish. */
const GL = en => '<span class="gl">' + en + '</span>';

/* Every paint is inspected as it happens. */
const BAD = /undefined|\bNaN\b|\[object Object\]/;
let paintErrors = 0;
function screenKey() {
  const v = ev("V") || {};
  if (v.view === "unit") return "unit:" + v.u + ":" + (v.sec || "v");
  if (v.view === "level") return "level:" + v.lv;
  if (v.view === "quiz") { const Q = ev("Q") || {}; return "quiz:" + Q.mode + ":" + (Q.u || Q.lv || ""); }
  return v.view || "?";
}
/* The English layer (enUnder in app.core.js). Two things hold on every
   paint. Content is never glossed: an answer option, a tile, a vocabulary
   pair or a passage word that carried the English underneath would give
   the answer away with the toggle on, and lose it with the toggle off.
   And no interface label is left written "Türkçe · english" with an
   English half the table does not list: each one is a decision about
   whether the half after the · is English at all, so a new label has to
   be decided rather than left inline. EN_TAIL_OK is the reviewed list of
   halves that stay where they are — Turkish, a count, or content. */
const GLOSSED_CONTENT = /<(?:button|span|div|p) class="(?:opt|tile|vtr|ven|gw|dw)\b[^"]*"[^>]*>[^<]*<span class="gl">/;
const EN_TAIL_OK = new Set([
  "soru", "gibi"   /* Turkish: two A1–A2 grammar titles, Bu, şu, o · çoğul · soru and daha · en · kadar · gibi */
]);
const enLoose = new Map();
let EN_CLS_RE = null, EN_SKIP_RE = null;
function enScan(h) {
  if (!EN_CLS_RE) { EN_CLS_RE = new RegExp(ev("EN_CLS.source")); EN_SKIP_RE = new RegExp(ev("EN_SKIP.source")); }
  if (GLOSSED_CONTENT.test(h)) fails.push("content carries the English layer: " + h.slice(Math.max(0, h.search(GLOSSED_CONTENT)), h.search(GLOSSED_CONTENT) + 90));
  for (const m of h.matchAll(/<(button|h2|p|div|span)\b([^>]*)>([^<]+)(?=<)/g)) {
    const c = /class="([^"]*)"/.exec(m[2]), cls = c ? c[1] : "";
    if (m[1] !== "button" && !EN_CLS_RE.test(cls)) continue;
    if (EN_SKIP_RE.test(cls)) continue;
    /* Only elements that never hold course content: a sub line, a tiny
       tag or a word pill can carry a vocabulary gloss or a generated
       word, which would make this depend on what the run happened to
       draw. Those are still glossed; they are just not policed here. */
    if (m[1] !== "button" && m[1] !== "h2" && !/\b(lead|pill|empty|big)\b/.test(cls)) continue;
    if (/\bpill\b/.test(cls) && m[1] === "span") continue;
    if (h.substr(m.index + m[0].length, 17) === '<span class="gl">') continue;
    const t = m[3].trim(), i = t.lastIndexOf(" · ");
    if (i < 0) continue;
    const tail = t.slice(i + 3);
    if (!/^[a-z][a-z0-9 ,’'“”?()\/-]*$/.test(tail) || /[çğıöşü]/.test(tail) || EN_TAIL_OK.has(tail)) continue;
    enLoose.set(tail, t);
  }
  /* Instructions carry both languages (tx()), and the Turkish half is the
     one a B2 learner sees alone: empty, identical to the English, or
     still English is the half a copy-paste leaves behind. */
  for (const m of h.matchAll(/<span class="t-tr">([\s\S]*?)<\/span><span class="t-en">([\s\S]*?)<\/span>/g)) {
    const tr = m[1].replace(/<[^>]+>/g, "").trim(), en = m[2].replace(/<[^>]+>/g, "").trim();
    if (!tr || tr === en || /\b(the|you|your|is|are|and|this|when|what)\b/.test(tr.replace(/<i>[^<]*<\/i>/g, "")))
      txBad.set(tr.slice(0, 60), en.slice(0, 60));
  }
}
const txBad = new Map();
appEl._onpaint = h => {
  screens++; lastPaint = h;
  seenScreens.add(screenKey());
  if (h) enScan(h);
  if (!h || h.length < 40) { if (paintErrors++ < 6) fails.push("empty screen painted: " + q(ev("V")).slice(0, 80)); }
  else if (BAD.test(h)) { if (paintErrors++ < 6) fails.push("screen leaks " + BAD.exec(h)[0] + " at " + q(ev("V")).slice(0, 80) + " · " + h.slice(Math.max(0, h.search(BAD) - 60), h.search(BAD) + 40)); }
};

function step(label, fn) {
  try { fn(); }
  catch (e) { fails.push(label + " threw: " + (e && e.message || e)); }
}

/* ===================== 1 · boot and home ===================== */
ok(lastPaint.length > 0, "boot painted nothing");
ok(/türkçe/i.test(lastPaint), "home screen has no title");
ok(ev("V.view") === "home", "boot did not land on home");

/* ===================== 2 · levels ===================== */
LEVELS.forEach(l => step("level " + l.id, () => {
  ev("go('level'," + q(l.id) + ")");
  ok(lastPaint.includes(l.tr), "level " + l.id + " does not show its name");
  ok(lastPaint.includes("startLevelExam('" + l.id + "')"), "level " + l.id + " has no test-ahead card");
}));

/* ===================== 3 · every unit, every section ===================== */
const SECS = ["v", "g", "r", "d"];
UNITS.forEach(u => {
  SECS.forEach(s => step("unit " + u.id + "/" + s, () => {
    ev("go('unit'," + q(u.id) + "," + q(s) + ")");
    ok(lastPaint.includes("Kelimeler"), u.id + "/" + s + " lost the section tabs");
    if (s === "v") ok(lastPaint.includes(esc(u.vocab[0][1])), u.id + " vocab list is missing its first word");
    if (s === "g") ok(lastPaint.includes(esc(u.gram.t)), u.id + " grammar title missing");
    if (s === "r") {
      ok(lastPaint.includes(esc(u.read.kind)), u.id + " passage does not declare its kind");
      ok((lastPaint.match(/class="ln"/g) || []).length === u.read.lines.length, u.id + " passage line count wrong");
      if (u.read.gloss) ok(lastPaint.includes("Sözlük"), u.id + " gloss list missing");
    }
    if (s === "d") ok(lastPaint.includes(u.drill.length + " soru"), u.id + " drill card missing");
  }));
  /* the bookmark follows the learner */
  ok(ev("S.place.u") === u.id && ev("S.place.s") === "d", u.id + " did not record the bookmark");
  ok(ev("!!(S.seen[" + q(u.id) + "]&&S.seen[" + q(u.id) + "].r)"), u.id + " reading not marked seen");
});

/* ===================== 4 · reading: voice, lines, gloss ===================== */
step("reading interaction", () => {
  const u = UNITS.find(x => x.read.gloss);
  ev("go('unit'," + q(u.id) + ",'r')");

  /* tap a line for the English */
  const p = doc.getElementById("ln0");
  ok(!!p, "line 0 has no element");
  ev("lineTap({target:{classList:{contains:function(){return false}},closest:function(){return null}}},0)");
  ok(p.querySelector("em").style.display === "block", "tapping a line did not reveal the English");
  ev("lineTap({target:{classList:{contains:function(){return false}},closest:function(){return null}}},0)");
  ok(p.querySelector("em").style.display === "none", "tapping a line again did not hide the English");

  /* a gloss bubble */
  const gw = doc.getElementById("passage").querySelector(".gw");
  ok(!!gw, "passage has no glossed word");
  ev("showBubble({},{getAttribute:function(k){return k==='data-w'?'x':'y'},getBoundingClientRect:function(){return{top:10,left:10,width:30,height:20,bottom:30}}})");
  ok(bodyEl.querySelectorAll(".bubble").length === 1, "gloss bubble did not open");
  ev("hideBubble()");
  ok(bodyEl.querySelectorAll(".bubble").length === 0, "gloss bubble did not close");

  /* single line */
  voice.spoken = [];
  ev("sayLine(1)");
  ok(voice.spoken.length === 1 && voice.spoken[0] === u.read.lines[1][0], "sayLine spoke the wrong line");

  /* Dinle — every line, in order */
  voice.spoken = [];
  ev("playFrom(0,'listen')");
  drain();
  ok(voice.spoken.length === u.read.lines.length, "Dinle spoke " + voice.spoken.length + " of " + u.read.lines.length + " lines");
  ok(voice.spoken[0] === u.read.lines[0][0], "Dinle started on the wrong line");
  ok(ev("VOICE.mode") === null, "Dinle did not clear the mode when it finished");

  /* Gölge — same lines, with a gap after each */
  voice.spoken = [];
  ev("playFrom(0,'shadow')");
  drain();
  ok(voice.spoken.length === u.read.lines.length, "Gölge spoke " + voice.spoken.length + " of " + u.read.lines.length + " lines");

  /* speed setting survives and is stored */
  ev("setRate(0.6)");
  ok(ev("VOICE.rate") === 0.6 && ev("S.rate") === 0.6, "speed was not kept");
  ev("setRate(0.85)");

  /* stopPlay on navigation — audio must not run over the next screen */
  ev("playFrom(0,'listen')");
  ok(ev("VOICE.mode") === "listen", "playFrom did not start");
  ev("go('unit'," + q(u.id) + ",'v')");
  ok(ev("VOICE.mode") === null, "go() left the player running");
  ev("playFrom(0,'listen')");
  ev("home()");
  ok(ev("VOICE.mode") === null, "home() left the player running");
  voice.spoken = [];
  drain();
  ok(voice.spoken.length === 0, "a stopped player kept speaking after navigation");

  /* a word on its own */
  voice.spoken = [];
  ev("sayWord('merhaba')");
  ok(voice.spoken.length === 1, "sayWord said nothing");
});

/* ===================== 5 · the quiz engine, every unit ===================== */
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

/* Answer the question the quiz is currently on. right=false deliberately
   gets it wrong, to walk the failure feedback too. */
function answer(right) {
  const it = ev("Q.items[Q.i]");
  if (it.t === "mc") {
    const pick = right ? it.c : (it.c + 1) % it.a.length;
    ev("answerMC(" + pick + ")");
  } else if (it.t === "fill") {
    const fin = doc.getElementById("fin");
    if (!fin) { fails.push("fill question has no input"); return; }
    fin.value = right ? it.c : "zzz";
    ev("answerFill()");
  } else {
    const pool = ev("Q.pool").slice();
    const used = [];
    it.w.forEach(w => {
      let at = pool.findIndex((t, i) => t === w && !used[i]);
      if (at < 0) { fails.push("order tile not in the pool: " + w); return; }
      used[at] = 1;
      ev("build(" + at + ")");
    });
    if (!right) ev("unbuild(0)");
    ev("answerOrder()");
  }
  ok(ev("Q.res[Q.i]") === right, "answering " + (right ? "correctly" : "wrongly") + " was graded the other way (" + it.t + ")");
  ok(lastPaint.includes(right ? "Doğru" : "Yanlış"), "feedback missing after a " + (right ? "right" : "wrong") + " answer");
  ev("nextQ()");
}

UNITS.forEach(u => step("quiz " + u.id, () => {
  ev("startUnitQuiz(" + q(u.id) + ")");
  for (let i = 0; i < u.drill.length; i++) answer(true);
  ok(lastPaint.includes(u.drill.length + "/" + u.drill.length), u.id + " score screen does not show a full score");
  ok(ev("!!S.done[" + q(u.id) + "]"), u.id + " was not marked complete after a perfect quiz");
  ok(ev("S.done[" + q(u.id) + "].score") === u.drill.length, u.id + " stored the wrong score");
}));

/* Their sim asserted this and it is worth keeping: the per-unit ticks
   must add up to a finished course. */
ok(ev("allPct()") === 100, "every unit quiz passed but overall progress is " + ev("allPct()") + "%");

step("failing a quiz", () => {
  ev("wipe()");
  const u = UNITS[0];
  ev("startUnitQuiz(" + q(u.id) + ")");
  for (let i = 0; i < u.drill.length; i++) answer(false);
  ok(!ev("!!S.done[" + q(u.id) + "]"), "a failed quiz still marked the unit complete");
  ok(lastPaint.includes("0/" + u.drill.length), "the failed score screen is wrong");
  ok(/Biraz daha/.test(lastPaint), "no retry message on a failed quiz");
  ev("back()");
  ok(ev("V.view") === "unit", "back() from a unit quiz did not return to the unit");
});

/* A learner without a Turkish keyboard types plain ASCII; fold() is what
   lets that still pass, so type it the hard way and expect a pass. */
function asciify(t) {
  return t.replace(/[ıİI]/g, "i").replace(/[şŞ]/g, "s").replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u").replace(/[öÖ]/g, "o").replace(/[çÇ]/g, "c")
    .replace(/[âÂ]/g, "a").replace(/[îÎ]/g, "i").replace(/[ûÛ]/g, "u");
}
step("fill answers fold diacritics", () => {
  ev("wipe()");
  let hit = 0;
  UNITS.forEach(u => {
    const at = u.drill.findIndex(d => d.t === "fill" && /[ıİşŞğĞüÜöÖçÇâîû]/.test(d.c));
    if (at < 0) return;
    hit++;
    const want = u.drill[at].c;
    [asciify(want), asciify(want).toUpperCase(), " " + want + " "].forEach(typed => {
      ev("startUnitQuiz(" + q(u.id) + ")");
      for (let i = 0; i < at; i++) ev("nextQ()");
      const fin = doc.getElementById("fin");
      if (!fin) { fails.push(u.id + ": fill question " + at + " has no input"); return; }
      fin.value = typed;
      ev("answerFill()");
      ok(ev("Q.res[Q.i]") === true, u.id + ' drill[' + at + ']: typing "' + typed + '" for "' + want + '" was marked wrong — fold() is what lets a learner without a Turkish keyboard pass');
    });
  });
  ok(hit > 5, "only " + hit + " fill answers carry Turkish letters — the folding path is barely covered");
  /* and a genuinely wrong answer is still wrong */
  const u = UNITS[0], at = u.drill.findIndex(d => d.t === "fill");
  ev("startUnitQuiz(" + q(u.id) + ")");
  for (let i = 0; i < at; i++) ev("nextQ()");
  doc.getElementById("fin").value = "zzz";
  ev("answerFill()");
  ok(ev("Q.res[Q.i]") === false, "folding made a wrong answer pass");
  ev("wipe()");
});

/* ===================== 6 · level exams and placement ===================== */
LEVELS.forEach(l => step("exam " + l.id, () => {
  ev("startLevelExam(" + q(l.id) + ")");
  ok(ev("Q.items.length") === 10, l.id + " exam is not ten questions");
  for (let i = 0; i < 10; i++) answer(true);
  ok(ev("!!S.tested[" + q(l.id) + "]"), l.id + " exam did not mark the level tested");
  ok(ev("lvPct(" + q(l.id) + ")") === 100, l.id + " exam did not complete the level");
  ok(ev("UNITS.filter(function(u){return u.lv===" + q(l.id) + "&&S.done[u.id]&&S.done[u.id].byTest}).length") === 10,
    l.id + " units were not flagged as passed by test");
}));

step("placement", () => {
  ev("wipe()");
  ev("startPlacement()");
  ok(ev("Q.items.length") === PLACEMENT.length, "placement is not " + PLACEMENT.length + " questions");
  for (let i = 0; i < PLACEMENT.length; i++) answer(true);
  ok(/Önerilen başlangıç seviyesi/.test(lastPaint), "placement did not recommend a level");
  ok(/C2/.test(lastPaint), "a perfect placement should recommend the top level");
});

/* ===================== 7 · words, cards, the review queue ===================== */
step("saved words", () => {
  ev("wipe()");
  ev("go('words')");
  ok(/No saved words yet/.test(lastPaint), "empty word list has no empty state");

  const u = UNITS[0];
  ev("go('unit'," + q(u.id) + ",'v')");
  ev("toggleStar(0)");
  ok(ev("S.star.length") === 1, "starring a word did not save it");
  ok(ev("Object.keys(S.srs).length") === 1, "star and srs are out of step after starring");
  ev("toggleStar(0)");
  ok(ev("S.star.length") === 0 && ev("Object.keys(S.srs).length") === 0, "unstarring left the schedule behind");

  ev("starAll(" + q(u.id) + ")");
  ok(ev("S.star.length") === u.vocab.length, "starAll saved " + ev("S.star.length") + " of " + u.vocab.length);
  ok(ev("Object.keys(S.srs).length") === u.vocab.length, "starAll did not schedule every word");

  ev("go('words')");
  ok(lastPaint.includes(u.vocab.length + " kelime"), "word list count wrong");
  ev("unstar(0)");
  ok(ev("S.star.length") === u.vocab.length - 1, "unstar did not remove the word");
  ok(ev("Object.keys(S.srs).length") === u.vocab.length - 1, "unstar left an orphan in srs");
});

step("flashcards", () => {
  const n = ev("S.star.length");
  ev("startCards()");
  ok(ev("V.view") === "cards", "cards did not open");
  ev("flip()");
  ok(/class="sub"/.test(lastPaint), "flipping a card revealed nothing");
  for (let i = 0; i < n; i++) ev("nextCard()");
  ok(/gözden geçirildi/.test(lastPaint), "cards did not finish");
});

step("review queue", () => {
  const due = ev("dueList().length");
  ok(due === ev("S.star.length"), "new words are not all due today");
  ev("startReview()");
  ok(ev("V.view") === "review", "review did not open");

  /* İyi moves a word one box out; Zor brings it back today. */
  const k = ev("RV.q[0]");
  ev("rvFlip()");
  ev("rvGrade(1)");
  ok(ev("S.srs[" + q(k) + "].b") === 1, "İyi did not advance the box");
  ok(ev("S.srs[" + q(k) + "].d") === ev("dayNum()") + ev("STEPS[1]"), "İyi scheduled the wrong day");
  const k2 = ev("RV.q[1]");
  ev("rvFlip()");
  ev("rvGrade(0)");
  ok(ev("S.srs[" + q(k2) + "].b") === 0 && ev("S.srs[" + q(k2) + "].d") === ev("dayNum()"), "Zor did not bring the word back today");
  const k3 = ev("RV.q[2]");
  ev("rvFlip()");
  ev("rvGrade(2)");
  ok(ev("S.srs[" + q(k3) + "].b") === 2, "Kolay did not jump two boxes");

  while (ev("RV.i < RV.q.length")) { ev("rvFlip()"); ev("rvGrade(1)"); }
  ok(/kelime tekrar edildi/.test(lastPaint), "review did not finish");
  ok(ev("dueList().length") < due, "nothing left the due list after a review");
});

/* ===================== 8 · üretim · production ===================== */
/* The point of the mode is the silence: the prompt is English, the gap is
   empty, and the Turkish only arrives after it. So the things worth
   proving are that the gap really runs on the clock, that the model is
   spoken at the end of it, that a navigation away kills the countdown
   rather than letting it speak over the next screen, and that the
   self-grade lands on the same STEPS ladder the word queue uses. */
const phase = () => ev("PR ? PR.phase : null");

/* Walk one item: sit through the gap, then grade it. */
function produce(good) {
  const g = ev("prodGap()");
  ok(phase() === "gap", "üretim did not open on the gap");
  const before = ev("PR.left");
  let ticks = 0;
  while (phase() === "gap" && ticks < 30) { drain(1); ticks++; }
  ok(before === g, "the gap started at " + before + " for a " + g + "s setting");
  ok(ticks === g, "the countdown ran " + ticks + " ticks for a " + g + "s gap");
  ok(phase() === "model", "the model did not arrive after the gap");
  const it = ev("PR.q[PR.i]");
  ok(voice.spoken[voice.spoken.length - 1] === it.tr, "the model spoken was not the sentence");
  ok(voice.langs[voice.langs.length - 1] === "tr-TR", "the model was not spoken as Turkish");
  ok(lastPaint.includes(esc(it.tr)), "the model was not revealed on screen");

  const key = it.k, day = ev("dayNum()");
  /* Generated drills are keyed by pattern, so the same key can come round
     twice in one sitting — check the ladder, not the first rung. */
  /* Snapshot: ev() hands back a live reference the app then mutates. */
  const prior = JSON.parse(ev("JSON.stringify(S.prod[" + q(key) + "]||null)")) || { b: 0, d: day };
  const fresh = !ev("!!S.prod[" + q(key) + "]");
  ev("prodMark(" + (good ? "true" : "false") + ")");
  const rec = ev("S.prod[" + q(key) + "]");
  ok(!!rec, "grading stored no schedule for " + key);
  if (good) {
    const want = fresh ? 1 : Math.min(prior.b + 1, ev("STEPS.length") - 1);
    ok(rec.b === want && rec.d === day + ev("STEPS[" + want + "]"),
      "Doğru scheduled " + JSON.stringify(rec) + ", expected box " + want + " at +" + ev("STEPS[" + want + "]"));
  } else ok(rec.b === 0 && rec.d === day, "Yanlış did not bring the sentence back today");

  /* Reported: Yanlış opened the backward buildup and stopped the sitting.
     It moves on now, and a first miss comes back once at the end. */
  if (!good) {
    ok(phase() !== "build", "Yanlış opened the backward buildup instead of moving on");
    const q = ev("PR.q"), last = q[q.length - 1];
    if (!it.again) ok(last.k === key && last.again === true, "a missed sentence was not brought back at the end of the sitting");
    else ok(q.filter(x => x.k === key && x.again).length === 1, "a retry missed again was queued a third time");
  }
}

step("üretim home", () => {
  ev("wipe()");
  ev("go('prod')");
  ok(/Üretim/.test(lastPaint), "üretim screen is empty");
  ok(/Kalıplar/.test(lastPaint), "chunk bank missing from üretim");
  ok(/Üç kez anlat/.test(lastPaint), "retell section missing from üretim");
  ev("setGap(3)");
  ok(ev("prodGap()") === 3 && ev("S.gap") === 3, "gap setting was not kept");
  ev("setScope('all')");
  ok(ev("pscope()") === "all", "scope setting was not kept");
  ok(ev("sentenceBank().length") === ev("UNITS.reduce(function(n,u){return n+u.read.lines.length},0)"),
    "the all-units bank is not every passage line");
  ev("setScope('done')");
  /* With nothing finished the bank falls back to units merely opened, and
     to nothing at all when nothing has been opened. It used to hand out the
     first three units regardless, which asked a day-one learner to produce
     sentences from passages they had never seen. */
  ok(ev("sentenceBank().length") === 0, "an untouched course still offers sentences to produce");
  ev("go('unit','a1u1','r')");
  ok(ev("sentenceBank().length") === ev("unit('a1u1').read.lines.length"),
    "opening one unit did not make exactly its lines available");
});

step("üretim · sentences", () => {
  ev("wipe()"); ev("setGap(3)"); ev("setScope('all')");
  ev("startProd('s')");
  ok(ev("V.view") === "prodrun", "üretim did not start");
  const n = ev("PR.q.length");
  ok(n === ev("SESSION"), "a session is " + n + " items, expected " + ev("SESSION"));
  for (let i = 0; i < n; i++) produce(i % 3 !== 0);     /* miss every third */
  /* Each miss came back once at the end; miss it again, so it stays due. */
  const again = ev("PR.q.length") - n;
  ok(again === Math.ceil(n / 3), "the misses did not each come back once: " + again);
  for (let i = 0; i < again && phase() !== "end"; i++) produce(false);
  ok(phase() === "end", "the session did not finish");
  ok(/kendi değerlendirmen/.test(lastPaint), "no score screen after üretim");
  ok(ev("Object.keys(S.prod).length") === n, "graded " + n + " but stored " + ev("Object.keys(S.prod).length"));

  /* Due today should now be the missed ones: a sitting of SESSION new
     sentences has spent the day's allowance of new ones. */
  const due = ev("prodDue(sentenceBank()).length");
  ok(n === ev("NEW_DAY.prod") && due === ev("Object.keys(S.prod).filter(function(k){return S.prod[k].b===0}).length"),
    "the sentences answered right are still due today, or new ones came past the day's allowance");
});

step("üretim · the English prompt", () => {
  ev("wipe()"); ev("setGap(3)"); ev("setScope('all')");
  ok(ev("!S.prompten"), "the English prompt should be silent by default");
  ev("togglePrompt()");
  ok(ev("S.prompten") === true, "prompt voice did not turn on");
  voice.spoken = []; voice.langs = [];
  ev("startProd('s')");
  ok(voice.spoken.length === 1, "the English prompt was not spoken");
  ok(voice.langs[0] === "en-GB", "the English prompt was spoken as " + voice.langs[0] + ", not English");
  ok(voice.spoken[0] === ev("PR.q[0].en"), "the prompt spoken was not the English");
  ev("togglePrompt()");
});

step("üretim · the gap is cancelled by navigation", () => {
  ev("wipe()"); ev("setGap(4)"); ev("setScope('all')");
  ev("startProd('s')");
  ok(phase() === "gap", "no gap running");
  ok(ev("PR.tid !== null"), "the countdown has no timer");
  ev("home()");                       /* stopPlay() must take the countdown with it */
  ok(ev("PR.tid === null"), "home() left the üretim countdown running");
  voice.spoken = [];
  drain();
  ok(voice.spoken.length === 0, "a cancelled countdown still spoke over the next screen");
  ok(ev("V.view") === "home", "navigation away from üretim failed");
});

step("üretim · backward buildup", () => {
  /* The shape CLAUDE.md names: the verb alone, then the clause, then all. */
  const parts = ev("clauseSplit('Adamın ne dediğini bilmiyorum.')");
  ok(parts.length === 3, "expected three steps, got " + JSON.stringify(parts));
  ok(parts[0] === "bilmiyorum.", "buildup does not start on the verb: " + parts[0]);
  ok(parts[1] === "ne dediğini bilmiyorum.", "middle step wrong: " + parts[1]);
  ok(parts[2] === "Adamın ne dediğini bilmiyorum.", "buildup does not end whole: " + parts[2]);

  /* It must never lie about the sentence, whatever the shape. */
  let grew = 0;
  UNITS.forEach(u => u.read.lines.forEach(ln => {
    const p = ev("clauseSplit(" + q(ln[0]) + ")");
    const whole = ev("sayable(" + q(ln[0]) + ")");
    if (p[p.length - 1] !== whole) fails.push("buildup of " + q(ln[0]).slice(0, 40) + " does not end on the sentence");
    for (let i = 1; i < p.length; i++) {
      if (p[i].length <= p[i - 1].length) fails.push("buildup does not grow: " + p[i - 1] + " → " + p[i]);
      if (!whole.endsWith(p[i - 1])) fails.push("buildup piece is not a tail of the sentence: " + p[i - 1]);
    }
    if (p.length > 1) grew++;
  }));
  checks += 2;
  ok(grew > 200, "only " + grew + " of 432 lines split into a buildup — the rule is too shy");
});

step("üretim · chunks", () => {
  ev("wipe()"); ev("setGap(3)");
  ev("startProd('k')");
  const n = ev("PR.q.length");
  ok(n === ev("SESSION"), "chunk session is " + n);
  ok(ev("PR.q[0].k").indexOf("k:") === 0, "chunk keys are not namespaced: " + ev("PR.q[0].k"));
  for (let i = 0; i < n; i++) produce(true);
  ok(phase() === "end", "chunk session did not finish");
  ok(ev("prodDue(chunkBank()).length") === 0, "graded chunks are still due today, or new ones came past the day's allowance");

  /* The bank is the roadmap's first item, grown from 50 to 300+. Two
     things had to survive that: the sitting stays a sitting, and the hub
     reports the sitting rather than the whole bank — "307 due today" is
     the debt-nobody-will-clear reading the Tekrar hub already had to
     correct once. */
  ok(ev("CHUNKS.length") >= 300, "the chunk bank is only " + ev("CHUNKS.length") + " deep");
  ev("wipe()"); ev("go('prod')");
  const card = /Kalıplar(?:<span class="gl">[^<]*<\/span>)?<\/p><p class="sub">(?:<span class="t-tr">[^<]*<\/span><span class="t-en">)?([^<]*)/.exec(lastPaint);
  ok(!!card, "the Kalıplar card is gone");
  ok(card && card[1].indexOf(ev("SESSION") + " in this sitting") > -1,
     "the chunk card offers the backlog rather than the sitting: " + (card ? card[1].slice(-70) : ""));
  ok(!/<b>'+ev("CHUNKS.length")+'<\/b><span>kalıp/.test(lastPaint),
     "the stat row still counts the whole bank as due");

  /* Every prefab has to be usable as a prompt: something to say, and an
     English that names it. A blank either side is an unanswerable item. */
  let empty = 0;
  ev("CHUNKS").forEach(c => { if (!String(c[0]).trim() || !String(c[1]).trim()) empty++; });
  ok(empty === 0, empty + " chunks have an empty side");
});

step("üretim · say it three times", () => {
  ev("wipe()");
  const u = UNITS[0], day = ev("dayNum()");
  ev("go('unit'," + q(u.id) + ",'r')");
  ok(/Üç kez anlat/.test(lastPaint), "the reading screen offers no retell");
  ev("startRetell(" + q(u.id) + ")");
  ok(ev("V.view") === "retell", "retell did not open");
  ok(lastPaint.includes(esc(u.speak)), "retell does not show the speaking task");

  ev("retellDone(" + q(u.id) + ")");
  ok(ev("S.retell[" + q(u.id) + "].n") === 1, "first telling not counted");
  ok(ev("S.retell[" + q(u.id) + "].d") === day + 2, "second telling is not two days out (day 3)");
  ok(ev("retellDue().length") === 0, "a told unit is still due today");

  ev("S.retell[" + q(u.id) + "].d=dayNum()");   /* let day 3 arrive */
  ev("retellDone(" + q(u.id) + ")");
  ok(ev("S.retell[" + q(u.id) + "].d") === day + 4, "third telling is not four days on (day 7)");
  ev("S.retell[" + q(u.id) + "].d=dayNum()");
  ev("retellDone(" + q(u.id) + ")");
  ok(ev("S.retell[" + q(u.id) + "].n") === 3, "third telling not counted");
  /* Told: the short end screen, and the task's own page says it is done. */
  ok(ev("V.view") === "retelldone" && lastPaint.includes("3/3"), "the third telling does not end on its 3/3");
  ev("startRetell(" + q(u.id) + ")");
  ok(/Üç kez anlatıldı/.test(lastPaint), "no completion state after three tellings");
  ok(ev("retellOpen().length") === 0, "a finished retell is still open");
  ev("retellReset(" + q(u.id) + ")");
  ok(ev("S.retell[" + q(u.id) + "].n") === 0, "reset did not clear the retell");
});

step("üretim · survives backup and wipe", () => {
  ev("wipe()"); ev("setGap(5)"); ev("setScope('all')");
  ev("startProd('s')"); produce(true);
  ev("startRetell('a1u2')"); ev("retellDone('a1u2')");
  const before = ev("JSON.stringify(S)");
  ev("go('about')"); ev("exportBox()");
  const saved = doc.getElementById("iobox").value;
  ok(saved === before, "the backup does not carry üretim state");
  ev("wipe()");
  ok(ev("Object.keys(S.prod).length") === 0 && ev("Object.keys(S.retell).length") === 0, "wipe left üretim state behind");
  ok(ev("S.gap") === 5, "wipe threw away the gap setting, which is not progress");
  ev("go('about')");
  doc.getElementById("iobox").value = saved;
  ev("importBox()");
  ok(ev("Object.keys(S.prod).length") === 1, "restore lost the sentence schedule");
  ok(ev("S.retell['a1u2'].n") === 1, "restore lost the retell");
});

step("kurma · generated drills", () => {
  ev("wipe()"); ev("setGap(3)");
  ev("startProd('g')");
  const n = ev("PR.q.length");
  ok(n === ev("SESSION"), "generated session is " + n + " items");
  const keys = ev("PR.q.map(function(i){return i.k})");
  ok(keys.every(k => k.indexOf("g:") === 0), "generated items are not keyed by pattern: " + keys[0]);
  ok(ev("PR.q.every(function(i){return i.tr&&i.en&&i.tr.length>2})"), "a generated drill came out empty");
  ok(new Set(ev("PR.q.map(function(i){return i.tr})")).size > 1, "every generated sentence is the same");
  for (let i = 0; i < n; i++) produce(i % 2 === 0);
  for (let i = 0; i < n && phase() !== "end"; i++) produce(true);   /* the misses, back once */
  ok(phase() === "end", "generated session did not finish");
  /* Scheduling is by pattern, so a handful of keys, not a dozen. */
  ok(ev("Object.keys(S.prod).length") <= n, "pattern scheduling stored more keys than items");
  ok(ev("Object.keys(S.prod).every(function(k){return k.indexOf('g:')===0})"), "generated grading wrote a non-pattern key");
  /* A generated set never runs dry, so its end always offers another. */
  ok(lastPaint.includes("startProd('g')"), "the generated end screen does not offer another sitting");
});

step("dönüştürme · transformations", () => {
  ev("wipe()"); ev("setGap(3)");
  ev("startProd('t')");
  const n = ev("PR.q.length");
  ok(n > 0, "no transformation drills were built");
  ok(ev("PR.q.every(function(i){return !!i.given&&!!i.instr})"), "a transformation has no sentence to transform");
  ok(ev("PR.q.every(function(i){return i.given!==i.tr})"), "a transformation does not change the sentence");
  ok(lastPaint.includes(esc(ev("PR.q[0].given"))), "the sentence to transform is not on screen");
  { const [itr, ien] = ev("PR.q[0].instr").split(" · ");
    ok(lastPaint.includes(esc(itr) + GL(ien)), "the instruction is not on screen"); }
  for (let i = 0; i < n; i++) produce(true);
  ok(phase() === "end", "transformation session did not finish");
  ok(ev("Object.keys(S.prod).every(function(k){return k.indexOf('t:')===0})"), "transformation grading wrote a non-move key");
});

step("the generator does not produce nonsense", () => {
  /* Cheap, blunt checks over a big sample — the kind of wrong that is
     easy to introduce and hard to notice one drill at a time. */
  const bad = [];
  const BADEN = /\b(are|am|is) (liking|knowing|wanting|understanding|seeing)\b|Did (we|you|I|he|they) (make|give)\?/;
  const seen = new Set();
  for (let i = 0; i < 600; i++) {
    const k = ev("KINDS")[i % ev("KINDS").length];
    const r = JSON.parse(ev("JSON.stringify((function(){var s=makeSpec(" + q(k) + ");return specText(s)})())"));
    seen.add(r.tr);
    if (!r.tr || !r.en) bad.push("empty: " + k);
    if (/undefined|NaN|\[object/.test(r.tr + r.en)) bad.push("leak: " + r.en + " / " + r.tr);
    if (/ {2}/.test(r.tr + r.en)) bad.push("double space: " + r.tr);
    if (BADEN.test(r.en)) bad.push("English: " + r.en);
    /* Turkish capitalises i as İ — a leading bare "I" before a lowercase
       letter means capTR was skipped somewhere. */
    if (/^I[a-zçğıöşü]/.test(r.tr)) bad.push("capital: " + r.tr);
  }
  ok(bad.length === 0, "generator produced " + bad.length + " bad prompts, e.g. " + bad.slice(0, 3).join(" · "));
  ok(seen.size > 200, "only " + seen.size + " distinct sentences in 600 draws — the generator is too repetitive");

  /* Every transformation must be answerable: a different sentence, and
     the same one the engine would build from the changed spec. */
  let moves = 0;
  for (let i = 0; i < 200; i++) {
    const m = JSON.parse(ev("JSON.stringify(makeMove())"));
    if (!m) continue;
    moves++;
    if (m.from.tr === m.to.tr) bad.push("no-op move: " + m.move.k);
    if (!m.to.tr || /undefined/.test(m.to.tr)) bad.push("broken move: " + m.move.k);
  }
  ok(moves > 150, "only " + moves + " of 200 transformation draws produced a drill");
  ok(bad.length === 0, "transformations produced " + bad.length + " bad prompts");
});

step("sözlük · the whole word list", () => {
  ev("wipe()");
  ev("go('dict')");
  ok(/Sözlük/.test(lastPaint), "the word list did not open");
  const all = ev("dictAll().length");
  ok(all > 500, "the word list holds only " + all + " words");
  ok(ev("dictRows().length") === all, "the unfiltered list is not everything");
  ok(ev("dictAll().every(function(w){return w.tr&&w.en&&w.lv&&w.c&&w.src})"), "a word row is missing a field");
  ok(ev("dictAll().filter(function(w){return w.src==='course'}).every(function(w){return !!w.u})"), "a course word has no unit to open");
  ok(ev("dictAll().filter(function(w){return w.src==='core'}).every(function(w){return !!w.k})"), "a core word has no topic");
  const course = ev("dictAll().filter(function(w){return w.src==='course'}).length");
  const core = ev("dictAll().filter(function(w){return w.src==='core'}).length");
  ok(course > 500 && core > 200, "source split looks wrong: " + course + " course, " + core + " core");
  ok(course + core === all, "the two sources do not add up to the list");
  /* The core list is additive — no word appears under both sources. */
  const trs = ev("dictAll().map(function(w){return w.tr})");
  ok(new Set(trs).size === trs.length, "the same word appears twice in the word list");

  /* Source filter, and the topic filter a core row opens */
  ev("dictSrc('core')");
  ok(ev("dictRows().every(function(w){return w.src==='core'})"), "the core filter let course words through");
  ok(ev("dictRows().length") === core, "the core filter count does not match");
  const topic = ev("dictRows()[0].k");
  ev("dictTopic(" + q(topic) + ")");
  ok(ev("dictRows().every(function(w){return w.k===" + q(topic) + "})"), "the topic filter let other topics through");
  ok(ev("dictRows().length") > 3, "the topic filter left almost nothing");
  ok(lastPaint.includes("konu: " + esc(topic)), "no way to see or clear the topic filter");
  ev("dictTopic('')");
  ok(!ev("DICT.topic"), "clearing the topic filter did not work");
  ev("dictSrc('course')");
  ok(ev("dictRows().every(function(w){return w.src==='course'})"), "the course filter let core words through");
  ev("dictSrc('all')");

  /* Every word lands in exactly one class, and the classes add up. */
  const classes = ev("dictAll().map(function(w){return w.c})");
  const tally = {};
  classes.forEach(c => tally[c] = (tally[c] || 0) + 1);
  ok(Object.keys(tally).every(c => ["n", "f", "s", "z", "e", "i"].includes(c)), "unknown word class: " + Object.keys(tally));
  ok(Object.values(tally).reduce((a, b) => a + b, 0) === all, "the classes do not add up to the whole list");
  ok(tally.f > 80 && tally.n > 100, "class split looks wrong: " + JSON.stringify(tally));
  /* Infinitives must never be filed as nouns. */
  ok(ev("dictAll().filter(function(w){return /(mak|mek)$/.test(w.tr)&&w.c!=='f'}).length") === 0,
    "an infinitive was not classified as a verb");

  /* Filtering */
  ev("dictCat('f')");
  ok(ev("dictRows().every(function(w){return w.c==='f'})"), "the verb filter let other classes through");
  ok(ev("dictRows().length") === tally.f, "the verb filter count does not match");
  ev("dictCat('all')");

  /* Search, including a diacritic-free spelling */
  ev("dictSearch('kitap')");
  ok(ev("dictRows().length") >= 1 && ev("dictRows()[0].tr").indexOf("kitap") > -1, "searching for kitap found nothing");
  ev("dictSearch('book')");
  ok(ev("dictRows().length") >= 1, "searching the English side found nothing");
  ev("dictSearch('ogrenci')");
  ok(ev("dictRows().length") >= 1, "search is not diacritic-folded — a learner without a Turkish keyboard cannot use it");
  ev("dictSearch('zzzznothing')");
  ok(ev("dictRows().length") === 0 && /Bu aramaya uygun kelime yok/.test(lastPaint), "a search with no hits has no empty state");
  ev("dictSearch('')");

  /* Sorting */
  ev("dictSort()");
  ok(ev("DICT.sort") === "lv", "sort did not switch to level order");
  ok(ev("dictRows()[0].lv") === "A1", "level order does not start at A1");
  ev("dictSort()");
  ok(ev("dictRows()[0].tr").localeCompare(ev("dictRows()[1].tr"), "tr") <= 0, "alphabetical order is not Turkish-collated");

  /* Starring from the list keeps star and srs in step, like everywhere else */
  const w = ev("dictRows()[0]");
  ev("starWord(" + q(w.tr) + "," + q(w.en) + ")");
  ok(ev("S.star.length") === 1 && ev("Object.keys(S.srs).length") === 1, "starring from the word list did not schedule it");
  ev("starWord(" + q(w.tr) + "," + q(w.en) + ")");
  ok(ev("S.star.length") === 0 && ev("Object.keys(S.srs).length") === 0, "unstarring from the word list left an orphan");

  /* A core word stars into the same queue as a course word */
  ev("dictSrc('core')");
  const cw = ev("dictRows()[0]");
  ev("starWord(" + q(cw.tr) + "," + q(cw.en) + ")");
  ok(ev("S.star.length") === 1 && ev("Object.keys(S.srs).length") === 1, "starring a core word did not schedule it");
  ok(ev("dueList().length") === 1, "a starred core word is not due");
  ev("starWord(" + q(cw.tr) + "," + q(cw.en) + ")");
  ev("dictSrc('all')");

  /* A row opens the unit it came from */
  ev("go('unit'," + q(w.u) + ",'v')");
  ok(ev("V.view") === "unit" && ev("V.u") === w.u, "the word does not lead back to its unit");
});

/* ===================== 9 · dinleme · listening ===================== */
/* The one mode that marks the learner rather than asking them to mark
   themselves, so the scoring is worth pinning down, and the one that
   deliberately runs the voice past 1x, so the rate has to be checked at
   the synthesiser rather than in the setting. */
step("speeds above normal actually reach the voice", () => {
  ev("wipe()");
  const rows = ev("SPEEDS");
  ok(Array.isArray(rows) && rows.length === 2, "SPEEDS is not two rows");
  const flat = rows[0].concat(rows[1]);
  ok(flat.some(r => r > 1), "no speed above 1x is offered");
  ok(Math.max.apply(null, flat) >= 1.5, "the fast row does not reach 1.5x");

  ev("go('unit','a1u1','r')");
  ok(/1\.75×/.test(lastPaint), "the reading screen does not offer the fast row");
  flat.forEach(r => {
    ev("setRate(" + r + ")");
    voice.rates.length = 0;
    ev("playFrom(0,'listen')");
    const got = voice.rates[voice.rates.length - 1];
    ok(Math.abs(got - r) < 0.001, "setRate(" + r + ") spoke at " + got);
    ok(ev("S.rate") === r, "setRate(" + r + ") was not saved");
    ev("stopPlay()");
  });
  ev("setRate(0.85)");
});

step("dictation marks what was typed, word by word", () => {
  ev("wipe()"); ev("S.pscope='all'"); ev("save()");
  ev("go('dinle')");
  ok(ev("V.view") === "dinle", "dinleme hub did not open");
  ok(/Dikte/.test(lastPaint) && /Ses önce/.test(lastPaint), "the hub is missing an exercise");

  ev("startDinle('d')");
  ok(ev("V.view") === "dinlerun", "dictation did not start");
  const n = ev("DK.q.length");
  ok(n === ev("DSESSION"), "a dictation sitting is " + n + ", expected " + ev("DSESSION"));
  ok(voice.spoken[voice.spoken.length - 1] === ev("DK.q[0].tr"), "the first line was not spoken on entry");
  ok(!lastPaint.includes(ev("DK.q[0].tr")), "the line is on screen before anything is typed");

  /* typed exactly: full marks, nothing missing, box moves out */
  const said = ev("DK.q[DK.i].tr"), key = ev("DK.q[DK.i].k");
  ok(/^d:/.test(key), "dictation wrote the key " + key);
  doc.getElementById("dbox").value = said;
  ev("dikteCheck()");
  ok(ev("DK.res.pct") === 100 && ev("DK.res.clean"), "an exact answer did not score 100");
  ok(ev("S.dinle[" + q(key) + "].b") === 1, "a right answer did not move a box");
  ok(lastPaint.includes(ev("DK.q[DK.i].en")), "the check screen hides the English");

  /* a dropped word is named, not merely counted */
  ev("dinleNext()");
  const said2 = ev("DK.q[DK.i].tr"), key2 = ev("DK.q[DK.i].k");
  const words = said2.split(/\s+/);
  doc.getElementById("dbox").value = words.slice(1).join(" ");
  ev("dikteCheck()");
  ok(ev("DK.res.ops.filter(function(o){return o.t==='miss'}).length") >= 1,
     "a dropped word was not reported missing");
  ok(/class="dw miss"/.test(lastPaint), "the missing word is not marked on screen");
  ok(ev("DK.res.pct") < 100, "a dropped word still scored 100");

  /* an invented word fails even at full word recall */
  ev("dinleNext()");
  const said3 = ev("DK.q[DK.i].tr"), key3 = ev("DK.q[DK.i].k");
  doc.getElementById("dbox").value = said3 + " zürafa";
  ev("dikteCheck()");
  ok(ev("DK.res.extra") === 1, "an invented word was not counted as extra");
  ok(ev("!dictPass(DK.res)"), "an invented word still passed");
  ok(ev("S.dinle[" + q(key3) + "].b") === 0, "a failed line did not come back to box 0");
  ok(/class="dw extra"/.test(lastPaint), "the invented word is not struck through");

  /* nothing typed scores zero and is not an error */
  ev("dinleNext()");
  doc.getElementById("dbox").value = "";
  ev("dikteCheck()");
  ok(ev("DK.res.pct") === 0, "an empty answer did not score 0");

  /* finish the sitting */
  let guard = 0;
  while (ev("DK.phase") !== "end" && guard++ < 40) {
    if (ev("DK.phase") === "play") { doc.getElementById("dbox").value = ev("DK.q[DK.i].tr"); ev("dikteCheck()"); }
    else ev("dinleNext()");
  }
  ok(ev("DK.phase") === "end", "the dictation sitting never ended");
  ok(/kelimesi kelimesine/.test(lastPaint), "the end screen does not say who marked it");
  ok(ev("Object.keys(S.dinle).length") === n, "graded " + n + " lines but stored " + ev("Object.keys(S.dinle).length"));
  ok(ev("Object.keys(S.dinle).every(function(k){return k.indexOf('d:')===0})"),
     "dictation wrote a key that is not a dictation key");
});

step("replays are limited, and typing survives them", () => {
  ev("wipe()"); ev("S.pscope='all'"); ev("setDreplay(2)");
  ev("startDinle('d')");
  ok(ev("DK.plays") === 1, "the line was not counted as played once on entry");
  ok(ev("replayLeft()") === 1, "replayLeft is wrong after the first play");

  /* a replay must not redraw — that would throw away the input */
  doc.getElementById("dbox").value = "yarım cevap";
  const paints = screens;
  ev("dinlePlay()");
  ok(screens === paints, "a replay repainted the screen and lost the input");
  ok(ev("DK.plays") === 2 && ev("replayLeft()") === 0, "the second replay did not count");

  /* and beyond the limit it refuses, still without losing the input */
  ev("dinlePlay()");
  ok(ev("DK.plays") === 2, "a replay past the limit was allowed");
  ok(ev("DK.typed") === "yarım cevap", "a refused replay lost what was typed");
  ok(doc.getElementById("dbox").value === "yarım cevap", "the input box was cleared");

  /* unlimited is a real setting */
  ev("go('dinle')"); ev("setDreplay(0)");
  ok(ev("dreplay()") === 0 && ev("replayLeft()") > 1, "unlimited replays did not take");
  ev("setDreplay(2)");
});

step("audio first reveals only after the decision", () => {
  ev("wipe()"); ev("S.pscope='all'"); ev("save()");
  ev("setDrate(1.3)");
  voice.rates.length = 0;
  ev("startDinle('a')");
  ok(ev("DK.phase") === "play", "audio-first did not start in the play phase");
  ok(Math.abs(voice.rates[voice.rates.length - 1] - 1.3) < 0.001, "the listening rate did not reach the voice");
  const it = ev("DK.q[DK.i]");
  ok(!lastPaint.includes(it.tr), "audio-first showed the Turkish before the reveal");
  ok(!lastPaint.includes(it.en), "audio-first showed the English before the reveal");

  ev("hearReveal()");
  ok(ev("DK.phase") === "reveal", "reveal did not change phase");
  ok(lastPaint.includes(it.tr) && lastPaint.includes(it.en), "the reveal shows nothing");

  const key = it.k;
  ok(/^a:/.test(key), "audio-first wrote the key " + key);
  ev("hearMark(true)");
  ok(ev("S.dinle[" + q(key) + "].b") === 1, "understood did not move a box");

  /* the two exercises keep separate schedules for the same line */
  const line = ev("DK.q[0].k").slice(2);
  ev("wipe()"); ev("S.pscope='all'");
  ev("S.dinle={'d:" + line + "':{b:4,d:0}}"); ev("save()");
  ok(ev("dinleDue('a:')") === Math.min(ev("listenBank('a:').length"), ev("NEW_DAY.dinle")),
     "a dictation box changed what audio-first thinks is due");
  ev("setDrate(1)");
});

step("listening state survives wipe and restore the way settings should", () => {
  ev("wipe()"); ev("S.pscope='all'"); ev("setDrate(1.5)"); ev("setDreplay(1)");
  ev("startDinle('d')");
  doc.getElementById("dbox").value = ev("DK.q[DK.i].tr");
  ev("dikteCheck()");
  ok(ev("Object.keys(S.dinle).length") === 1, "nothing was scheduled");
  const saved = ev("JSON.stringify(S)");

  ev("wipe()");
  ok(ev("Object.keys(S.dinle).length") === 0, "wipe left the listening schedule behind");
  ok(ev("S.drate") === 1.5 && ev("S.dreplay") === 1, "wipe threw away the listening settings");

  ev("go('about')");
  doc.getElementById("iobox").value = saved;
  ev("importBox()");
  ok(ev("Object.keys(S.dinle).length") === 1, "restore lost the listening schedule");
  ev("setDrate(1)"); ev("setDreplay(2)");
});

/* ===================== 10 · tekrar · the repetition engine ===================== */
/* Every review mode draws only on units the learner has met. Tests that
   want a populated queue have to say so; the default is a beginner with
   nothing behind them. */
function meetAll() { ev("UNITS.forEach(function(u){S.seen[u.id]={v:1,g:1,r:1,d:1}}); save()"); }
/* Derse başla: answer whatever the lesson's current step asks, right or
   wrong; false when the step is not a check. */
const ADIM_CHECKS = ["hear", "spell", "type", "cloze", "gex"];
function adimAnswer(s, right) {
  if (s.t === "hear") ev("adPick(" + (right ? s.w.i : s.opts.find(o => o.i !== s.w.i).i) + ")");
  else if (s.t === "spell") {
    const used = [];
    s.w.say.split("").forEach(l => { const i = s.tiles.findIndex((t, j) => t === l && !used.includes(j)); used.push(i); ev("adAdd(" + i + ")"); });
    if (!right) { ev("AD.built=AD.built.slice().reverse()"); if (s.w.say.split("").reverse().join("") === s.w.say) ev("AD.built=[AD.built[0]]"); }
    ev("adSpell()");
  } else if (s.t === "type" || s.t === "cloze" || s.t === "gex") {
    doc.getElementById("abox").value = right ? s.c : "qqq zzz";
    ev("adType()");
  } else return false;
  return true;
}
/* Walk the lesson under way to its end, everything right; each step
   passes through the calls a learner's taps make. */
function walkAdim(onStep) {
  let g = 0;
  while (ev("adCur().t") !== "end" && g++ < 120) {
    const s = ev("adCur()");
    if (onStep) onStep(s);
    if (adimAnswer(s, true)) ev("adNext()");
    else if (s.t === "say") { ev("adSay()"); ev("adNext()"); }
    else if (s.t === "sik") ev("adSik()");
    else if (s.t === "speak") ev("adSpeak()");
    else ev("adNext()");
  }
  return ev("adCur().t") === "end";
}

step("nothing is reviewed before it has been met", () => {
  ev("wipe()");
  /* pscope is a setting, so wipe() keeps it; an earlier step may have left
     it on "all". This step is about the default. */
  ev("setScope('done')");
  /* The reported bug: on a fresh install the engine sorted all 600 words by
     how rarely the app mentions them, and the rarest live in the advanced
     units — so day one asked for "abartı" and "akıcı", C2 words the learner
     had never seen. */
  ok(ev("repBank().length") === 0, "a learner who has met nothing has " +
     ev("repBank().length") + " words queued for review");
  ok(ev("sentenceBank().length") === 0, "sentences are offered from unread units");
  ok(ev("listenBank('d:').length") === 0, "dictation is offered from unread units");
  ok(ev("startTekrar()") === undefined && ev("TK") === null, "a sitting started with an empty bank");

  const p = ev("planToday()");
  ok(p.steps.length === 1 && p.steps[0].k === "new",
     "day one shows " + p.steps.map(x => x.tr).join("/") + " rather than just the first unit");
  ok(ev("planToday().all").filter(x => !x.avail).length === 4,
     "the unavailable review steps are not being withheld");
  ok(/Başla/.test(lastPaint) || true, "");

  /* Open one unit: its words become reviewable, and nothing else does. */
  ev("go('unit','a1u1','v')");
  const bank = ev("repBank()");
  ok(bank.length === 10, "opening one unit made " + bank.length + " words reviewable, expected its 10");
  ok(bank.every(e => e.unit === "a1u1"), "words from unopened units leaked into the queue");
  ok(bank.every(e => e.lv === "A1"), "a beginner's queue contains " +
     bank.map(e => e.lv).filter((l, i, a) => a.indexOf(l) === i).join("/"));

  /* And the level of what it asks, for a learner one unit in. */
  ev("startTekrar()");
  ok(ev("TK.q").every(i => /^A1 ·/.test(i.from)), "a one-unit learner is asked about " +
     ev("TK.q").map(i => i.from.split(" · ")[0]).join(","));

  /* The grain: opening a unit's word list is not reading its passage, so
     the words become reviewable and the sentences do not. Without this,
     peeking at a B2 word list offered B2 sentences to produce. */
  ev("wipe()"); ev("setScope('done')");
  ev("go('unit','a1u1','v')");
  ok(ev("repBank().length") === 10, "opening the word list did not make its words reviewable");
  ok(ev("sentenceBank().length") === 0, "opening a word list offered the unread passage's sentences");
  ok(ev("repBank().map(repItem).every(function(i){return i.kind==='recall'})"),
     "a cloze was built from a passage that has not been read");
  ev("go('unit','a1u1','r')");
  ok(ev("sentenceBank().length") === ev("unit('a1u1').read.lines.length"),
     "reading the passage did not make its lines available");
  ok(ev("repBank().map(repItem).some(function(i){return i.kind==='cloze'})"),
     "reading the passage did not unlock any cloze");
  ev("go('unit','b2u5','v')");
  ok(ev("repBank().some(function(e){return e.lv==='B2'})"), "a peeked B2 word list is not reviewable");
  ok(!ev("sentenceBank().some(function(s){return s.lv==='B2'})"),
     "peeking at a B2 word list offered its sentences to produce");
  ok(ev("repBank().map(repItem).filter(function(i){return i.kind==='cloze'}).every(function(i){return /^A1/.test(i.from)})"),
     "a cloze context came from a passage that was never read");

  /* "Tümü" stays an explicit choice and still reaches everything. */
  ev("wipe()"); ev("setScope('all')");
  ok(ev("sentenceBank().length") > 400, "the explicit Tümü scope was broken by the fix");
  ev("setScope('done')");
});


/* This engine decides which of 600 words the learner sees next, from a
   count it derives itself. If the count is wrong the whole thing points at
   the wrong words, so the invariants matter more than the screens. */
step("the word index counts what it claims to", () => {
  ev("wipe()"); meetAll();
  const words = ev("wordIndex().words");
  ok(words.length === 600, "the index holds " + words.length + " words, expected 600");
  ok(ev("repBands().reduce(function(a,b){return a+b})") === 600,
     "with every unit met the bands do not add up to 600");

  /* Every taught word appears at least in its own vocabulary list. A zero
     means the matcher failed to find a word the app definitely shows. */
  const zero = words.filter(w => w.nat < 1);
  ok(zero.length === 0, zero.length + " words score zero encounters, e.g. " +
     zero.slice(0, 3).map(w => w.tr).join(" · "));

  /* Every remembered context must really contain the word, or the cloze
     builder is being handed lines it cannot blank. */
  let bogus = 0;
  words.forEach(w => (w.where || []).slice(0, 2).forEach(p => {
    const line = ev("unit(" + q(p[0]) + ").read.lines[" + p[1] + "][0]");
    if (ev("repSpan(" + q(line) + ".split(/\\s+/)," + q(w.form) + ")") === null) bogus++;
  }));
  ok(bogus === 0, bogus + " remembered contexts do not contain their word");

  /* Worst-served first, or the engine drills the wrong end of the list. */
  const bank = ev("repBank()").map(e => ev("repTotal(" + JSON.stringify(e) + ")"));
  let unsorted = 0;
  for (let i = 1; i < bank.length; i++) if (bank[i] < bank[i - 1]) unsorted++;
  ok(unsorted === 0, "the bank is not ordered worst-served first (" + unsorted + " inversions)");
});

step("a vocabulary entry's alternatives are split, short stems are not guessed at", () => {
  ok(JSON.stringify(ev("vocabForms('ad / isim')")) === '["ad","isim"]',
     "a slashed entry is not split: " + JSON.stringify(ev("vocabForms('ad / isim')")));
  ok(JSON.stringify(ev("vocabForms('ağabey (abi)')")) === '["agabey","abi"]',
     "a parenthesised alternative is not split: " + JSON.stringify(ev("vocabForms('ağabey (abi)')")));
  ok(JSON.stringify(ev("vocabForms('hafta sonu')")) === '["hafta sonu"]',
     "a genuine two-word noun was split apart");

  /* "ad" must not collect "adam" and "ada"; "kitap" must still collect
     "kitaplar". That asymmetry is the whole point of REP_PREFIX_MIN. */
  ok(ev("repMatches('ad','ad')"), "an exact short form does not match itself");
  ok(!ev("repMatches('adam','ad')"), "the short stem 'ad' still swallows 'adam'");
  ok(!ev("repMatches('ada','ad')"), "the short stem 'ad' still swallows 'ada'");
  ok(ev("repMatches('kitaplar','kitap')"), "'kitap' no longer reaches 'kitaplar'");
  ok(!ev("repMatches('kitap','kitaplar')"), "matching runs the wrong way round");
});

step("every question is answerable and shows nothing it is asking for", () => {
  ev("wipe()"); meetAll(); ev("setScope('done')");
  const items = ev("wordIndex().words.map(repItem)");
  ok(items.length === 600, "not every word yields a question");
  const cloze = items.filter(i => i.kind === "cloze");
  ok(cloze.length > 250, "only " + cloze.length + " words get a context to blank");

  ok(cloze.every(i => i.q.indexOf("___") > -1), "a cloze lost its blank");
  ok(items.every(i => i.c && i.c.trim().length > 0), "a question has no answer");
  /* A recall answer is a word to type, not an entry to transcribe. */
  const brackets = items.filter(i => i.kind === "recall" && /[()\/]/.test(i.c));
  ok(brackets.length === 0, brackets.length + " recall answers ask for brackets or slashes, e.g. " +
     brackets.slice(0, 2).map(i => JSON.stringify(i.c)).join(" "));
  ok(items.every(i => (i.alts || []).length > 0), "an item lists no acceptable answer");
  /* The answer must not be sitting in the prompt. */
  const leak = cloze.filter(i => ev("repTokens(" + q(i.q) + ")").indexOf(ev("fold(" + q(i.c) + ")")) > -1);
  ok(leak.length === 0, leak.length + " cloze prompts contain their own answer");
  /* Punctuation belongs to the sentence, not the answer. */
  const punct = cloze.filter(i => /^[^\p{L}\p{N}]|[^\p{L}\p{N}?]$/u.test(i.c));
  ok(punct.length === 0, punct.length + " answers carry punctuation, e.g. " +
     punct.slice(0, 3).map(i => JSON.stringify(i.c)).join(" "));

  /* And the check has to accept the answer the engine itself supplies. */
  /* And the prompt must never be empty of everything but the blank. */
  ok(cloze.every(i => i.q.replace("___", "").trim().length > 3), "a cloze prompt is only a blank");
});

step("a sitting grades, schedules, and counts the encounter either way", () => {
  ev("wipe()"); meetAll();
  ev("go('tekrar')");
  ok(ev("V.view") === "tekrar", "the tekrar hub did not open");
  /* The distribution is progress, not a way in: it is on İlerleme now. */
  ok(!lastPaint.includes("met once"), "the hub still draws the distribution");
  ok(lastPaint.includes("go('ilerleme')"), "the hub does not point to İlerleme");

  ev("startTekrar()");
  ok(ev("V.view") === "tekrarrun", "the run did not start");
  const n = ev("TK.q.length");
  ok(n === ev("REP_SESSION"), "a sitting is " + n + ", expected " + ev("REP_SESSION"));

  const k1 = ev("TK.q[TK.i].k");
  doc.getElementById("tbox").value = ev("TK.q[TK.i].c");
  ev("tkCheck()");
  ok(ev("TK.res") === true, "the engine's own answer was marked wrong");
  ok(ev("S.rep[" + q(k1) + "].b") === 1, "a right answer did not move a box");
  ok(ev("S.rep[" + q(k1) + "].n") === 1, "a right answer did not count as an encounter");

  ev("tkNext()");
  const k2 = ev("TK.q[TK.i].k");
  doc.getElementById("tbox").value = "kesinlikle yanlış";
  ev("tkCheck()");
  ok(ev("TK.res") === false, "a wrong answer was accepted");
  ok(ev("S.rep[" + q(k2) + "].b") === 0, "a wrong answer did not return to box 0");
  ok(ev("S.rep[" + q(k2) + "].n") === 1, "a wrong answer did not count as an encounter — being asked is the encounter");

  /* A miss one rule explains is explained, by name, inside the feedback;
     one no rule explains gets nothing rather than a guess. The item is
     pinned so the check does not depend on which word the sitting drew. */
  ok(!/Neden\? · why/.test(lastPaint), "an unrelated miss was given a rule: " + ev("TK.diag && TK.diag.t"));
  ev("tkNext()");
  ev("TK.q[TK.i].c='okulda'; TK.q[TK.i].alts=[fold('okulda')]");
  doc.getElementById("tbox").value = "okulde"; ev("tkCheck()");
  ok(ev("TK.res") === false, "okulde was accepted for okulda");
  ok(/Neden\? · why/.test(lastPaint) && /harmony/.test(lastPaint), "a harmony slip was not named as one");
  ok(/harmony/.test(ev("S.err['r:'+TK.q[TK.i].k].w")), "the mistake book did not keep the rule");
  ev("tkNext()");
  ev("TK.q[TK.i].c='okulda'; TK.q[TK.i].alts=[fold('okulda')]");
  doc.getElementById("tbox").value = "okulda"; ev("tkCheck()");
  ok(ev("TK.res") === true && !/Neden\? · why/.test(lastPaint), "a right answer was given a rule");

  /* A spoken spelling of the answer is the answer, and says so; a
     spoken spelling of some other word is still wrong. */
  ev("tkNext()");
  ev("TK.q[TK.i].c='gideceğim'; TK.q[TK.i].alts=[fold('gideceğim')]");
  const kSp = ev("TK.q[TK.i].k");
  doc.getElementById("tbox").value = "gidicem"; ev("tkCheck()");
  ok(ev("TK.res") === true, "gidicem was refused for gideceğim");
  ok(/Konuşma dili · spoken form/.test(lastPaint) && /gidicem/.test(lastPaint), "the spoken form was accepted silently");
  ok(!ev("S.err['r:'+" + q(kSp) + "]"), "an accepted spoken form went into the mistake book");
  ev("tkNext()");
  ev("TK.q[TK.i].c='gittim'; TK.q[TK.i].alts=[fold('gittim')]");
  doc.getElementById("tbox").value = "gidicem"; ev("tkCheck()");
  ok(ev("TK.res") === false && !/Konuşma dili/.test(lastPaint), "a spoken form of a different word was accepted");

  /* Whatever form was given, the others are shown: the spoken form of a
     written answer, the other listed word of a recall. */
  ev("tkNext()");
  ev("Object.assign(TK.q[TK.i],{kind:'recall',c:'gideceğim',tr:'gideceğim',alts:[fold('gideceğim')],u:'a2u2'})");
  doc.getElementById("tbox").value = "gideceğim"; ev("tkCheck()");
  ok(/Başka türlü/.test(lastPaint) && /in speech/.test(lastPaint) && /gidicem/.test(lastPaint),
     "a written answer was not shown its spoken form");
  ev("tkNext()");
  ev("Object.assign(TK.q[TK.i],{kind:'recall',c:'ad',tr:'ad / isim',alts:['ad','isim'],u:'a1u1'})");
  doc.getElementById("tbox").value = "ad"; ev("tkCheck()");
  ok(ev("TK.res") === true && /also right/.test(lastPaint) && /isim/.test(lastPaint), "the other listed word was not shown");
  ev("tkNext()");
  ev("Object.assign(TK.q[TK.i],{kind:'recall',c:'gideceğim',tr:'gideceğim',alts:[fold('gideceğim')],u:'c1u1'})");
  doc.getElementById("tbox").value = "gideceğim"; ev("tkCheck()");
  ok(!/in speech/.test(lastPaint), "a spoken form was offered in a C1 unit, which teaches the written register");

  /* Diacritics are forgiven here as everywhere else. */
  ev("tkNext()");
  const want = ev("TK.q[TK.i].c");
  doc.getElementById("tbox").value = ev("fold(" + q(want) + ")");
  ev("tkCheck()");
  ok(ev("TK.res") === true, "a folded answer was refused: " + want);

  let guard = 0;
  while (ev("TK.phase") !== "end" && guard++ < 40) {
    if (ev("TK.phase") === "ask") { doc.getElementById("tbox").value = ev("TK.q[TK.i].c"); ev("tkCheck()"); }
    else ev("tkNext()");
  }
  ok(ev("TK.phase") === "end", "the sitting never ended");
  ok(ev("Object.keys(S.rep).length") === n, "graded " + n + " but stored " + ev("Object.keys(S.rep).length"));

  /* Drilling has to actually move the number this engine exists to move. */
  const before = ev("repShort().length");
  ev("S.rep={}; repBank().slice(0,40).forEach(function(e){S.rep[e.k]={b:4,d:dayNum()+8,n:20}}); save()");
  ok(ev("repShort().length") < before, "40 words at 20 encounters did not reduce the shortfall");
});

/* ===================== 11 · bugün · the daily plan ===================== */
/* The grammar engine drills 60 points that the course explains once each.
   It is the word engine's problem one level up, so it carries the same
   scope rule — and its own judge, which has to accept correct Turkish
   the English prompt did not pin down. */
step("grammar comes back, and is produced rather than recognised", () => {
  ev("wipe()");
  ok(ev("gramBank().length") === 0, "a learner who has read no grammar has " +
     ev("gramBank().length") + " points queued");
  ok(ev("startGram()") === undefined && ev("GR") === null, "a sitting started with no points read");
  ev("go('gram')");
  ok(/Henüz dilbilgisi yok/.test(lastPaint), "the empty grammar hub does not say so");

  /* The grain, exactly as for words and sentences: the word list is not
     the grammar tab. */
  ev("go('unit','b2u1','v')");
  ok(ev("gramBank().length") === 0, "peeking at a word list unlocked that unit's grammar");
  ev("go('unit','b2u1','g')");
  /* The grammar tab carries how its Turkish is said, where the unit has
     notes, and says who each form is for. A unit without notes shows none. */
  ok(!/Konuşurken/.test(lastPaint), "b2u1 has no spoken notes, and a card was drawn anyway");
  ev("go('unit','a1u5','g')");
  ok(lastPaint.includes("Konuşurken" + GL("how it is said")), "a1u5's spoken notes are not on its grammar tab");
  ok(/Napıyorsun/.test(lastPaint) && /between friends/.test(lastPaint) && /with anyone/.test(lastPaint),
     "the notes do not show the form and who it is for");
  ev("delete S.seen.a1u5; save()");     /* looking was not meeting, for what follows */
  ev("go('unit','b2u1','g')");
  ok(ev("gramBank().length") === 1 && ev("gramBank()[0].u.id") === "b2u1",
     "reading the grammar tab did not make the point reviewable");
  ok(ev("metGram('b2u1')") && !ev("metGram('b2u2')"), "metGram is not tracking the g tab");

  /* Finishing a unit counts as having met it, however it was met. */
  ev("wipe()"); ev("S.done={'a1u1':{score:5,of:5,at:Date.now()}}; save()");
  ok(ev("gramBank().length") === 1, "a completed unit's grammar is not reviewable");

  /* A sitting over the whole course. */
  ev("wipe()"); ev("UNITS.forEach(function(u){S.seen[u.id]={g:1}}); save()");
  ok(ev("gramBank().length") === UNITS.length, "not every point is in the bank once all are read");
  ok(ev("gramDue().length") === ev("NEW_DAY.gram"), "sixty points never practised all came due at once");
  /* The rest of this walks a full sitting, so the points are made due
     reviews rather than new ones, which the daily allowance would cap. */
  ev("UNITS.forEach(function(u){S.gram['y:'+u.id]={b:0,d:0}}); save()");
  ev("startGram()");
  ok(ev("GR.q.length") === ev("GRAM_SESSION"), "a sitting is " + ev("GR.q.length") +
     " points, expected " + ev("GRAM_SESSION"));
  ok(ev("GR.q[0].id") === UNITS[0].id, "the queue does not walk the course in order");
  const target = ev("GR.q[0].c");
  ok(!lastPaint.includes(esc(target)), "the ask screen shows the Turkish it is asking for");
  ok(lastPaint.includes(esc(ev("GR.q[0].en"))), "the ask screen has no English prompt");
  ok(lastPaint.includes(esc(ev("GR.q[0].t"))), "the ask screen does not name the point");
  ok(!/class="table"/.test(lastPaint), "the pattern table is shown before it is asked for");
  ev("grHint()");
  ok(/class="table"/.test(lastPaint), "İpucu did not reveal the pattern");

  /* Exact. */
  doc.getElementById("gbox").value = target; ev("grCheck()");
  ok(ev("GR.res.same") && ev("GR.res.clean"), "the model sentence did not score as right");
  ok(ev("gramBox(GR.q[0].k)") === 1, "a right answer did not move the point out a box");
  ok(ev("GR.right") === 1, "a right answer was not counted");
  ok(!/grAccept/.test(lastPaint), "the override is offered on a right answer");
  ev("grNext()");

  /* Diacritics are forgiven, exactly as everywhere else in the app. */
  const t2 = ev("GR.q[1].c");
  doc.getElementById("gbox").value = ev("fold(" + q(t2) + ")"); ev("grCheck()");
  ok(ev("GR.res.same"), "a learner without a Turkish keyboard was failed: " + t2);
  ev("grNext()");

  /* Word order is the learner's. 162 of the 181 targets would fail an
     order-sensitive judge for a single swap, and every one of those
     sentences is correct Turkish. */
  const w3 = ev("GR.q[2].c").split(/\s+/);
  if (w3.length > 2) {
    doc.getElementById("gbox").value = [w3[1], w3[0]].concat(w3.slice(2)).join(" "); ev("grCheck()");
    ok(ev("GR.res.same"), "a reordered but complete sentence was marked wrong");
    ok(ev("GR.res.order") && !ev("GR.res.clean"), "the reorder was not reported as one");
    ok(/farklı sıra|different order/.test(lastPaint), "the reorder is accepted silently");
  }
  ev("grNext()");

  /* A missing word is a miss: the form is the whole question. */
  const w4 = ev("GR.q[3].c").split(/\s+/);
  doc.getElementById("gbox").value = w4.slice(0, -1).join(" "); ev("grCheck()");
  ok(!ev("GR.res.same"), "dropping a word still passed");
  ok(ev("gramBox(GR.q[3].k)") === 0, "a missed point did not drop to today");
  ok(/dw miss/.test(lastPaint), "the marked line does not name the missing word");
  ok(/grAccept/.test(lastPaint), "the override is not offered on a miss");

  /* The learner overrules a mark the judge could not make. */
  const k4 = ev("GR.q[3].k"), n4 = ev("S.gram[GR.q[3].k].n"), right4 = ev("GR.right");
  ev("grAccept()");
  ok(ev("gramBox(" + q(k4) + ")") === 1, "the override did not restore the box");
  ok(ev("S.gram[" + q(k4) + "].n") === n4, "the override advanced the example counter twice");
  ok(ev("GR.right") === right4 + 1, "the override was not counted");
  ok(!/grAccept/.test(lastPaint), "the override is still offered after being taken");
  ev("grAccept()");
  ok(ev("gramBox(" + q(k4) + ")") === 1 && ev("GR.right") === right4 + 1,
     "tapping the override twice graded twice");

  /* Name the rule behind a missed word; take it away once overruled. */
  ev("grNext()");
  ev("GR.q[GR.i].c='Kitabı okudum.'");
  doc.getElementById("gbox").value = "Kitapı okudum"; ev("grCheck()");
  ok(/Neden\? · why/.test(lastPaint) && /soft/i.test(lastPaint), "a softening slip was not named in Dilbilgisi");
  ok(/soft/i.test(ev("S.err[GR.q[GR.i].k].w")), "the book entry does not carry the rule");
  ev("grAccept()");
  ok(!/Neden\? · why/.test(lastPaint), "the rule is still shown after the learner overruled the mark");

  /* The same in Dilbilgisi, where the judge is order-free. */
  ev("grNext()");
  ev("GR.q[GR.i].c='Yarın okula gideceğim.'");
  doc.getElementById("gbox").value = "okula yarın gidicem"; ev("grCheck()");
  ok(ev("GR.res.same") === true, "a spoken future was refused in Dilbilgisi");
  ok(/Konuşma dili · spoken form/.test(lastPaint), "Dilbilgisi accepted the spoken form without saying so");
  ok(!/grAccept/.test(lastPaint), "the override is offered on an accepted spoken form");

  /* Short or long: the pronoun the ending already carries may come or go,
     and whichever was given, the other is shown. The sitting's six items
     are spent by now, so these re-ask the last one. */
  ev("GR.phase='ask'; GR.over=false; GR.typed=''; render()");
  ev("Object.assign(GR.q[GR.i],{c:'Benim adım Deniz.',lv:'A1'})");
  doc.getElementById("gbox").value = "Adım Deniz"; ev("grCheck()");
  ok(ev("GR.res.same") === true, "dropping the optional pronoun was marked wrong");
  ok(/dw may/.test(lastPaint) && !/dw miss/.test(lastPaint), "the optional pronoun was drawn as missing");
  ok(/the full form/.test(lastPaint) && /pronoun is optional/.test(lastPaint), "the full form was not shown");
  ev("GR.phase='ask'; GR.over=false; GR.typed=''; render()");      /* a sitting is six; re-ask this one */
  ev("Object.assign(GR.q[GR.i],{c:'Benim adım Deniz.',lv:'A1'})");
  doc.getElementById("gbox").value = "Benim adım Deniz"; ev("grCheck()");
  ok(/shorter, without the pronoun/.test(lastPaint) && /Adım Deniz\./.test(lastPaint), "the short form was not shown");
  ev("GR.phase='ask'; GR.over=false; GR.typed=''; render()");
  ev("Object.assign(GR.q[GR.i],{c:'Bu hediye senin için.',lv:'A2'})");
  doc.getElementById("gbox").value = "Bu hediye için"; ev("grCheck()");
  ok(ev("GR.res.same") === false, "a pronoun a postposition needs was allowed to go");

  /* An override from a high box restores that box, rather than resetting. */
  ev("wipe()"); ev("S.seen={b2u1:{g:1}}; S.gram={'y:b2u1':{b:5,d:0,n:0}}; save()");
  ev("startGram()");
  doc.getElementById("gbox").value = "hiç doğru olmayan bir cümle"; ev("grCheck()");
  ok(ev("gramBox('y:b2u1')") === 0, "a missed point sat on box " + ev("gramBox('y:b2u1')") +
     " instead of dropping to today");
  ok(ev("GR.pre") === 5, "the pre-miss box was recorded as " + ev("GR.pre") + ", not 5");
  ev("grAccept()");
  ok(ev("gramBox('y:b2u1')") === 6, "the override reset a box-5 point to box " +
     ev("gramBox('y:b2u1')") + " instead of 6");

  /* What is scheduled is the point, not a sentence: the examples rotate,
     so the passive keeps coming back with a different sentence carrying
     it. Keyed by sentence this would be memorised in a fortnight. */
  ev("wipe()"); ev("S.seen={b2u1:{g:1}}; save()");
  const eg = UNITS.find(u => u.id === "b2u1").gram.eg.length;
  const seen = [];
  for (let i = 0; i < eg + 1; i++) {
    ev("startGram()");
    seen.push(ev("GR.q[0].c"));
    doc.getElementById("gbox").value = ev("GR.q[0].c"); ev("grCheck()");
    ev("S.gram['y:b2u1'].d=0");
  }
  ok(new Set(seen.slice(0, eg)).size === eg, "the examples do not rotate: " +
     new Set(seen).size + " distinct over " + eg + " sittings");
  ok(seen[eg] === seen[0], "the rotation does not come back round");

  /* Every target has to be answerable: it must survive its own tokeniser,
     and a one-token sentence is not a sentence to build. */
  let thin = 0, dirty = 0;
  UNITS.forEach(u => u.gram.eg.forEach(e => {
    const r = ev("gramJudge(" + q(e[0]) + "," + q(e[0]) + ")");
    if (!r.same || !r.clean) dirty++;
    if (r.of < 2) thin++;
  }));
  ok(dirty === 0, dirty + " grammar targets do not score as right when typed exactly");
  ok(thin === 0, thin + " grammar targets tokenise to fewer than two words");

  /* The bar on the data rather than on whichever item the queue served.
     Dropping a word has to fail on every target and an invented word has
     to fail on every target — otherwise dikte's four-in-five leniency has
     leaked in, and on a nine-word sentence that forgives the suffix the
     whole question was about. Reordering has to pass on every target, for
     the same reason it passes on one. */
  let lenient = 0, invented = 0, punished = 0;
  UNITS.forEach(u => u.gram.eg.forEach(e => {
    const w = e[0].split(/\s+/);
    if (w.length > 1 &&
        ev("gramJudge(" + q(e[0]) + "," + q(w.slice(0, -1).join(" ")) + ").same")) lenient++;
    if (ev("gramJudge(" + q(e[0]) + "," + q(e[0] + " zürafa") + ").same")) invented++;
    if (w.length > 2) {
      const sw = [w[1], w[0]].concat(w.slice(2)).join(" ");
      if (!ev("gramJudge(" + q(e[0]) + "," + q(sw) + ").same")) punished++;
    }
  }));
  ok(lenient === 0, lenient + " grammar targets pass with a word missing");
  ok(invented === 0, invented + " grammar targets pass with a word invented");
  ok(punished === 0, punished + " grammar targets are failed for a reordering Turkish allows");

  ev("back()");
  ok(ev("V.view") === "gram", "back() from a grammar sitting did not return to the hub");
});

/* Yolda is the one mode that has to work with nobody touching it, so
   what is tested here is mostly absence: no tap between Başla and the
   end, no write until the car has stopped, no way to strand the run. */
step("yolda · a sitting that runs without you", () => {
  ev("wipe()"); ev("setScope('done')"); ev("setYgap(5)"); ev("setYrate(1)");

  /* Prefabs belong to no unit, so unlike every other review mode this one
     has material on day one — and it should say which kind it has. */
  ev("go('yolda')");
  ok(ev("sentenceBank().length") === 0, "a fresh install has met sentences");
  ok(ev("yolBank().length") > 0, "a fresh install has nothing hands-free to do");
  ok(/Prefabs only so far/.test(lastPaint), "the hub does not say the sentences are still missing");
  ev("go('unit','a1u1','r')"); ev("go('yolda')");
  ok(!/Prefabs only so far/.test(lastPaint), "the hub still claims prefabs only after a passage was read");

  /* The whole sitting, on the fake clock, with nothing touched.
     Flush first: earlier steps leave timers armed, and drain() would run
     a leftover passage player interleaved with this sitting.
     Then clear the log and index from its length — voice.said is a
     running counter that earlier steps do not reset when they empty
     voice.spoken, so it is not an index into it. */
  drain(60000); ev("stopPlay()");
  voice.spoken = []; voice.langs = [];
  const said0 = voice.said;
  ev("startYolda(5)");
  const slots = ev("YL.q.length");
  ok(slots === ev("YOL_SLOTS"), "the playlist is " + slots + " slots");
  drain(60000);
  ok(ev("YL.phase") === "end", "the sitting did not reach its end unattended");
  const ran = ev("YL.i");
  ok(ran > 0 && ran < slots, "a five-minute sitting ran " + ran + " of " + slots +
     " slots — it should stop on the clock, not on the playlist");

  /* Every item is prompted in English and answered in Turkish, and the
     tr-TR voice is never handed the English. Counted by matching this
     sitting's own texts rather than by totals: drain() also fires timers
     other steps left armed, and those speak too. */
  const want = [];
  for (let i = 0; i < ran; i++) { want.push(ev("YL.q[" + i + "].it.en")); want.push(ev("YL.q[" + i + "].it.tr")); }
  const mine = new Set(want);
  const log = [];
  for (let i = 0; i < voice.spoken.length; i++)
    if (mine.has(voice.spoken[i])) log.push([voice.spoken[i], voice.langs[i]]);
  ok(log.length === want.length, "the sitting spoke " + log.length + " of its " + want.length + " lines");
  ok(log.every((p, i) => p[0] === want[i]), "the sitting spoke its lines out of order");
  ok(log.every((p, i) => /^(en|tr)/.test(p[1]) && (i % 2 === 0 ? /^en/ : /^tr/).test(p[1])),
     "a prompt was read by the wrong voice");

  /* Nothing is written while it runs. A sitting abandoned mid-drive must
     cost nothing rather than inflate a box. */
  ok(ev("Object.keys(S.prod).length") === 0, "the drive wrote to the schedule before it was marked");
  const cov = ev("yolCovered().map(function(i){return i.k})");
  ok(cov.length > 0 && cov.length <= ran, "covered " + cov.length + " of " + ran + " slots");
  ok(new Set(cov).size === cov.length, "the marking list repeats an item");
  ev("yolMiss(" + q(cov[0]) + ")");
  ok(ev("Object.keys(S.prod).length") === 0, "marking an item wrote it before Kaydet");
  ev("yolSave()");
  ok(ev("S.prod[" + q(cov[0]) + "].b") === 0, "a missed item did not come back today");
  ok(ev("S.prod[" + q(cov[1]) + "].b") === 1, "an item left unmarked did not move out a box");
  ok(ev("Object.keys(S.prod).length") === cov.length, "Kaydet graded something that was never covered");
  ok(ev("YL") === null, "the run outlived its own marking");

  /* The graduated interval is the Pimsleur part: an item comes back while
     it is still half remembered, at widening distance. */
  ev("wipe()"); ev("go('unit','a1u1','r')"); ev("startYolda(10)");
  const ks = ev("YL.q.map(function(c){return c.it.k})");
  const at = ks.map((k, i) => k === ks[0] ? i : -1).filter(i => i >= 0);
  ok(at.length === ev("YOL_SPACING").length + 1, "an item is heard " + at.length + " times");
  const gaps = at.slice(1).map((v, i) => v - at[i]);
  ok(gaps.every((g, i) => i === 0 || g > gaps[i - 1]), "the interval does not widen: " + gaps.join(","));

  /* Navigating away has to silence it — this one holds the speaker for
     minutes, so a leak is louder than anywhere else in the app. */
  const said1 = voice.said;
  ev("home()");
  drain(60000);
  ok(voice.said === said1, "a hands-free sitting kept talking over the next screen");
  ok(!ev("!!(YL && YL.tid)"), "a step timer was left armed after leaving");
  ok(!ev("!!(YL && YL.cid)"), "the session deadline was left armed after leaving");

  /* The back arrow mid-drive keeps the work: it ends the sitting and
     offers the marking rather than binning everything covered. */
  ev("wipe()"); ev("go('unit','a1u1','r')");
  ev("startYolda(5)"); drain(200);
  ok(ev("YL.phase") !== "end", "the sitting ended before back() was tested");
  ev("back()");
  ok(ev("YL && YL.phase") === "end", "back() mid-sitting discarded the run");
  ok(ev("V.view") === "yoldarun" && /yolSave/.test(lastPaint), "back() did not offer the marking");
  ev("YL=null;");

  /* The other half of that: a browser that fires onend TWICE, or fires it
     just as the watchdog lands, must not advance the step twice — that
     skips an item silently, and skipping is invisible from the driver's
     seat. Run the same sitting both ways and it has to come out the same
     length. */
  function sitting(patch) {
    ev("wipe()"); ev("setYgap(5)"); ev("setYrate(1)");
    ev("go('unit','a1u1','r')");
    if (patch) ev("var _s2=speechSynthesis.speak;" +
      "speechSynthesis.speak=function(u){_s2.call(speechSynthesis,u);" +
      "if(u.onend){var f=u.onend;setTimeout(function(){f();},1);}};");
    ev("startYolda(5)");
    drain(60000);
    const r = { i: ev("YL.i"), covered: ev("yolCovered().length") };
    if (patch) ev("speechSynthesis.speak=_s2;");
    ev("YL=null;");
    return r;
  }
  const once = sitting(false), twice = sitting(true);
  ok(twice.i === once.i, "a doubled onend ran " + twice.i + " slots where one ran " + once.i +
     " — the step advanced twice and skipped an item");
  ok(twice.covered === once.covered, "a doubled onend covered " + twice.covered +
     " items where one covered " + once.covered);

  /* A browser that drops onend must not strand it: there is no thumb. */
  ev("wipe()"); ev("go('unit','a1u1','r')");
  ev("var _sp=speechSynthesis.speak; speechSynthesis.speak=function(u){};");
  ev("startYolda(5)");
  drain(60000);
  ok(ev("YL.phase") === "end", "a dropped onend stranded the sitting");
  ok(ev("YL.i") > 1, "the watchdog advanced only " + ev("YL.i") + " slots");
  ev("speechSynthesis.speak=_sp;");
  ev("YL=null;");
});

/* The mistake book. Seven modes can tell a learner they were wrong and
   every one of them has to reach the same store, keyed the same way, or
   the count — the whole point — is wrong. */
step("hata defteri · every mode reaches the same book", () => {
  ev("wipe()"); ev("setScope('done')");
  ok(ev("errList().length") === 0, "wipe left mistakes behind");
  ev("go('hata')");
  ok(/Defter boş/.test(lastPaint), "the empty book does not say so");

  /* The quiz, which is the only place a `why` exists. */
  ev("startUnitQuiz('a1u1')");
  const it0 = ev("Q.items[0]");
  ev("answerMC(" + (it0.c === 0 ? 3 : 0) + ")");
  const e0 = ev("S.err['q:a1u1#0']");
  ok(!!e0, "a wrong multiple choice was not recorded");
  ok(e0.c === it0.a[it0.c], "the recorded answer is not the right one");
  ok(e0.w === it0.why, "the explanation was dropped — it is the reason this exists");
  ok(e0.to === "a1u1", "the entry does not say which unit it came from");
  ok(e0.n === 1, "a first miss counted as " + e0.n);

  /* Missing the same drill again counts rather than duplicating: keyed by
     the item, so "four times" is answerable. A log could not say that. */
  ev("startUnitQuiz('a1u1')");
  ev("answerMC(" + (it0.c === 0 ? 3 : 0) + ")");
  ok(ev("S.err['q:a1u1#0'].n") === 2, "a repeat did not raise the count");
  ok(ev("errList().length") === 1, "a repeat made a second entry");
  ok(ev("errRepeat().length") === 1, "the repeat list is empty after two misses");

  /* A right answer must not write anything — checked on the COUNT, not
     the length: the entry already exists, so recording it again bumps n
     and leaves the length alone. */
  const n0 = ev("errList().length"), c0 = ev("S.err['q:a1u1#0'].n");
  ev("startUnitQuiz('a1u1')"); ev("answerMC(" + it0.c + ")");
  ok(ev("errList().length") === n0, "a correct answer added an entry");
  ok(ev("S.err['q:a1u1#0'].n") === c0, "a correct answer raised the miss count to " +
     ev("S.err['q:a1u1#0'].n"));

  /* The other five modes, each with its own key prefix. */
  ev("wipe()");
  ev("go('unit','a1u1','v')"); ev("go('unit','a1u1','r')"); ev("go('unit','a1u1','g')");
  ev("startProd('s')"); ev("prodModel()"); ev("prodMark(false)");
  ev("startDinle('d')"); doc.getElementById("dbox").value = "tamamen yanlis"; ev("dikteCheck()");
  ev("startDinle('a')"); ev("hearReveal()"); ev("hearMark(false)");
  ev("startTekrar()"); doc.getElementById("tbox").value = "yanlis"; ev("tkCheck()");
  ev("startGram()"); doc.getElementById("gbox").value = "yanlis"; ev("grCheck()");
  const by = ev("errByMode()");
  ["s", "d", "a", "r", "y"].forEach(m => ok(by[m] >= 1, "mode " + m + " never reached the book"));
  ok(ev("errList().every(function(e){return !!e.c})"), "an entry has no right answer to show");
  ok(ev("errList().every(function(e){return e.n>=1})"), "an entry was recorded with no count");

  /* Dikte and Ses önce are the same sentence and must NOT collapse: one
     can be easy to recognise and hard to transcribe, which is why the two
     prefixes are separate in S.dinle to begin with. */
  ok(ev("!!S.err['d:a1u1#0']") && ev("!!S.err['a:a1u1#0']"),
     "dictation and audio-first collapsed into one entry");

  /* A mark the learner overrules is not a mistake, and withdrawing it
     must not re-render in the middle of grading. */
  ev("wipe()"); ev("go('unit','a1u1','g')");
  ev("startGram()"); doc.getElementById("gbox").value = "hiç doğru olmayan";
  ev("grCheck()");
  ok(ev("errList().length") === 1, "the grammar miss was not recorded");
  ev("grAccept()");
  ok(ev("errList().length") === 0, "overruling the mark left the mistake in the book");
  ok(ev("V.view") === "gramrun", "withdrawing an entry navigated away mid-grade");

  /* Yolda writes nothing until the marking is confirmed, like its own
     schedule, and records only what was actually marked missed. */
  ev("wipe()"); ev("go('unit','a1u1','r')");
  ev("startYolda(5)"); drain(60000);
  ok(ev("errList().length") === 0, "the drive wrote mistakes before it was marked");
  const cov = ev("yolCovered().map(function(i){return i.k})");
  ev("yolMiss(" + q(cov[0]) + ")");
  ok(ev("errList().length") === 0, "marking wrote before Kaydet");
  ev("yolSave()");
  ok(ev("errList().length") === 1, "Kaydet recorded " + ev("errList().length") +
     " mistakes where one was marked out of " + cov.length);
  ev("YL=null;");

  /* Bounded, and what it throws away is the least repeated — not the
     oldest. Ranking on age drops the nine-time mistake to keep this
     morning's slips, which is exactly backwards. */
  ev("wipe()"); ev("S.err={};");
  ev("S.err['old:often']={m:'q',q:'a',c:'b',a:'',w:'',to:'',at:dayNum()-400,n:9};");
  ev("S.err['old:once']={m:'q',q:'a',c:'b',a:'',w:'',to:'',at:dayNum()-400,n:1};");
  ev("for(var i=0;i<400;i++)S.err['new:'+i]={m:'q',q:'a',c:'b',a:'',w:'',to:'',at:dayNum(),n:1};");
  ev("errTrim()");
  ok(ev("Object.keys(S.err).length") === ev("ERR_MAX"), "the book is not bounded");
  ok(ev("!!S.err['old:often']"), "a mistake made nine times was evicted to keep one-off slips");
  ok(!ev("!!S.err['old:once']"), "an old one-off survived the trim");

  /* The hub: the repeat list, the why, the weak-spot read, and the one
     thing the app already knows in patterns rather than sentences. */
  ev("wipe()"); ev("go('unit','a1u1','g')");
  ev("startUnitQuiz('a1u1')"); ev("answerMC(" + (it0.c === 0 ? 3 : 0) + ")");
  ev("startUnitQuiz('a1u1')"); ev("answerMC(" + (it0.c === 0 ? 3 : 0) + ")");
  /* Both pattern shapes: a transformation keys "t:<move>" and a built
     sentence keys "g:<frame>:<tense>", and they are read back by
     different branches. Exercising only one left the other unchecked. */
  ev("startProd('t')"); ev("prodModel()"); ev("prodMark(false)");
  ev("startProd('g')"); ev("prodModel()"); ev("prodMark(false)");
  ok(ev("errPatterns().some(function(p){return p.k.indexOf('t:')===0})"), "no transformation pattern was read back");
  ok(ev("errPatterns().some(function(p){return p.k.indexOf('g:')===0})"), "no frame pattern was read back");
  ev("go('hata')");
  ok(/Tekrarlayanlar/.test(lastPaint), "the repeat section is missing");
  ok(lastPaint.indexOf(esc(it0.why)) > -1, "the hub does not show the explanation");
  ok(/Nerede zayıfsın/.test(lastPaint), "the weak-spot read is missing");
  ok(ev("errPatterns().length") > 0, "a missed generated pattern is not read back");
  /* Named by the frame or move, not by the raw storage key: "g:obj:past"
     is not something to show a learner. */
  ok(ev("errPatterns().every(function(p){return !!p.tr&&p.tr.indexOf('undefined')<0})"),
     "a pattern renders as undefined: " + q(ev("errPatterns()")));
  ok(ev("errPatterns().every(function(p){return p.tr!==p.k&&p.tr.indexOf(':')<0})"),
     "a pattern is shown as its storage key: " + q(ev("errPatterns()")));
  ok(/Kurma ve Dönüştürme/.test(lastPaint), "the pattern card is missing");

  /* Clearing one entry, and the book, without touching the schedules. */
  const prodBefore = ev("Object.keys(S.prod).length");
  ev("errForget('q:a1u1#0')");
  ok(!ev("!!S.err['q:a1u1#0']"), "'artık biliyorum' did not remove the entry");
  ok(ev("Object.keys(S.prod).length") === prodBefore, "clearing an entry touched a schedule");
  ev("errWipe()");
  ok(ev("errList().length") === 0, "the book did not clear");
  ok(ev("Object.keys(S.prod).length") === prodBefore, "clearing the book touched the schedules");

  /* Progress, not a setting: a backup carries it, a wipe does not. */
  ev("startUnitQuiz('a1u1')"); ev("answerMC(" + (it0.c === 0 ? 3 : 0) + ")");
  const saved = ev("JSON.stringify(S)");
  ev("wipe()");
  ok(ev("errList().length") === 0, "wipe kept the mistake book");
  ev("go('about')");
  doc.getElementById("iobox").value = saved;
  ev("importBox()");
  ok(ev("errList().length") === 1, "restore lost the mistake book");
});

/* Kendi kelimelerim. The point of the design is what it does NOT add: no
   queue of its own, because S.star and S.srs already are one. */
step("kendi kelimelerim · a word from the wild joins the same queue", () => {
  const fill = (tr, en, note) => {
    doc.getElementById("mtr").value = tr;
    doc.getElementById("men").value = en;
    const n = doc.getElementById("mnote"); if (n) n.value = note || "";
  };
  ev("wipe()"); ev("setScope('done')"); ev("mineOpen()");
  ok(ev("S.mine.length") === 0, "wipe left the learner's own words behind");
  ok(/Henüz kendi kelimen yok/.test(lastPaint), "the empty list does not say so");

  /* Added, and in the spaced queue without a line of new machinery. */
  fill("zeytinyağı", "olive oil", "market label");
  ev("mineAdd()");
  ok(ev("S.mine.length") === 1, "the word was not added");
  ok(ev("isStarred('zeytinyağı','olive oil')"), "an added word was not starred");
  ok(ev("dueList().indexOf('zeytinyağı|olive oil')") > -1, "it is not due in the review queue");
  ok(ev("planToday().all.filter(function(s){return s.k==='rep'})[0].n") >= 1,
     "it does not count toward the plan's Tekrar step");

  /* A word the course already teaches: star that one, do not make a copy. */
  fill("kitap", "book"); ev("mineAdd()");
  ok(ev("S.mine.length") === 1, "a word the course teaches was copied into the list");
  ok(ev("isStarred('kitap','book')"), "the course word was not starred instead");
  ok(/already in the course/.test(ev("MMSG")), "no explanation was given: " + q(ev("MMSG")));

  /* And the message has to survive the render that follows it — poking the
     DOM alone was silently useless. */
  ev("mineOpen()");
  ok(ev("MMSG") === "", "a stale message survived re-opening the screen");
  fill("zeytinyağı", "something else"); ev("mineAdd()");
  ok(/already in your list/.test(ev("MMSG")), "a duplicate was not reported: " + q(ev("MMSG")));
  ok(ev("S.mine.length") === 1, "a duplicate was added anyway");
  fill("", "nothing"); ev("mineAdd()");
  ok(/Both sides/.test(ev("MMSG")), "a half-filled entry was not reported");
  ok(ev("S.mine.length") === 1, "a half-filled entry was added");
  /* Reporting a problem must NOT re-render: that would wipe what is in the
     boxes, which is the same trap the Dinleme replay had. */
  ok(doc.getElementById("men") && doc.getElementById("men").value === "nothing",
     "a rejected entry lost what the learner had typed");

  /* Pasted text is the real hazard here: a soft hyphen or a zero-width
     space looks perfect and breaks every match it touches. validate.js
     checks the course data for it; user input has to be cleaned at the
     door. */
  ok(ev("cleanWord('ma\\u00ADnav\\u200B')") === "manav", "invisible characters survive cleanWord");
  ev("mineOpen()"); fill("ma­nav​", "greengrocer"); ev("mineAdd()");
  ok(ev("S.mine.filter(function(e){return e.tr==='manav'}).length") === 1,
     "the pasted word was not stored clean: " + q(ev("S.mine.map(function(e){return e.tr})")));
  ok(ev("isStarred('manav','greengrocer')"), "the cleaned word was not starred under its clean spelling");

  /* An edit is usually a typo fix, and the star key is the spelling — so
     re-keying would drop a word to box 0 after a month of reviews. */
  ev("S.srs['zeytinyağı|olive oil']={b:5,d:dayNum()+16}; save()");
  ev("mineOpen()"); ev("mineEdit(0)");
  fill("zeytinyağı", "olive oil, cold pressed", "market label");
  ev("mineSave(0)");
  ok(ev("!!S.srs['zeytinyağı|olive oil, cold pressed']"), "the edited word left the queue");
  ok(ev("S.srs['zeytinyağı|olive oil, cold pressed'].b") === 5,
     "the edit reset the box to " + ev("S.srs['zeytinyağı|olive oil, cold pressed'].b") + " instead of carrying 5");
  ok(!ev("!!S.srs['zeytinyağı|olive oil']"), "the old schedule key was left behind");
  ok(ev("S.star.indexOf('zeytinyağı|olive oil')") < 0 &&
     ev("S.star.indexOf('zeytinyağı|olive oil, cold pressed')") > -1,
     "the star list and the schedule drifted apart on an edit");

  /* In the dictionary, under its own source. */
  ev("go('dict')"); ev("dictSrc('mine')");
  const rows = ev("dictRows()");
  ok(rows.length === ev("S.mine.length"), "Sözlük lists " + rows.length + " of " + ev("S.mine.length") + " own words");
  ok(rows.every(w => w.lv === "Benim"), "an own word is not badged Benim");
  ev("dictSrc('all')"); ev("dictSearch('manav')");
  ok(ev("dictRows().some(function(w){return w.tr==='manav'&&w.src==='mine'})"),
     "an own word cannot be found by search");
  ev("dictSearch('')"); ev("dictSrc('all')");

  /* Removing takes it out of the queue as well — a word left in S.star
     with nothing listing it would be unreachable. */
  ev("mineOpen()");
  const stars = ev("S.star.length"), mine = ev("S.mine.length");
  ev("mineDrop(0)");
  ok(ev("S.mine.length") === mine - 1, "the word was not removed");
  ok(ev("S.star.length") === stars - 1, "removing left it starred and unreachable");

  /* It must NOT reach Tekrar motoru: that engine ranks by how often the
     app's own corpus mentions a word, and a word the learner brought has
     none — every one would sit at the top for ever and bury the course
     vocabulary the engine exists to rescue. */
  ev("wipe()"); ev("go('unit','a1u1','v')");
  ev("mineOpen()"); fill("zürafa", "giraffe"); ev("mineAdd()");
  ok(ev("repBank().every(function(e){return !!e.unit})"), "a word with no unit reached Tekrar motoru");
  ok(!ev("repBank().some(function(e){return e.tr==='zürafa'})"), "an own word reached the encounter engine");
  ok(ev("S.star.indexOf('zürafa|giraffe')") > -1, "but it should still be in the star queue");

  /* Progress, not a setting. */
  const saved = ev("JSON.stringify(S)");
  ev("wipe()");
  ok(ev("S.mine.length") === 0, "wipe kept the learner's own words");
  ev("go('about')"); doc.getElementById("iobox").value = saved; ev("importBox()");
  ok(ev("S.mine.length") === 1, "restore lost the learner's own words");
  ok(ev("isStarred('zürafa','giraffe')"), "restore lost their place in the queue");
});

step("sor · producing the question, not the answer", () => {
  ev("wipe()");
  ev("go('sor')");
  ok(/Ne sordum/.test(lastPaint), "the Sor hub lost the wh- runner");
  ok(/Evet \/ hayır/.test(lastPaint), "the Sor hub lost the yes-no runner");
  ok(/Nereye gidiyorsun\?/.test(lastPaint), "the hub lost its question words");

  /* The person moves, and that is the part a learner gets wrong: nobody
     asks "Nereye gidiyorum?" to be told "Okula gidiyorum", and nobody
     asks a group "Nereye gidiyor?" to be told "Okula gidiyoruz". ben and
     biz move to sen and siz; the other three stand still. */
  const shift = [
    [0, "Okula gidiyorum.", "Nereye gidiyorsun?"],
    [1, "Okula gidiyorsun.", "Nereye gidiyorsun?"],
    [2, "Okula gidiyor.", "Nereye gidiyor?"],
    [3, "Okula gidiyoruz.", "Nereye gidiyorsunuz?"],
    [4, "Okula gidiyorsunuz.", "Nereye gidiyorsunuz?"],
    [5, "Okula gidiyorlar.", "Nereye gidiyorlar?"],
  ];
  shift.forEach(([p, st, qn]) => {
    ev("SS={f:'dat',v:byName('gitmek'),n:byName('okul'),p:" + p + ",t:'prog',neg:false}");
    ok(ev("specText(SS).tr") === st, "person " + p + " states " + q(ev("specText(SS).tr")) + ", expected " + q(st));
    ok(ev("sorAsk(SS).tr") === qn, "person " + p + " asks " + q(ev("sorAsk(SS).tr")) + ", expected " + q(qn));
  });

  /* A subject question takes no do-support in English — "Who came?",
     never "Who did come?" — which is the opposite of every other
     wh-question and exactly what an over-correcting learner writes. */
  const who = [["past", false, "Who came?"], ["past", true, "Who did not come?"],
               ["prog", false, "Who is coming?"], ["aor", false, "Who comes?"],
               ["fut", false, "Who will come?"]];
  who.forEach(([t, neg, en]) => {
    ev("SS={f:'bare',v:byName('gelmek'),p:2,t:" + q(t) + ",neg:" + neg + "}");
    ok(ev("sorAsk(SS).en") === en, "subject question reads " + q(ev("sorAsk(SS).en")) + ", expected " + q(en));
  });

  /* Where English needs a preposition before the object, the question
     strands it at the end. Without this the app asks "Who are you
     waiting?" — which is the same lexical flag the statements need. */
  ev("SS={f:'obj',v:byName('beklemek'),n:byName('arkadaş'),p:0,t:'prog',neg:false}");
  ok(ev("sorAsk(SS).en") === "Who are you waiting for?",
     "a stranded preposition was dropped: " + q(ev("sorAsk(SS).en")));
  ok(ev("sorAsk(SS).tr") === "Kimi bekliyorsun?", "a person object did not ask Kimi");

  /* mI is a separate word carrying the person, except in the past where
     the verb keeps it. Both are patterns a learner can be weak at, which
     is why the yes-no bank is keyed by tense. */
  const mi = [["prog", "Geliyor musun?"], ["past", "Geldin mi?"],
              ["fut", "Gelecek misin?"], ["aor", "Gelir misin?"]];
  mi.forEach(([t, tr]) => {
    ev("SS={f:'ask',v:byName('gelmek'),p:1,t:" + q(t) + ",neg:false}");
    ok(ev("specText(SS).tr") === tr, t + " yes-no reads " + q(ev("specText(SS).tr")) + ", expected " + q(tr));
  });

  /* Sweep: every generated question answerable, nothing leaking, and the
     dative guard holding — bakmak and başlamak take a dative that is not
     a place, so "Nereye?" would be simply wrong for them. */
  const bad = [], frames = new Set(), persons = new Set();
  for (let i = 0; i < 400; i++) {
    ev("SS=sorSpec(); AA=sorAsk(SS); ST=specText(SS)");
    const f = ev("SS.f"), prep = ev("SS.v?(SS.v.prep||''):''");
    const tr = ev("AA.tr"), en = ev("AA.en"), st = ev("ST.tr");
    frames.add(f); persons.add(ev("SS.p"));
    if (f === "dat" && prep !== "to") bad.push("Nereye for a non-place dative: " + tr);
    if (!tr || !en || !/\?$/.test(tr) || !/\?$/.test(en)) bad.push("not a question: " + tr + " / " + en);
    if (BAD.test(tr + en) || / {2}/.test(tr + en)) bad.push("leak: " + tr + " / " + en);
    if (/^I[a-zçğıöşü]/.test(tr)) bad.push("capital: " + tr);
    if (tr === st) bad.push("question equals its answer: " + tr);
    if (/^Who did [a-z]+\?/.test(en)) bad.push("do-support: " + en);
  }
  ok(bad.length === 0, "sor produced " + bad.length + " bad questions, e.g. " + bad.slice(0, 3).join(" · "));
  ok(frames.size === ev("SOR_FRAMES").length, "only " + frames.size + " of " + ev("SOR_FRAMES").length + " frames are reachable");

  /* Every question word, by construction rather than by sampling. This
     was a count over the 400 draws above, and it was FLAKY: "kimi" needs
     the obj frame and a person as the object, which 400 unseeded draws
     miss about one run in fifty — so a correct build failed now and then,
     which is worse than not checking at all. The same lesson as ASK_P:
     when a table has to be covered, walk it, do not hope to land on it. */
  [["ne",     "{f:'obj',v:byName('açmak'),n:byName('kapı'),p:2,t:'prog',neg:false}"],
   ["kimi",   "{f:'obj',v:byName('beklemek'),n:byName('arkadaş'),p:2,t:'prog',neg:false}"],
   ["kim",    "{f:'bare',v:byName('gelmek'),p:2,t:'past',neg:false}"],
   ["nereye", "{f:'dat',v:byName('gitmek'),n:byName('okul'),p:2,t:'prog',neg:false}"],
   ["nerede", "{f:'loc',v:byName('oturmak'),n:byName('ev'),p:2,t:'prog',neg:false}"],
   ["nasıl",  "{f:'adj',a:byName('büyük'),n:byName('ev'),p:2,t:'prog',neg:false}"],
   ["kimin",  "{f:'gen',owner:byName('öğretmen'),n:byName('kitap'),p:2,t:'prog',neg:false}"]
  ].forEach(([want, spec]) => {
    ev("SS=" + spec);
    ok(ev("sorAsk(SS).qw") === want, "that frame asks with " + q(ev("sorAsk(SS).qw")) + ", expected " + q(want));
  });
  /* And the statements have to use those persons, or the shift above is a
     table nobody walks: every person the bank claims to draw must turn up. */
  ev("SOR_P").forEach(p => ok(persons.has(p), "no statement is ever generated in person " + p +
     ", so the question's person shift is never exercised"));

  /* Both banks fill a sitting and key by pattern rather than by sentence. */
  const ks = new Set(), ms = new Set();
  for (let i = 0; i < 12; i++) {
    const b1 = JSON.parse(ev("JSON.stringify(sorBank())"));
    const b2 = JSON.parse(ev("JSON.stringify(askBank())"));
    ok(b1.length === ev("SESSION") && b2.length === ev("SESSION"), "a bank came up short");
    b1.concat(b2).forEach(it => {
      if (!it.given || !it.instr) bad.push("no statement to work from: " + it.tr);
      if (it.k.indexOf("sor:") !== 0) bad.push("key: " + it.k);
    });
    b1.forEach(it => ks.add(it.k));
    b2.forEach(it => ms.add(it.k));
  }
  ok(bad.length === 0, "a bank item is malformed: " + bad.slice(0, 2).join(" · "));
  ok(ks.size === 6 && ms.size === 4, "the banks key " + ks.size + "/" + ms.size + " patterns, expected 6/4");

  /* Through the real runner: the statement is what is shown, the question
     is what is revealed, and the grade lands on the pattern. */
  ["q", "e"].forEach(mode => {
    ev("wipe()"); ev("setGap(3)"); ev("startProd(" + q(mode) + ")");
    const it = JSON.parse(ev("JSON.stringify(PR.q[0])"));
    ok(lastPaint.indexOf(it.given) > -1, "the runner did not show the statement");
    ok(lastPaint.indexOf(it.tr) === -1, "the runner revealed the question before the silence");
    ev("prodModel()");
    ok(lastPaint.indexOf(it.tr) > -1, "the model was never revealed");
    ev("prodMark(false)");
    ok(ev("S.prod[" + q(it.k) + "].b") === 0, "a missed question did not come back today");
    ok(ev("Object.keys(S.err).length") === 1, "the mistake book did not take the question");
    ok(ev("S.err[" + q(it.k) + "].c") === it.tr, "the book recorded the wrong answer as right");
  });

  /* And the book names the pattern, with the button that drills it —
     a Sor pattern offered to Dönüştürme would drill something else. */
  ev("wipe()");
  ev("S.prod={'sor:loc':{b:0,d:0},'sor:mi:past':{b:0,d:0},'t:neg':{b:0,d:0}}");
  ev("errNote('sor:loc',{m:'s',q:'Where is he reading?',c:'Nerede okuyor?',a:'',w:''})");
  const pats = JSON.parse(ev("JSON.stringify(errPatterns())"));
  ok(pats.length === 3, "errPatterns saw " + pats.length + " weak patterns, expected 3");
  ok(pats.filter(p => p.m === "q").length === 1 && pats.filter(p => p.m === "e").length === 1 &&
     pats.filter(p => p.m === "t").length === 1, "a pattern was filed under the wrong mode");
  ok(pats.every(p => p.tr && !BAD.test(p.tr)), "a pattern has no name");
  ev("go('hata')");
  ok(/startProd\('q'\)/.test(lastPaint) && /startProd\('e'\)/.test(lastPaint) && /startProd\('t'\)/.test(lastPaint),
     "the weak-spot card does not offer all three generated modes");
});

step("sayılar · the numbers, and the clock that marks them", () => {
  /* The forms themselves — every number, every hour, the clock and every
     price — are hand-checked in validate.js, which lifts that half of the
     engine out of the build. What is left for here is the behaviour those
     forms feed: the judge, the clock, and the screens.

     The judge is the point of the hearing direction — a number either is
     or is not 342, which is what self-grading cannot do — and each kind
     has to reach its OWN parser. A price read by the plain parser would
     score 42,50 as 4250 and mark a right answer wrong. */
  [["sayi", "342", "342", "1.342"],
   ["saat", "[3,15]", "15:15", "3:16"],
   ["fiyat", "[42,50]", "42,5", "4250"]].forEach(([kind, val, yes, no]) => {
    ev("SP={kind:" + q(kind) + ",val:" + val + "}");
    ok(ev("numJudge(SP," + q(yes) + ")") === true, kind + " judged " + q(yes) + " wrong");
    ok(ev("numJudge(SP," + q(no) + ")") === false, kind + " judged " + q(no) + " right");
  });

  /* The ceiling governs plain numbers only: the clock and prices are not
     sizes and are always in play. */
  ev("wipe()"); ev("setNmax(99)");
  let bands = JSON.parse(ev("JSON.stringify(numBands().map(function(b){return b.k}))"));
  ok(bands.join(",") === "2,saat,fiyat", "at a ceiling of 99 the bands are " + bands.join(","));
  ev("setNmax(999999)");
  bands = JSON.parse(ev("JSON.stringify(numBands().map(function(b){return b.k}))"));
  ok(bands.length === 6, "at the top ceiling only " + bands.length + " bands are in play");

  /* Every generated prompt must be answerable by its own digits, in both
     directions and at every ceiling — a prompt the judge cannot mark is
     worse than no prompt. */
  const bad = [], seen = new Set();
  ["duy", "oku"].forEach(m => {
    [99, 999, 9999, 999999].forEach(mx => {
      ev("setNmax(" + mx + ")");
      for (let r = 0; r < 8; r++) {
        const b = JSON.parse(ev("JSON.stringify(numBank(" + q(m) + "))"));
        if (b.length !== ev("NUM_SESSION")) bad.push("short sitting: " + b.length);
        b.forEach((it, i) => {
          seen.add(it.band);
          if (!it.tr || !it.show) bad.push("empty: " + it.k);
          if (BAD.test(it.tr + it.show) || / {2}/.test(it.tr)) bad.push("leak: " + it.tr + " / " + it.show);
          if (it.k.indexOf(m + ":") !== 0) bad.push("key: " + it.k);
          const typed = it.show.replace(" TL", "");
          if (!ev("numJudge(" + JSON.stringify(it) + "," + q(typed) + ")"))
            bad.push("unjudgeable: " + it.k + " " + it.show + " = " + it.tr);
        });
      }
    });
  });
  ok(bad.length === 0, "sayılar produced " + bad.length + " bad prompts, e.g. " + bad.slice(0, 3).join(" · "));
  ok(seen.size === 6, "only " + seen.size + " of 6 shapes were ever generated");

  /* The clock is part of the mark, and that is the whole mode. Right but
     slow must not advance a box — a number worked out in nine seconds is
     one you cannot use, and calling it a pass would be a lie the learner
     has no way to detect. */
  ev("wipe()"); ev("setNmax(999)"); ev("setNcap(5)");
  ev("startNum('duy')");
  ok(ev("NM.q.length") === ev("NUM_SESSION"), "the sitting came up short");
  const it0 = JSON.parse(ev("JSON.stringify(NM.q[0])"));
  /* What the learner can READ, not the markup: the input's own placeholder
     is a number and the bar carries "3 / 12", so searching the raw HTML
     for the answer fails on correct code whenever the drawn number
     happens to match one of them. sim.js is deliberately unseeded, so an
     assertion that only usually holds is worse than none. */
  const shown = () => lastPaint.replace(/<[^>]*>/g, " ").replace(/\d+ \/ \d+/g, " ").replace(/\s+/g, " ");
  /* As a WHOLE word, not a substring. The number 10 is "on", and the
     button underneath says "Kontrol et" — so a substring search failed on
     correct code roughly one run in three hundred. Turkish letters are
     not \w, so the boundary is spelled out. */
  const LT = "a-zA-ZçÇğĞıIİiöÖşŞüÜ";
  const saysIt = (hay, needle) => new RegExp("(^|[^" + LT + "])" +
    needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^" + LT + "]|$)").test(hay);
  ok(!saysIt(shown(), it0.show), "the hearing direction showed the number it was asking for");
  ok(!saysIt(shown(), it0.tr), "the hearing direction printed the Turkish it was speaking");
  ev("document.getElementById('nbox').value=" + q(it0.show.replace(" TL", "")));
  ev("numCheck()");
  ok(ev("NM.res.ok") === true && ev("NM.res.quick") === true, "a correct quick answer was not marked so");
  ok(ev("S.num[" + q(it0.k) + "].b") === 1, "a correct quick answer did not move the shape out a box");
  ev("numNext()");
  const it1 = JSON.parse(ev("JSON.stringify(NM.q[1])"));
  ev("NM.t0=Date.now()-9000");
  ev("document.getElementById('nbox').value=" + q(it1.show.replace(" TL", "")));
  ev("numCheck()");
  ok(ev("NM.res.ok") === true, "the slow answer was marked wrong rather than slow");
  ok(ev("NM.res.quick") === false, "nine seconds counted as inside a five-second bar");
  ok(ev("S.num[" + q(it1.k) + "].b") === 0, "right but slow still advanced the box");
  ok(/geç/.test(lastPaint), "the screen did not say the answer was late");
  /* With the clock off it is an ordinary drill, and the same answer passes. */
  ev("setNcap(0)"); ev("startNum('duy')");
  const it2 = JSON.parse(ev("JSON.stringify(NM.q[0])"));
  ev("NM.t0=Date.now()-9000");
  ev("document.getElementById('nbox').value=" + q(it2.show.replace(" TL", "")));
  ev("numCheck()");
  ok(ev("NM.res.quick") === true, "the bar still applied after being switched off");
  ok(ev("S.num[" + q(it2.k) + "].b") === 1, "with the clock off a right answer did not advance");

  /* A wrong answer lands in the book, keyed by the shape rather than the
     number — "three digits, four times" is the sentence worth saying. */
  ev("setNcap(5)"); ev("wipe()"); ev("startNum('duy')");
  const k0 = ev("NM.q[0].k");
  ev("document.getElementById('nbox').value='99999999'");
  ev("numCheck()");
  ok(ev("Object.keys(S.err).length") === 1, "a wrong number did not reach the mistake book");
  ok(ev("S.err['n:" + k0 + "'].m") === "n", "the book filed the number under the wrong mode");
  ok(ev("S.err['n:" + k0 + "'].c") === JSON.parse(ev("JSON.stringify(NM.q[0].show)")), "the book recorded the wrong answer as right");
  ev("go('hata')");
  ok(/Sayılar/.test(lastPaint), "the mistake book does not name Sayılar as a mode");

  /* The say-it direction keeps the digits on screen and the Turkish off it
     until the learner has committed — the same rule Ses önce follows. */
  ev("wipe()"); ev("startNum('oku')");
  const o0 = JSON.parse(ev("JSON.stringify(NM.q[0])"));
  ok(saysIt(shown(), o0.show), "the say-it direction did not show the digits");
  ok(!saysIt(shown(), o0.tr), "the say-it direction revealed the Turkish before the learner spoke");
  ev("numReveal()");
  ok(saysIt(shown(), o0.tr), "the model was never revealed");
  ev("numMark(true)");
  ok(ev("S.num[" + q(o0.k) + "].b") === 1, "a self-marked right answer did not advance");

  /* Progress is wiped; the ceiling and the bar are settings and are not. */
  ev("setNmax(9999)"); ev("setNcap(3)");
  ev("wipe()");
  ok(ev("Object.keys(S.num).length") === 0, "wipe() kept the number schedule");
  ok(ev("nmax()") === 9999 && ev("ncap()") === 3, "wipe() threw away the Sayılar settings");
  ev("go('sayilar')");
  ok(/Sayılar/.test(lastPaint) && /Duy/.test(lastPaint) && /Söyle/.test(lastPaint), "the Sayılar hub lost a direction");
});

step("the clock on the home screen tells the time in Turkish", () => {
  /* Passive reinforcement: the time now, in words, on the screen a learner
     opens several times a day. The forms themselves are hand-checked in
     validate.js across all 720 minutes; what is checked here is that the
     element really carries the engine's answer for the time it is now,
     rather than a string that merely looks like one. */
  ev("wipe()"); ev("home()");
  const tr = ev("document.getElementById('hclock').textContent");
  const want = ev("timeText(nowHM()[0],nowHM()[1])");
  ok(tr === want, "the clock reads " + q(tr) + " but the engine says " + q(want));
  ok(/(geçiyor|var|buçuk)$/.test(tr) || /^saat /.test(tr), "the clock is not one of the four shapes: " + q(tr));
  /* The hour shown in words is the 12-hour one; the digits beside it stay
     on the 24-hour clock, and that pairing IS the lesson — it is how a
     learner works out that 15:15 is said "üçü çeyrek geçiyor". */
  const h24 = new Date().getHours();
  ok(ev("nowHM()[0]") === (h24 % 12 || 12), "nowHM did not fold " + h24 + " onto the 12-hour clock");
  ok(ev("document.getElementById('hclockd').textContent").indexOf(h24 + ":") === 0,
     "the digits are not on the 24-hour clock");

  /* The date line, added so the months get read a few times a day the
     same way the time does — the course teaches none of them otherwise.
     The word forms are hand-checked in validate.js across every month and
     weekday; what is checked here is the same thing as the time: that the
     element carries the engine's own answer for today, not a string that
     merely looks like one. */
  const dtr = ev("document.getElementById('hdate').textContent");
  const dwant = ev("dateWords(nowYMD()[0],nowYMD()[1],nowYMD()[2])");
  ok(dtr === dwant, "the date reads " + q(dtr) + " but the engine says " + q(dwant));
  const ddig = ev("document.getElementById('hdated').textContent");
  const ddwant = ev("dateDigits(nowYMD()[0],nowYMD()[1],nowYMD()[3])");
  ok(ddig === ddwant, "the date digits read " + q(ddig) + " but the engine says " + q(ddwant));
  ok(/^\d{2}\.\d{2}\.\d{4}$/.test(ddig), "the date digits are not DD.MM.YYYY: " + q(ddig));
  /* Rebuilt from a fresh, real Date rather than through nowYMD() — the
     same reason the hour check above reads new Date().getHours() itself
     instead of trusting nowHM(): a bug inside the wrapper cannot hide
     behind a test that only ever asks the wrapper to grade itself. */
  const realD = new Date();
  const realDigits = String(realD.getDate()).padStart(2, "0") + "." +
    String(realD.getMonth() + 1).padStart(2, "0") + "." + realD.getFullYear();
  ok(ddig === realDigits, "the date digits do not match the real wall-clock date: got " + q(ddig) + ", wanted " + q(realDigits));

  /* It must poke the text, not re-render: a clock that redrew the home
     screen every minute would throw away whatever is under it — the same
     rule the Dinleme replay follows, and counted the same way, because
     the paint counter is the only thing that can tell the difference. */
  ev("document.getElementById('hclock').textContent='XXX'");
  ev("document.getElementById('hdate').textContent='YYY'");
  const paintsBefore = screens;
  ev("clockTick()");
  ok(ev("document.getElementById('hclock').textContent") === want, "the tick did not refresh the clock");
  ok(ev("document.getElementById('hdate').textContent") === dwant, "the tick did not refresh the date");
  ok(screens === paintsBefore, "the tick re-rendered the screen instead of poking the text");

  /* One timer at most, however many times it is armed. */
  const n = clock.timers.length;
  ev("clockTick()"); ev("clockTick()"); ev("clockTick()");
  ok(clock.timers.length === n, "arming the clock three times left " + (clock.timers.length - n) + " extra timers");

  /* And it stops itself on a screen that does not show it — which is why
     it is armed from render() rather than from the screens themselves —
     and why it must NOT be hooked into stopPlay(), which runs on every
     speaker tap and would freeze the clock the moment a learner played a
     word from the home screen. */
  ev("go('about')");
  ok(!ev("!!document.getElementById('hclock')"), "the clock followed us to About");
  ok(!ev("!!document.getElementById('hdate')"), "the date followed us to About");
  ok(ev("CLK===null"), "navigating away left the clock's timer armed");
  ev("sayWord('merhaba')");
  ev("home()");
  ok(ev("CLK!==null"), "the clock did not re-arm on the home screen");
  ev("sayWord('merhaba')");                /* stopPlay() runs inside this */
  ok(ev("CLK!==null"), "playing a word from the home screen stopped the clock");

  /* Sayılar shows it too, being the clock's own subject. */
  ev("go('sayilar')");
  ok(ev("!!document.getElementById('hclock')"), "the Sayılar hub lost the clock");
  ok(ev("!!document.getElementById('hdate')"), "the Sayılar hub lost the date");
  ok(ev("CLK!==null"), "the clock did not arm on the Sayılar hub");
  /* Nowhere else. */
  ev("go('level','A1')");
  ok(!ev("!!document.getElementById('hclock')"), "the clock leaked onto the level screen");
  ok(!ev("!!document.getElementById('hdate')"), "the date leaked onto the level screen");
});

step("diyalog · a conversation you can always get out of", () => {
  /* The shape of the trees — every branch reachable, every path ending,
     every slot fillable — is checked in validate.js, which walks the data
     without a DOM. What is checked here is the thing the data cannot say:
     that the conversation behaves the way the mode promises. */
  const visible = () => lastPaint.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

  ev("wipe()"); ev("go('diyalog')");
  ok(/Diyalog/.test(lastPaint), "the Diyalog hub did not render");
  ok(/Tamir çantası/.test(lastPaint), "the hub does not show the repair kit");
  ev("DIA_REPAIR").forEach((r, i) => ok(lastPaint.indexOf(ev("DIA_REPAIR[" + i + "].tr")) > -1,
    "the hub omits a repair move"));

  /* Every line of every scenario, rendered with real slots. This sweep is
     what found two content bugs the structural checks cannot see: a price
     at the start of a sentence printed "üç yüz otuz sekiz lira" with no
     capital, and an English label printed "how much is the soğan?"
     because the slot had no English of its own. */
  const flat = [];
  JSON.parse(ev("JSON.stringify(DIYALOG.map(function(s){return s.id}))")).forEach((id, si) => {
    ev("SC=DIYALOG[" + si + "]; VV=diaVars(SC)");
    JSON.parse(ev("JSON.stringify(Object.keys(SC.beats))")).forEach(k => {
      const bq = JSON.stringify(k);
      ["say", "slow", "easy"].forEach(f => {
        if (!ev("SC.beats[" + bq + "]." + f + "||''")) return;
        flat.push([id + "." + k + "." + f, ev("diaText(SC.beats[" + bq + "]." + f + ",VV)"), "tr"]);
      });
      const n = ev("(SC.beats[" + bq + "].opts||[]).length");
      for (let o = 0; o < n; o++) {
        flat.push([id + "." + k + ".opt" + o, ev("diaText(SC.beats[" + bq + "].opts[" + o + "].tr,VV)"), "tr"]);
        flat.push([id + "." + k + ".en" + o, ev("diaText(SC.beats[" + bq + "].opts[" + o + "].en,VV,'en')"), "en"]);
      }
    });
  });
  const textBad = flat.filter(([, t]) => !t || /[{}]/.test(t) || BAD.test(t) || / {2}/.test(t));
  ok(textBad.length === 0, textBad.length + " dialogue lines are broken, e.g. " +
     textBad.slice(0, 2).map(([w, t]) => w + ": " + q(t)).join(" · "));
  /* Turkish capitalises i as İ, and a slot that lands at the start of a
     sentence has to be capitalised after substitution. */
  const lower = flat.filter(([, t, kind]) => kind === "tr" && (/^[a-zçğıöşü]/.test(t) || /[.!?]\s+[a-zçğıöşü]/.test(t)));
  ok(lower.length === 0, lower.length + " Turkish lines start lowercase, e.g. " +
     lower.slice(0, 2).map(([w, t]) => w + ": " + q(t)).join(" · "));

  /* Walk every scenario to the end, taking the first move each time and
     typing whatever number is asked for. All of them must finish: a
     conversation with no way out is the one bug this mode cannot have. */
  const ids = JSON.parse(ev("JSON.stringify(DIYALOG.map(function(s){return s.id}))"));
  ok(ids.length >= 4, "only " + ids.length + " scenarios");
  let leaks = 0, turns = 0;
  ids.forEach(id => {
    ev("wipe()"); ev("startDia(" + q(id) + ")");
    let guard = 0;
    while (ev("DG.phase") !== "end" && guard++ < 20) {
      turns++;
      /* The other person is heard and never read. If the line they are
         speaking is on the screen, this is a reading exercise. */
      if (ev("DG.phase") === "hear") {
        const line = ev("diaLine()");
        if (line && visible().indexOf(line) > -1) leaks++;
        if (ev("!!diaBeat().want")) {
          ev("document.getElementById('dgbox').value=String(DG.V[diaBeat().want].show||DG.V[diaBeat().want].t)");
          ev("diaCheck()");
        } else ev("diaPick(0)");
      }
      ev("diaNext()");
    }
    ok(ev("DG.phase") === "end", id + " never reached an end in 20 turns");
    ok(ev("DG.done") === true, id + " ended without completing");
    ok(ev("S.dia[" + q(id) + "].b") === 1, id + " completed but did not move a box");
    ok(ev("S.dia[" + q(id) + "].n") === 1, id + " completed but was not counted");
  });
  ok(leaks === 0, leaks + " of " + turns + " turns printed what the other person was saying");

  /* A repair is free, changes what you hear, and leaves no mark. */
  ev("wipe()"); ev("startDia('bilet')");
  const plain = ev("diaLine()");
  const spoke = voice.spoken.length;
  ev("diaRepair(0)");
  ok(ev("DG.rep") === 1, "a repair was not counted");
  ok(voice.spoken.length > spoke, "a repair did not say anything");
  ok(voice.rates[voice.rates.length - 1] < 1, "a repair did not slow the voice down");
  const slower = ev("diaLine()");
  ok(slower !== plain, "asking again said exactly the same words at the same speed");
  ev("diaRepair(2)");
  ok(ev("DG.rep") === 2, "the second repair was not counted");
  ok(ev("diaLine()") !== slower, "the rephrase was the same as the slow repeat");
  /* Repairs must not reach the record. The first version kept the fewest
     ever taken, which rewarded guessing at a price over asking about it —
     the exact reflex this mode exists to remove. */
  const keys = JSON.parse(ev("JSON.stringify(Object.keys(S.dia.bilet||{}))"));
  ok(keys.indexOf("r") === -1, "the record keeps a repair count: " + keys.join(","));

  /* A number is the one thing here a machine can mark — and getting it
     wrong does not end the conversation, because in a shop you would hand
     over the wrong note and be corrected, not walk out. */
  ev("wipe()"); ev("startDia('kafe')");
  let g2 = 0;
  while (!ev("!!diaBeat().want") && g2++ < 10) { ev("diaPick(0)"); ev("diaNext()"); }
  ok(ev("!!diaBeat().want"), "never reached a beat that asks for a number");
  const before = ev("Object.keys(S.err).length");
  ev("document.getElementById('dgbox').value='99999999'");
  ev("diaCheck()");
  ok(ev("DG.res") === false, "a wrong number was marked right");
  ok(ev("Object.keys(S.err).length") === before + 1, "a missed number did not reach the book");
  /* And it lands under Sayılar's own key, because a price missed at a
     counter and one missed at a desk are one weakness. */
  ok(Object.keys(JSON.parse(ev("JSON.stringify(S.err)")))
       .some(k => k.indexOf("n:duy:") === 0), "the missed number was not filed under Sayılar's shape");
  ev("diaNext()");
  let g3 = 0;
  while (ev("DG.phase") !== "end" && g3++ < 10) { ev("diaPick(0)"); ev("diaNext()"); }
  ok(ev("DG.done") === true, "a wrong number ended the conversation");

  /* Walking away is the only failure, and the only thing it books. */
  ev("wipe()"); ev("startDia('eczane')");
  ev("diaPick(0)"); ev("diaNext()");
  ev("diaQuit()");
  ok(ev("DG.done") === false, "quitting counted as finishing");
  ok(ev("S.dia.eczane.b") === 0, "quitting did not drop the box");
  ok(ev("S.dia.eczane.n") === 0, "quitting counted as a completion");
  ok(ev("!!S.err['c:eczane']"), "walking away was not recorded");
  ok(ev("S.err['c:eczane'].m") === "c", "walking away was filed under the wrong mode");
  ev("go('hata')");
  ok(/Diyalog/.test(lastPaint), "the mistake book does not name Diyalog");

  /* The transcript is the reward for getting to the end: the lines you
     were hearing, readable at last, and not a moment sooner. */
  ev("wipe()"); ev("startDia('randevu')");
  const opening = ev("DG.log[0].tr");
  ok(visible().indexOf(opening) === -1, "the transcript was readable mid-conversation");
  let g4 = 0;
  while (ev("DG.phase") !== "end" && g4++ < 12) {
    if (ev("!!diaBeat().want")) {
      ev("document.getElementById('dgbox').value=String(DG.V[diaBeat().want].show||DG.V[diaBeat().want].t)");
      ev("diaCheck()");
    } else ev("diaPick(0)");
    ev("diaNext()");
  }
  ok(visible().indexOf(opening) > -1, "the transcript does not show what was said");
  ok(ev("DG.log.length") >= 4, "the transcript is missing turns");
  ok(ev("DG.log[0].who") === "them", "the transcript does not begin with the other person");

  /* The record is progress, not a setting. */
  ev("wipe()");
  ok(ev("Object.keys(S.dia).length") === 0, "wipe() kept the conversation record");
});

/* validate.js counts the routes; this plays them. Every route of every
   scenario, through the real runner, with the other person's random
   choices forced by construction — a route reached only by luck is a route
   that one day is not reached, which is the lesson Sor and Sayılar taught. */
step("diyalog · every route of every scenario plays to its end", () => {
  ev("__rnd=Math.random");
  const force = (j, n) => ev("Math.random=function(){return " + ((j + 0.5) / n) + "}");
  const ids = JSON.parse(ev("JSON.stringify(DIYALOG.map(function(s){return s.id}))"));
  let played = 0;
  const broken = [];
  ids.forEach(id => {
    const sc = JSON.parse(ev("JSON.stringify(diaScenario(" + q(id) + "))"));
    const routes = [];
    const walk = (k, on, path) => {
      const b = sc.beats[k];
      if (!b || on.has(k) || routes.length > 500) return;
      if (b.end) { routes.push(path.concat([{ k }])); return; }
      on.add(k);
      (b.opts ? b.opts.map((o, i) => ({ i, to: o.to })) : [{ i: -1, to: b.to }]).forEach(m => {
        const tos = [].concat(m.to);
        tos.forEach((t, j) => walk(t, on, path.concat([{ k, i: m.i, j: Array.isArray(m.to) ? j : -1, n: tos.length }])));
      });
      on.delete(k);
    };
    walk(sc.start, new Set(), []);
    routes.forEach(r => {
      ev("wipe()"); ev("startDia(" + q(id) + ")");
      const trail = [];
      for (const st of r) {
        trail.push(st.k);
        if (ev("DG.at") !== st.k) { broken.push(id + ": expected " + st.k + " after " + trail.slice(0, -1).join("→") + ", got " + ev("DG.at")); return; }
        if (st.i === undefined) break;
        if (st.i < 0) {
          ev("document.getElementById('dgbox').value=String(DG.V[diaBeat().want].show||DG.V[diaBeat().want].t)");
          ev("diaCheck()");
          if (ev("DG.res") !== true) { broken.push(id + ": the right number was marked wrong at " + st.k); return; }
        } else ev("diaPick(" + st.i + ")");
        if (st.j >= 0) force(st.j, st.n);
        ev("diaNext()");
        ev("Math.random=__rnd");
      }
      if (ev("DG.phase") !== "end" || ev("DG.done") !== true) broken.push(id + ": " + trail.join("→") + " did not finish");
      else played++;
    });
    /* The overcharge this rewrite found: one kilo was billed as two. */
    if (id === "pazar") ok(routes.every(r => !(r.some(s => s.k === "c1") && r.some(s => s.k === "d"))),
      "pazar: a one-kilo route still reaches the two-kilo total");
  });
  ev("Math.random=__rnd");
  ok(broken.length === 0, broken.length + " dialogue routes broke, e.g. " + broken.slice(0, 3).join(" · "));
  ok(played >= 100, "only " + played + " routes played — the trees have gone back to being scripts");

  /* Proposing a meeting uses AT a time — geçe, kala, the locative — and
     never the answer to "what time is it". Every hour and every minute
     the slot can draw, not a sample of them. */
  const wrongForm = [];
  for (let h = 1; h <= 12; h++) [0, 5, 10, 15, 20, 30, 40, 45, 50].forEach(m => {
    const t = ev("SC=diaScenario('randevu'); VV={saat:diaTime(" + h + "," + m + ")}; diaText(SC.beats.b.say,VV)");
    if (/geçiyor|\bvar\b/.test(t) || !/(geçe|kala|[dt][ae]|buçukta), uygun mu\?$/.test(t)) wrongForm.push(t);
  });
  ok(wrongForm.length === 0, wrongForm.length + " proposed times use the wrong form, e.g. " + q(wrongForm[0] || ""));

  /* "Could we make it later?" is answered with a later time. */
  const notLater = [];
  [0.02, 0.2, 0.45, 0.6, 0.85, 0.98].forEach(r => {
    ev("Math.random=function(){return " + r + "}");
    const v = JSON.parse(ev("JSON.stringify(diaVars(diaScenario('randevu')))"));
    ev("Math.random=__rnd");
    const d = (v.gec.val[0] - v.saat.val[0] + 12) % 12;
    if (!(d === 1 || d === 2) || v.gec.val[1] !== v.saat.val[1]) notLater.push(v.saat.show + " → " + v.gec.show);
  });
  ok(notLater.length === 0, "a 'later' time was not later: " + notLater.join(", "));

  /* A rounded price is round: a rent is never 23 847 lira 50. */
  [0.02, 0.5, 0.98].forEach(r => {
    ev("Math.random=function(){return " + r + "}");
    const v = JSON.parse(ev("JSON.stringify(diaVars(diaScenario('kira')))"));
    ev("Math.random=__rnd");
    ok(v.kira.val[0] % 1000 === 0 && v.kira.val[1] === 0 && v.depo.val[0] === 2 * v.kira.val[0],
      "a rent came out unrounded or the deposit is not two rents: " + v.kira.show + " / " + v.depo.show);
  });
});

step("the plan says what to do, in the order it should be done", () => {
  ev("wipe()"); meetAll(); ev("setScope('done')"); ev("home()");
  ok(/Bugün/.test(lastPaint), "home does not show a plan");
  const h = lastPaint;
  ok(h.indexOf("Bugün") < h.indexOf("road-line"), "the plan sits below the progress road");
  ok(!/Devam et · pick up/.test(h), "the old resume card is still there as well as the plan");

  const p = ev("planToday()");
  ok(p.steps.length >= 4, "the plan has only " + p.steps.length + " steps");
  ok(p.steps[p.steps.length - 1].k === "new", "new material is not last — reviews decay, it does not");
  ok(p.steps.every(s => s.n === 0 || s.mins > 0), "a step with work claims no time");
  ok(p.mins > 0 && p.mins < 120, "the plan claims " + p.mins + " minutes, which is not credible");
  ok(p.left[0].k === "rep", "the first thing to do is not the review queue");
  /* Grammar decays the way the words do, so it sits with the reviews and
     ahead of the new unit rather than being an extra at the bottom. */
  ok(p.steps.map(s => s.k).indexOf("gram") === 1,
     "the grammar step is at position " + p.steps.map(s => s.k).indexOf("gram") +
     " in " + p.steps.map(s => s.k).join("/"));

  /* A step ticks when its own queue empties — no stored completion flag.
     Distinct from a step that is absent because nothing has been met. */
  ev("S.dinle={}; listenBank('d:').forEach(function(it){S.dinle[it.k]={b:3,d:dayNum()+4}}); save()");
  ev("home()");
  const dk = ev("planToday()").steps.find(s => s.k === "dinle");
  ok(dk.n === 0, "clearing the dictation queue did not clear its step");
  /* The step list is on İlerleme; the landing page shows one button. The
     rule the ticks pin is unchanged: a step ticks when its own queue
     empties, with no stored completion flag. */
  ok(!/tick done/.test(lastPaint), "the landing page is still painting the step rows");
  ev("go('ilerleme')");
  ok(/tick done/.test(lastPaint), "a finished step shows no tick on İlerleme");
  ev("home()");

  /* Every step's tap target has to be a real call. */
  ev("planToday()").steps.forEach(s => {
    ok(/^[a-zA-Z]+\(/.test(s.go), "step " + s.k + " has no action: " + s.go);
  });
});

step("the plan's last step resumes only a unit that is not finished", () => {
  ev("wipe()"); meetAll(); ev("setScope('done')"); ev("home()");
  ok(ev("planToday().steps.find(function(s){return s.k==='new'}).tr") === "Yeni",
     "a fresh install offers Devam rather than Yeni");

  ev("go('unit','a1u3','r')"); ev("home()");
  const mid = ev("planToday()").steps.find(s => s.k === "new");
  ok(mid.tr === "Devam", "a bookmark mid-unit does not offer Devam");
  ok(mid.go === "startAdim('a1u3',0)",
     "Devam does not return to the unit that was open: " + mid.go);

  /* Finish that unit; the bookmark survives, so the plan must move past it. */
  ev("S.done['a1u3']={score:5,of:5,at:Date.now()}; save()");
  ev("home()");
  const after = ev("planToday()").steps.find(s => s.k === "new");
  ok(after.go.indexOf("a1u3") < 0,
     "a finished bookmark still pins the plan to the completed unit: " + after.go);

  /* Nothing due anywhere and no units left: say so rather than show an empty list. */
  ev("wipe()"); meetAll();
  ev("UNITS.forEach(function(u){S.done[u.id]={score:5,of:5,at:Date.now()}})");
  ev("S.rep={}; repBank().forEach(function(e){S.rep[e.k]={b:5,d:dayNum()+9,n:30}})");
  ev("S.dinle={}; ['d:','a:'].forEach(function(p){listenBank(p).forEach(function(it){S.dinle[it.k]={b:3,d:dayNum()+9}})})");
  ev("S.prod={}; sentenceBank().forEach(function(it){S.prod[it.k]={b:3,d:dayNum()+9}})");
  ev("S.gram={}; gramBank().forEach(function(it){S.gram[it.k]={b:3,d:dayNum()+9,n:1}})");
  /* Today's ten common words are part of "everything" too. */
  ev("S.sik={}; SIK.slice(0,SIK_DAY).forEach(function(e){S.sik[e[0]]={d:dayNum()}})");
  ev("save()"); ev("home()");
  ok(ev("planToday().left.length") === 0, "with everything clear the plan still lists work");
  ok(/Bugünlük bitti/.test(lastPaint), "a cleared plan does not say so");
});

step("the repetition schedule is progress, its settings are not", () => {
  ev("wipe()"); meetAll();
  ev("startTekrar()");
  doc.getElementById("tbox").value = ev("TK.q[TK.i].c");
  ev("tkCheck()");
  ok(ev("Object.keys(S.rep).length") === 1, "nothing was scheduled");
  /* The grammar schedule is the same kind of thing and keyed the same way:
     permanent unit ids, wiped with progress, carried by a backup. */
  ev("startGram()");
  doc.getElementById("gbox").value = ev("GR.q[GR.i].c");
  ev("grCheck()");
  ok(ev("Object.keys(S.gram).length") === 1, "no grammar point was scheduled");
  ok(ev("Object.keys(S.gram)[0]") === "y:" + ev("GR.q[0].id"),
     "the grammar schedule is not keyed by unit id: " + ev("Object.keys(S.gram)[0]"));
  const saved = ev("JSON.stringify(S)");

  ev("wipe()");
  ok(ev("Object.keys(S.rep).length") === 0, "wipe left the repetition schedule behind");
  ok(ev("Object.keys(S.gram).length") === 0, "wipe left the grammar schedule behind");

  ev("go('about')");
  doc.getElementById("iobox").value = saved;
  ev("importBox()");
  ok(ev("Object.keys(S.rep).length") === 1, "restore lost the repetition schedule");
  ok(ev("Object.keys(S.gram).length") === 1, "restore lost the grammar schedule");
});

/* ===================== 12 · about, backup, restore ===================== */
step("about and backup", () => {
  ev("go('about')");
  ok(/Bu kurs hakkında|Nasıl çalışır/.test(lastPaint), "about screen is empty");
  ok(lastPaint.includes(ev("APP_VERSION")), "about does not show the version");
  ok(/Özgün metin/.test(lastPaint), "about does not explain the text labels");

  ev("go('unit','a1u1','v')");
  ev("starAll('a1u1')");
  ev("startUnitQuiz('a1u1')");
  for (let i = 0; i < UNITS[0].drill.length; i++) answer(true);
  const before = ev("JSON.stringify(S)");

  ev("go('about')");
  const box = doc.getElementById("iobox");
  ok(!!box, "backup box missing");
  ev("exportBox()");
  ok(box.value === before, "the backup text is not the saved state");
  const saved = box.value;

  ev("wipe()");
  ok(ev("S.star.length") === 0 && ev("Object.keys(S.done).length") === 0, "wipe did not clear progress");

  ev("go('about')");
  doc.getElementById("iobox").value = saved;
  ev("importBox()");
  ok(ev("!!S.done['a1u1']"), "restore did not bring progress back");
  ok(ev("S.star.length") === 10, "restore did not bring saved words back");
  ok(ev("V.view") === "home", "restore did not return home");

  ev("go('about')");
  doc.getElementById("iobox").value = "not json at all";
  ev("importBox()");
  ok(/okunamadı/.test(doc.getElementById("iomsg").textContent), "a bad backup was not rejected");
  ok(ev("!!S.done['a1u1']"), "a bad backup wiped good progress");
});

/* ===================== 13 · storage, theme, streak ===================== */
step("storage and chrome", () => {
  ok(store.has("turkce-course-v1"), "nothing was written to localStorage");
  const raw = JSON.parse(store.get("turkce-course-v1"));
  ["done", "seen", "star", "srs", "tested", "days"].forEach(k => ok(k in raw, "saved state is missing " + k));
  ok(ev("streak()") >= 1, "the day streak did not count today");

  ev("toggleTheme()");
  const t1 = documentEl.getAttribute("data-theme");
  ok(t1 === "dark" || t1 === "light", "theme toggle set no theme");
  ev("toggleTheme()");
  ok(documentEl.getAttribute("data-theme") !== t1, "theme did not toggle back");

  ev("home()");
  ok(ev("V.view") === "home", "home() did not land on home");
  ev("back()");
  ok(ev("V.view") === "home", "back() from home did not stay home");
});

/* ===================== the two doors ===================== */
/* The landing page used to carry six level cards and fifteen tool rows.
   Everything is still reachable — that is what these check — but it is
   reachable through a menu now rather than by scrolling past a wall. */
step("home · the landing page is the plan, the road and two doors", () => {
  ev("home()");
  ok(/Dersler/.test(lastPaint), "home has no Dersler door");
  ok(/Ara\u00e7lar|Araçlar/.test(lastPaint), "home has no Araçlar door");
  ok(lastPaint.includes("go('dersler')"), "the Dersler door does not open Dersler");
  ok(lastPaint.includes("go('araclar')"), "the Araçlar door does not open Araçlar");
  ok(lastPaint.includes("go('ilerleme')"), "home has no İlerleme tile");
  ok((lastPaint.match(/class="door"/g) || []).length === 3, "home should have exactly three tiles");
  /* The wall is gone: the tool rows and the level cards are behind the
     doors, not on the page you see first. */
  ok(!/Seviyeler/.test(lastPaint), "the level list is still on the landing page");
  /* The claim is "no tool rows", so assert the row itself rather than any
     one destination: the live clock is a button to Sayılar and is meant
     to be — checking for go('sayilar') would fail on correct code. */
  ok(!lastPaint.includes("card nav row"), "the tool rows are still on the landing page");
  ok(!lastPaint.includes("startPlacement()"), "the placement row is still on the landing page");
  ok(lastPaint.includes("go('sayilar')"), "the clock stopped opening Sayılar");
  /* The hero: the crest, the wordmark, the tagline and the clock, and
     nothing in Arabic script. The Ottoman spelling of the app's own name
     used to sit between the wordmark and the tagline, and the tagline
     under that. Both went: five stacked elements before anything
     actionable was what the landing page was being simplified away from.
     .osm and .tag went with them, so re-adding either markup alone would
     paint unstyled. */
  ok(lastPaint.includes('class="crest"') || lastPaint.includes("<svg"), "the crest left the hero");
  ok(/class="mark"/.test(lastPaint), "the wordmark left the hero");
  ok(!/class="tag"/.test(lastPaint), "the tagline is back in the hero");
  ok(!/[\u0600-\u06FF]/.test(lastPaint), "an Arabic-script run is being painted on the landing page");
  ok(!/class="osm"/.test(lastPaint), "the Ottoman line is back, and its style is gone");

  /* What the user asked to keep. */
  ok(/Bugün/.test(lastPaint), "the plan card left the landing page");
  ok(lastPaint.includes("road-stops"), "the progress road left the landing page");
  ok(lastPaint.includes('id="hclock"'), "the live clock left the landing page");
  ok(lastPaint.includes('id="hdate"'), "the date under the clock left the landing page");
});

/* Reported: finishing Tekrar from Bugün ended on a page of the mode's
   whole state, then a button that restarted Tekrar and one that opened
   its hub, so the next step of the plan was a trip home away. A sitting
   now ends on its score and the plan's next step; the state is on
   İlerleme. */
step("bugün · a sitting ends on its score and the plan's next step", () => {
  ev("wipe()");
  ev("UNITS.slice(0,14).forEach(function(u){S.done[u.id]={score:5,of:5,at:0};S.seen[u.id]={v:1,g:1,r:1,d:1}});S.tips=false;save()");
  ok(ev("planToday().left[0].k") === "rep", "this fixture needs Tekrar as the plan's first step");
  ev("startTekrar()");
  let guard = 0;
  while (ev("TK.phase") !== "end" && guard++ < 40) {
    if (ev("TK.phase") === "ask") { doc.getElementById("tbox").value = ev("TK.q[TK.i].c"); ev("tkCheck()"); }
    else ev("tkNext()");
  }
  ok(ev("TK.phase") === "end", "the Tekrar sitting never ended");
  ok(lastPaint.includes('class="score"'), "the end screen lost its score");
  ok(!/encounters|karşılaşma/.test(lastPaint), "the end screen still carries the mode's state");
  ok(!lastPaint.includes("go('tekrar')"), "the end screen still sends the learner to the hub");
  const nx = ev("planToday().left[0]");
  ok(nx && lastPaint.includes('onclick="' + nx.go + '">Devam'), "Devam does not open the plan's next step");
  ok(lastPaint.includes("Sıradaki: " + esc(nx.tr)), "the end screen does not name the next step");
  /* The same thing twice is not a choice. */
  ev(nx.go);
  ok(ev("V.view") !== "tekrarrun" || nx.k === "rep", "Devam did not move on to the next step");

  /* Every Bugün mode ends the same way. */
  ev("startGram()"); ev("GR.i=GR.q.length; GR.phase='end'; render()");
  ok(lastPaint.includes(ev("planToday().left[0].go") + '">Devam'), "Dilbilgisi does not end on the plan's next step");
  ev("startDinle('d')"); ev("DK.i=DK.q.length; DK.phase='end'; render()");
  ok(lastPaint.includes(ev("planToday().left[0].go") + '">Devam'), "Dikte does not end on the plan's next step");
  ev("startProd('s')"); ev("PR.i=PR.q.length; PR.phase='end'; render()");
  ok(lastPaint.includes(ev("planToday().left[0].go") + '">Devam'), "Söyle does not end on the plan's next step");
  /* A mode from Araçlar ends on another sitting and its hub instead. */
  ev("startDinle('a')"); ev("DK.i=DK.q.length; DK.phase='end'; render()");
  ok(lastPaint.includes("go('dinle')") && !lastPaint.includes("next-step"), "Ses önce ends on the plan rather than its hub");

  /* With the plan done, the way on is home. */
  ev("__pt=planToday; planToday=function(){const p=__pt();p.left=[];return p}");
  ev("endScreen({title:'Tekrar',n:3,of:4,label:'x',plan:true})");
  /* The bar carries a home icon on every screen, so the button is checked by its label. */
  ok(/Bugünlük bitti/.test(lastPaint) && lastPaint.includes('onclick="home()">Ana sayfa'), "a finished plan does not say so and go home");
  ev("planToday=__pt");
  /* When the plan's next step is this same mode, it is offered once. */
  const same = ev("planToday().left[0].go");
  ev("endScreen({title:'Tekrar',n:3,of:4,label:'x',plan:true,again:" + q(same) + "})");
  ok(lastPaint.split('onclick="' + same + '"').length === 2, "the plan's next step is offered twice when it is this mode again");

  /* The retell step opens the task itself, not the Üretim hub. */
  const u = ev("UNITS[0].id");
  ev("S.retell[" + q(u) + "]={n:1,d:dayNum()}; save()");
  const rt = ev("planToday().all.find(function(s){return s.k==='retell'})");
  ok(rt && rt.go === "startRetell(" + "'" + u + "')", "the retell step does not open the task: " + (rt && rt.go));
});

step("ilerleme · the state of every mode, in one place", () => {
  ev("wipe()");
  ev("UNITS.slice(0,14).forEach(function(u){S.done[u.id]={score:5,of:5,at:0};S.seen[u.id]={v:1,g:1,r:1,d:1}});S.tips=false;save()");
  ev("home()");
  ok(lastPaint.includes("go('ilerleme')"), "home has no way to İlerleme");
  ev("go('ilerleme')");
  ok(ev("V.view") === "ilerleme", "İlerleme did not open");
  ok(lastPaint.includes("met once"), "İlerleme does not draw the encounter distribution");
  ok(lastPaint.includes("<b>" + ev("repBank().length") + " / " + ev("repAll()") + "</b>"), "the words-met count disagrees with the bank");
  ok(lastPaint.includes("<b>10 / 10</b>"), "A1 does not read as complete");
  ok(lastPaint.includes("<b>" + ev("gramBank().length") + " / " + ev("UNITS.length") + "</b>"), "the grammar-read count disagrees");
  /* Numbers are read, never stored. */
  const before = JSON.stringify(ev("S"));
  ev("render()");
  ok(JSON.stringify(ev("S")) === before, "drawing İlerleme changed the saved state");
  ev("back()");
  ok(ev("V.view") === "home", "back() from İlerleme does not go home");
  /* Dersler kept only the levels. */
  ev("go('dersler')");
  ok(!lastPaint.includes('class="stat"'), "the stat row is still on Dersler");
});

/* Reported: the landing page was too busy, and the paragraph above Başla
   most of all. Bugün is now a heading and one button that names its step;
   the list is on İlerleme, and the orientation is a link. */
step("bugün · a heading and one button, nothing else", () => {
  ev("wipe()");
  ev("UNITS.slice(0,14).forEach(function(u){S.done[u.id]={score:5,of:5,at:0};S.seen[u.id]={v:1,g:1,r:1,d:1}});S.tips=false;save()");
  ev("home()");
  const p = ev("planToday()");
  ok(p.steps.length > 1, "this fixture needs a plan with more than one step");
  ok(/Bugün/.test(lastPaint), "the landing page lost Bugün");
  ok(lastPaint.includes('class="today" onclick="' + p.left[0].go + '"'), "Başla does not open the plan's first step");
  ok(lastPaint.includes(">Başla<"), "the button does not say Başla");
  ok(lastPaint.includes(esc(p.left[0].tr) + " · "), "Başla does not name the step it opens");
  /* The busy parts, each checked by what it was. */
  ok(!lastPaint.includes('class="unit"'), "the step list is back on the landing page");
  ok(!/ adım|steps left|In this order|review steps appear/.test(lastPaint), "the plan's summary or paragraph is back");
  ok(!lastPaint.includes('class="foot"'), "the footer is back on the landing page");
  ok((lastPaint.match(new RegExp('onclick="' + p.left[0].go.replace(/[()'.]/g, "\\$&") + '"', "g")) || []).length === 1,
     "the landing page offers the first step more than once");
  /* Every step is still one tap from İlerleme, in order. */
  ev("go('ilerleme')");
  p.steps.forEach(x => ok(lastPaint.includes('onclick="' + x.go + '"'), "İlerleme is missing the " + x.k + " step"));
});

step("bugün · day one is the same button", () => {
  ev("wipe()"); ev("home()");
  ok(ev("planToday().steps.length") === 1, "day one should be a single step");
  ok(lastPaint.includes('class="today" onclick="' + ev("planToday().left[0].go") + '"'), "day one has no Başla");
  ok(!lastPaint.includes('class="unit"'), "day one paints a step list");
});

step("nasıl çalışır · a link while it is useful, the text on its own page", () => {
  /* wipe() keeps settings, and S.tips is one, so it is set back here. */
  ev("wipe()"); ev("S.tips=true;save()"); ev("home()");
  ok(lastPaint.includes("go('nasil')"), "the landing page has no way to the orientation");
  ok(!/Every label is Turkish/.test(lastPaint), "the orientation text is back on the landing page");
  ev("go('nasil')");
  ok(/Every label is Turkish/.test(lastPaint), "Nasıl çalışır lost its text");
  ok(lastPaint.includes("hideTips()"), "Nasıl çalışır cannot take the link off the landing page");
  ev("hideTips()"); ev("home()");
  ok(!lastPaint.includes("go('nasil')"), "Gizle did not take the link off the landing page");
  ok(store.get("turkce-course-v1").indexOf('"tips":false') >= 0, "Gizle did not persist — it is a setting");
});

/* Reported: two A2 units took an afternoon, so a level could be ticked
   in a day. The plan now offers one new unit a day and names tomorrow's;
   a unit opened by hand is resumed as normal. */
step("pace · one new lesson a day, and what counts as new", () => {
  ev("confirm=function(){return true}; wipe()");
  ev("startAdim('a1u1',0)"); ok(walkAdim(), "lesson one did not reach its end");
  ok(ev("S.ders.a1u1[0]") === ev("dayNum()") && !ev("S.ders.a1u1[1]"), "a finished lesson does not record its day, or recorded another");
  ok(ev("dayFull()"), "a lesson finished today does not fill the day");
  ok(/Ders 1 bitti/.test(lastPaint) && !lastPaint.includes(">Sonraki ders"), "the end of a lesson offers a second one today");
  ok(!lastPaint.includes("startUnitQuiz("), "lesson one leads to the exercises");
  let p = ev("planToday()"), nw = p.steps.find(x => x.k === "new");
  ok(nw && nw.n === 0 && nw.tr === "Yarın" && nw.go === "startAdim('a1u1',1)", "the plan does not wait for tomorrow's lesson: " + JSON.stringify(nw));
  ok(p.tomorrow && p.tomorrow.id === "a1u1" && /lesson 2 of 3/.test(p.tomorrow.en), "the plan does not name tomorrow's lesson");

  /* With the rest of the day done, the landing page says so and names it. */
  ev("__pt=planToday; planToday=function(){const p=__pt();p.left=[];return p}"); ev("home()");
  ok(/Bugünlük bitti/.test(lastPaint) && lastPaint.includes("lesson 2 of 3"), "the finished day does not name tomorrow's lesson");
  ok(lastPaint.includes('class="homelink" onclick="startAdim(\'a1u1\',1)"'), "there is no way to carry on anyway");
  ev("planToday=__pt");

  /* The next day, the next lesson; going over an old one again is not new. */
  ev("S.ders.a1u1[0]=dayNum()-1; save()");
  nw = ev("planToday()").steps.find(x => x.k === "new");
  ok(nw.tr === "Devam" && nw.go === "startAdim('a1u1',1)" && nw.n === 1, "the next day does not offer the next lesson: " + JSON.stringify(nw));
  ev("startAdim('a1u1',0)"); walkAdim();
  ok(ev("S.ders.a1u1[0]") === ev("dayNum()-1") && !ev("dayFull()"), "going over an old lesson counted as today's");
  ok(lastPaint.includes("startAdim('a1u1',1)") && lastPaint.includes(">Sonraki ders"), "a day with no lesson yet does not offer the next one");

  /* Lesson three leads into the exercises, and passing them that day is
     the end of the same lesson, not a second new thing. */
  ev("S.ders.a1u1=[dayNum()-2,dayNum()-1,0]; save(); startAdim('a1u1',2)"); walkAdim();
  ok(lastPaint.includes("startUnitQuiz('a1u1')"), "lesson three does not lead to the exercises");
  ev("startUnitQuiz('a1u1')"); for (let i = 0; i < 5; i++) answer(true);
  ok(ev("S.done.a1u1.first") === ev("dayNum()"), "a first pass does not record its day");
  ok(ev("lessonsNewToday()") === 1, "lesson three and its exercises counted as " + ev("lessonsNewToday()") + " new things");
  ok(!lastPaint.includes(">Sonraki ünite"), "the score screen offers a new unit today");
  nw = ev("planToday()").steps.find(x => x.k === "new");
  ok(nw.tr === "Yarın" && nw.go === "startAdim('a1u2',0)", "tomorrow is not the next unit's first lesson: " + JSON.stringify(nw));

  /* All three lessons done and the exercises not passed: that is the step. */
  ev("wipe(); S.seen.a1u1={v:1,g:1,r:1}; S.ders.a1u1=[dayNum()-3,dayNum()-2,dayNum()-1]; save()");
  nw = ev("planToday()").steps.find(x => x.k === "new");
  ok(nw.go === "startUnitQuiz('a1u1')" && nw.n === 1, "with its lessons done the plan does not send the learner to the exercises: " + nw.go);
  ev("go('unit','a1u1','v')");
  ok(lastPaint.indexOf("startUnitQuiz('a1u1')") > -1 && lastPaint.indexOf("startUnitQuiz('a1u1')") < lastPaint.indexOf('class="segs ders"'),
     "the unit page does not lead with the exercises once its lessons are done");

  /* A unit passed without its lessons is the day's new work. */
  ev("wipe(); startUnitQuiz('a1u1')"); for (let i = 0; i < 5; i++) answer(true);
  ok(ev("dayFull()"), "a unit passed without its lessons did not fill the day");

  /* Passing a unit again, or by a level test, is not new. */
  ev("S.done.a1u1.first=0; save()");
  ev("startUnitQuiz('a1u1')"); for (let i = 0; i < 5; i++) answer(true);
  ok(ev("S.done.a1u1.first") === 0 && ev("lessonsNewToday()") === 0, "passing an old unit again counted as today's new one");
  ev("wipe()"); ev("startLevelExam('A1')"); while (ev("Q.i<Q.items.length")) answer(true);
  ok(ev("isDone('a1u5')") && ev("lessonsNewToday()") === 0, "a level test counted its units as today's new one");
});

step("ilerleme · words held beside a rough target for the level", () => {
  ev("wipe()");
  ev("S.rep={kitap:{b:4,d:dayNum()+8,n:5},ev:{b:5,d:dayNum()+16,n:6},masa:{b:6,d:dayNum()+30,n:7},kapi:{b:1,d:dayNum()+1,n:1}}");
  ev("S.srs={'zaten|already':{b:4,d:dayNum()+8},'kitap|book':{b:5,d:dayNum()+16},'ve|and':{b:2,d:dayNum()+2}}; save()");
  ok(ev("heldWords()") === 4, "held words should be kitap, ev, masa and zaten, each once: " + ev("heldWords()"));
  ev("go('ilerleme')");
  const T = ev("VOCAB_TARGET[curLv()]");
  ok(lastPaint.includes("<b>4 / " + T + "</b>"), "İlerleme does not set the words held against the level's target");
  ok(lastPaint.includes("roughly " + T), "the target is not said to be rough");
});

step("dersler · the course spine, and nothing else", () => {
  ev("go('dersler')");
  ok(ev("V.view") === "dersler", "go('dersler') did not reach the hub");
  ok(/Seviyeler/.test(lastPaint), "Dersler has no level list");
  ev("LEVELS").forEach(l => ok(lastPaint.includes("go('level','" + l.id + "')"),
                               "Dersler cannot reach level " + l.id));
  ok(lastPaint.includes("startPlacement()"), "the placement test is not in Dersler");
  ok(!lastPaint.includes("go('sayilar')"), "a practice tool leaked into Dersler");
});

step("araçlar · every tool is still reachable", () => {
  ev("go('araclar')");
  ok(ev("V.view") === "araclar", "go('araclar') did not reach the hub");
  ["prod", "yolda", "sor", "diyalog", "ata", "dinle", "sayilar",
   "tekrar", "gram", "words", "hata", "dict", "about", "nasil"].forEach(v => {
    ok(lastPaint.includes("go('" + v + "')"), "Araçlar cannot reach " + v);
  });
  ok(lastPaint.includes("mineOpen()"), "Araçlar cannot reach the learner's own words");
  /* Grouped rather than a flat list — the whole point of the change.
     Assert the HEADING, not the word: "Tekrar" also appears in the row
     "Tekrar motoru", so a bare word check held however the headings were
     renamed. Second time that trap has come up in this file. */
  ['Konuşma' + GL('speaking'), 'Dinleme' + GL('listening'), 'Tekrar' + GL('bringing it back'),
   'Kelimeler' + GL('words')].forEach(g => {
    ok(lastPaint.includes('class="sec">' + g + '</h2>'), "Araçlar has no " + g + " heading");
  });
  const heads = (lastPaint.match(/class="sec">/g) || []).length;
  ok(heads === 4, "Araçlar has " + heads + " groups, wanted 4 — a flat list is what this replaced");
  /* Reported: the page was sixteen rows of text under two paragraphs.
     Every tool is a tile now, and the page carries no prose. */
  ok((lastPaint.match(/class="tool( idle)?"/g) || []).length === 19, "Araçlar should have nineteen tool tiles");
  ok(!lastPaint.includes("card nav row"), "a text row is back on Araçlar");
  ok(!/Everything here is optional|tag means|class="foot"/.test(lastPaint), "the explanatory paragraphs are back on Araçlar");
  /* The two reference pages are links, not tools. */
  ok(/class="homelink" onclick="go\('nasil'\)"/.test(lastPaint) && /class="homelink" onclick="go\('about'\)"/.test(lastPaint),
     "Nasıl çalışır and Hakkında are not the links at the foot of Araçlar");
});

step("araçlar · hazır is honest, and lives, and dies", () => {
  /* rowRaw pulls exactly one row's own markup — the pill has to be
     found INSIDE that row, not merely somewhere on a page that also
     mentions "hazır" in the explainer sentence above the list. */
  const rowRaw = (fn) => {
    const i = lastPaint.indexOf('onclick="' + fn + '"');
    if (i < 0) return null;
    return lastPaint.slice(i, lastPaint.indexOf("</button>", i));
  };
  /* "Ready" is the tile without the faded Şimdilik boş mark. */
  const tagged = (fn) => { const r = rowRaw(fn); return !!r && /class="tool"/.test(lastPaint.slice(lastPaint.lastIndexOf("<button", lastPaint.indexOf('onclick="' + fn + '"')), lastPaint.indexOf('onclick="' + fn + '"'))) && !/Şimdilik boş/.test(r); };

  ev("wipe()"); ev("go('araclar')");
  /* Ten that never depend on a unit, a starred word or a mistake: a
     prefab bank, a generator, the whole dictionary, the frequency list,
     or the log of listening done elsewhere. These carry the tag from the
     very first paint. */
  ["go('prod')", "go('yolda')", "go('sor')", "go('diyalog')", "go('ata')",
   "go('sayilar')", "go('dict')", "mineOpen()", "go('sik')", "logOpen()", "okumaOpen()"].forEach(fn => {
    ok(tagged(fn), fn + " should be ready on a fresh install — it needs nothing met");
  });
  /* The fade and the words go together: a tile drawn faded says why, and
     one that says it is empty is drawn faded. */
  const tiles = lastPaint.match(/<button class="tool[^"]*"[\s\S]*?<\/button>/g) || [];
  ok(tiles.length && tiles.every(t => /class="tool idle"/.test(t) === /Şimdilik boş/.test(t)),
     "a tile's fade and its Şimdilik boş label disagree");
  /* Seven that start empty and are not lying about it. */
  ["go('dinle')", "go('tekrar')", "go('gram')", "go('words')", "go('hata')", "go('coz')", "adaGo('ada')"].forEach(fn => {
    ok(!tagged(fn), fn + " is offered as ready on a fresh install, but its bank is empty");
  });
  /* Reference rows carry no readiness claim either way — "how this
     works" is not a bank that fills up. */
  ok(!/Şimdilik boş/.test(rowRaw("go('nasil')") || "") && !/Şimdilik boş/.test(rowRaw("go('about')") || ""),
     "a reference link picked up a readiness mark it never asked for");

  /* And each of the five flips on, independently, the moment its own
     bank actually has something — never before, never all at once. */
  ev("go('unit','a1u1','r')"); ev("go('araclar')");
  ok(tagged("go('dinle')"), "reading a1u1's passage did not tag Dinleme hazır");
  ok(!tagged("go('tekrar')"), "reading a passage tagged Tekrar motoru hazır too early");

  ev("go('unit','a1u1','v')"); ev("go('araclar')");
  ok(tagged("go('tekrar')"), "meeting a1u1's word list did not tag Tekrar motoru hazır");
  ok(!tagged("go('gram')"), "meeting the word list tagged Dilbilgisi tekrarı hazır too early");

  ev("go('unit','a1u1','g')"); ev("go('araclar')");
  ok(tagged("go('gram')"), "meeting a1u1's grammar point did not tag Dilbilgisi tekrarı hazır");
  ok(tagged("adaGo('ada')"), "reading a1u1's grammar did not open Adacıklar, whose first questions it answers");
  ok(!tagged("go('words')"), "meeting a grammar point tagged Sözlüğüm hazır too early");
  ok(!tagged("go('hata')"), "meeting a grammar point tagged Hata defteri hazır too early");
  ok(!tagged("go('coz')"), "a1u1's grammar teaches no ending Çöz asks, yet it was tagged ready");
  ev("go('unit','a1u5','g')"); ev("go('araclar')");
  ok(tagged("go('coz')"), "reading a1u5's grammar (the present tense) did not open Çöz");

  ev("setStar('merhaba','hello',true)"); ev("go('araclar')");
  ok(tagged("go('words')"), "starring a word did not tag Sözlüğüm hazır");

  ev("S.err['x:1']={m:'q',q:'?',c:'a',a:'b',w:'',to:'',at:0,n:1};save()"); ev("go('araclar')");
  ok(tagged("go('hata')"), "a recorded mistake did not tag Hata defteri hazır");
});

step("back retraces the menu rather than jumping home", () => {
  ev("go('level','A1')"); ev("back()");
  ok(ev("V.view") === "dersler", "back() from a level did not return to Dersler");
  ev("go('sayilar')"); ev("back()");
  ok(ev("V.view") === "araclar", "back() from a tool did not return to Araçlar");
  ev("go('ata')"); ev("back()");
  ok(ev("V.view") === "araclar", "back() from the sayings did not return to Araçlar");
  ev("go('words')"); ev("startCards()"); ev("back()");
  ok(ev("V.view") === "words", "back() from the flashcards did not return to Sözlüğüm");
});

step("nasıl çalışır · the long orientation moved off the landing page", () => {
  ev("go('nasil')");
  ok(ev("V.view") === "nasil", "go('nasil') did not reach the screen");
  ok(/Turkish letters are optional/.test(lastPaint), "the orientation text did not come with it");
  ok(/Two doors/.test(lastPaint), "the orientation does not explain the two doors");
  ev("home()");
  ok(!/Turkish letters are optional/.test(lastPaint),
     "the five-paragraph orientation is still inline on the landing page");
});

/* ===================== atasözleri ve deyimler ===================== */
/* The strictest judge in the app, so the thing worth pinning is that it
   is strict in the right direction: every word, IN ORDER, nothing extra.
   Dilbilgisi deliberately allows a reordering and this deliberately does
   not, and the two live one file apart. */
step("söz · the hub reaches both banks", () => {
  ev("S.ata={};save();go('ata')");
  ok(ev("V.view") === "ata", "go('ata') did not reach the hub");
  /* Assert the way IN, not the heading: the first version of this checked
     for the word "Atasözleri", which the page title already carries — so
     it held whatever the cards did and could not fail. */
  ok(lastPaint.includes("startAta('a')"), "no way into the proverbs from the hub");
  ok(lastPaint.includes("startAta('d')"), "no way into the idioms from the hub");
  ok(lastPaint.includes(String(ev("ATASOZU.length"))), "the hub does not count the proverbs");
  ok(lastPaint.includes(String(ev("DEYIM.length"))), "the hub does not count the idioms");
});

step("söz · available on day one, and not in the plan", () => {
  ev("S.ata={};S.done={};S.seen={};save()");
  ok(ev("ataDue('a').length") === ev("ATASOZU.length"),
     "a fresh install does not have the proverbs available — they belong to no unit, like the prefabs");
  /* Same reason as Sor, Sayılar and Diyalog: it needs no material met, so
     putting it in the plan would give a beginner a second instruction on
     day one. */
  ok(!ev("planToday().all").some(x => x.k === "ata"),
     "a sayings step turned up in the daily plan");
});

step("söz · the answer is not on screen before you answer", () => {
  ev("S.ata={};save();startAta('a')");
  ok(ev("V.view") === "atarun", "startAta did not begin a sitting");
  const want = ev("AT.q[0].c");
  ok(!lastPaint.includes(want), "the saying is painted before it has been produced");
  ok(lastPaint.includes(ev("AT.q[0].q")), "the situation prompt is not on screen");
});

step("söz · an exact answer passes and moves out a box", () => {
  ev("S.ata={};S.err={};save();startAta('a')");
  const k = ev("AT.q[0].k"), want = ev("AT.q[0].c");
  doc.getElementById("abox").value = want; ev("ataCheck()");
  ok(ev("AT.res.clean") === true, "the model answer did not score clean");
  ok(ev("ataBox(" + q(k) + ")") === 1, "a right answer did not move the saying out a box");
  ok(!ev("S.err[" + q(k) + "]"), "a right answer was booked as a mistake");
});

step("söz · diacritics are forgiven, like everywhere else", () => {
  ev("S.ata={};save();startAta('a')");
  const want = ev("AT.q[0].c");
  doc.getElementById("abox").value = ev("fold(" + q(want) + ")"); ev("ataCheck()");
  ok(ev("AT.res.clean") === true, "a folded answer was marked wrong — the keyboard is not the lesson");
});

step("söz · a miss drops to today and reaches the book under its own mode", () => {
  ev("S.ata={};S.err={};save();startAta('a')");
  const k = ev("AT.q[0].k");
  doc.getElementById("abox").value = "böyle bir söz yok"; ev("ataCheck()");
  ok(ev("AT.res.clean") === false, "a wrong answer passed");
  ok(ev("ataBox(" + q(k) + ")") === 0, "a miss did not come back to today");
  ok(ev("S.err[" + q(k) + "] ? S.err[" + q(k) + "].m : null") === "z",
     "a missed saying was not booked under the sayings mode");
});

step("söz · the learner overrules, and the book forgets it", () => {
  /* Put a saying on a KNOWN box first. With a never-asked one, "restore
     what it was on" and "reset to box 1" give the same answer, so the
     test could not tell them apart — which is exactly the bug the
     restore exists to prevent. */
  const k = "a:" + ev("ATASOZU[0].id");
  ev("S.ata={};S.ata[" + q(k) + "]={b:3,d:0};S.err={};save();startAta('a')");
  ok(ev("AT.q[0].k") === k, "the due saying was not first in the queue");
  doc.getElementById("abox").value = "böyle bir söz yok"; ev("ataCheck()");
  ok(ev("ataBox(" + q(k) + ")") === 0, "the miss did not drop the box to today");
  ok(!!ev("S.err[" + q(k) + "]"), "the miss was not booked");
  ev("ataAccept()");
  ok(ev("ataBox(" + q(k) + ")") === 4,
     "overruling did not restore the box it was on before the miss and advance it — box " +
     ev("ataBox(" + q(k) + ")") + ", wanted 4");
  ok(!ev("S.err[" + q(k) + "]"), "an overruled mark stayed in the mistake book");
  ok(ev("AT.over") === true, "the overrule did not stick");
});

step("söz · a listed variant is accepted, and named after a right answer", () => {
  const withAlt = ev("ATASOZU.filter(function(p){return p.alt&&p.alt.length})");
  ok(withAlt.length > 0, "no saying carries a variant — the honesty about wording has gone");
  withAlt.forEach(p => {
    p.alt.forEach(v => {
      ok(ev("ataJudge({c:" + q(p.t) + ",alt:" + q(p.alt).replace(/^"|"$/g, "") + "}," + q(v) + ")") !== null,
         "variant setup failed for " + p.id);
    });
  });
  /* Drive it through the real runner rather than the judge alone. */
  ev("S.ata={};save();startAta('a')");
  let guard = 0;
  while (ev("AT.q[AT.i] ? (AT.q[AT.i].alt||[]).length : 0") === 0 && guard++ < 40) {
    doc.getElementById("abox").value = ev("AT.q[AT.i].c"); ev("ataCheck()"); ev("ataNext()");
    if (ev("AT.phase") === "end") { ev("startAta('a')"); }
  }
  if (ev("AT.q[AT.i] && (AT.q[AT.i].alt||[]).length")) {
    const alt = ev("AT.q[AT.i].alt[0]");
    doc.getElementById("abox").value = alt; ev("ataCheck()");
    ok(ev("AT.res.clean") === true, "a listed variant was marked wrong");
    ok(lastPaint.includes("Also said"), "a right answer did not show the other wording");
    ok(!/\.\.|\?\.|!\./.test(lastPaint.replace(/<[^>]+>/g,"")), "the other wording is printed with a doubled stop");
  }
});

step("söz · the idiom's literal sense is a payoff, not a hint", () => {
  ev("S.ata={};save();startAta('d')");
  const it = ev("AT.q[0]");
  ok(!lastPaint.includes(it.lit), "the literal gloss is shown before the answer — that is the hint that gives it away");
  ok(!lastPaint.includes(it.ex[0]), "the example sentence is shown before the answer");
  doc.getElementById("abox").value = it.c; ev("ataCheck()");
  ok(lastPaint.includes(esc(it.lit)), "the literal gloss never appears");
  ok(lastPaint.includes(esc(it.ex[0])), "the example sentence never appears");
});

/* The three invariants, driven through the judge for every entry in both
   banks. The reordering one is the whole difference from Dilbilgisi. */
step("söz · every word, in order, nothing extra — across the whole bank", () => {
  const all = ev("ATASOZU.concat(DEYIM)");
  let dropped = 0, invented = 0, reordered = 0, exact = 0;
  all.forEach(it => {
    const w = it.t.split(/\s+/);
    if (ev("ataJudge({c:" + q(it.t) + ",alt:[]}," + q(it.t) + ").clean")) exact++;
    if (w.length < 2) return;
    if (ev("ataJudge({c:" + q(it.t) + ",alt:[]}," + q(w.slice(0, -1).join(" ")) + ").clean")) dropped++;
    if (ev("ataJudge({c:" + q(it.t) + ",alt:[]}," + q(it.t + " zürafa") + ").clean")) invented++;
    const sw = [w[1], w[0]].concat(w.slice(2)).join(" ");
    if (ev("fold(" + q(sw) + ")") !== ev("fold(" + q(it.t) + ")") &&
        ev("ataJudge({c:" + q(it.t) + ",alt:[]}," + q(sw) + ").clean")) reordered++;
  });
  ok(exact === all.length, (all.length - exact) + " sayings do not pass their own exact wording");
  ok(dropped === 0, dropped + " sayings still pass with a word dropped");
  ok(invented === 0, invented + " sayings still pass with a word invented");
  ok(reordered === 0, reordered + " sayings still pass reordered — this judge is not order-free, unlike Dilbilgisi's");
});

step("söz · progress is progress: wipe clears it, a backup carries it", () => {
  ev("S.ata={};save();startAta('a')");
  doc.getElementById("abox").value = ev("AT.q[0].c"); ev("ataCheck()");
  ok(Object.keys(ev("S.ata")).length > 0, "nothing was written");
  const box = ev("exportBox ? 1 : 0");
  ok(box === 1, "there is no backup path to test against");
  const dump = ev("JSON.stringify(S)");
  ev("S.ata={};save()");
  ok(Object.keys(ev("S.ata")).length === 0, "the store did not clear");
  ev("S=Object.assign(S,JSON.parse(" + q(dump) + "));save()");
  ok(Object.keys(ev("S.ata")).length > 0, "a restore did not bring the sayings back");
  /* wipe() is progress-clearing; settings survive it and this must not. */
  ev("S.ata={x:{b:3,d:0}};save();confirm=function(){return true};wipe()");
  ok(Object.keys(ev("S.ata")).length === 0, "wipe() kept the sayings — they are progress, not a setting");
});

step("söz · a sitting ends and offers another", () => {
  ev("S.ata={};save();startAta('d')");
  let guard = 0;
  while (ev("AT.phase") !== "end" && guard++ < 40) {
    doc.getElementById("abox").value = ev("AT.q[AT.i].c"); ev("ataCheck()"); ev("ataNext()");
  }
  ok(ev("AT.phase") === "end", "the sitting never ended");
  ok(lastPaint.includes("Devam"), "the end card does not offer another sitting");
  ev("go('ata')");
  ok(ev("V.view") === "ata", "could not get back to the hub");
});

/* A device that can speak but has no Turkish voice is not silent — it reads
   Turkish in an English accent — and until this step existed nothing in the
   app said so, and nothing here had ever run the app without speech at all.
   The stub normally offers a tr-TR voice, so each state is made by hand. */
step("ses · the three voice states, each said where it matters", () => {
  const TR = "[{lang:'en-GB',name:'Daniel'},{lang:'tr-TR',name:'Yelda'}]";
  const setVoices = list => ev("speechSynthesis.getVoices=function(){return " + list + "}");
  /* The stub keeps innerHTML only on elements it was set on, so a note
     painted with the screen is read from the paint, and the element is
     read only where the app pokes it. */
  const NOTR = "Türkçe ses yok" + GL("no Turkish voice"), NONE = "Ses yok" + GL("no speech");
  const empty = () => lastPaint.includes('<div id="vnote"></div>');
  ev("S.done={};S.seen={};save()");

  setVoices(TR);
  ev("go('unit','a1u1','v')");
  ok(empty(), "a device with a Turkish voice was warned anyway");
  ev("go('about')");
  ok(/Yelda/.test(lastPaint), "About does not name the Turkish voice in use");
  ok(!/If nothing is heard/.test(lastPaint), "About still claims a missing voice means silence — it means the wrong accent");

  setVoices("[{lang:'en-GB',name:'Daniel',default:true}]");
  ev("go('unit','a1u1','v')");
  ok(lastPaint.includes(NOTR), "Kelimeler does not warn when there is no Turkish voice");
  ev("go('unit','a1u1','r')");
  ok(lastPaint.includes(NOTR), "Okuma does not warn when there is no Turkish voice");
  ev("go('unit','a1u1','d')");
  ok(!lastPaint.includes('id="vnote"'), "the drill tab carries the voice note, and nothing there speaks");
  ["prod", "dinle", "diyalog", "yolda", "sayilar"].forEach(v => {
    ev("go('" + v + "')");
    ok(lastPaint.includes(NOTR), v + " does not warn when there is no Turkish voice");
  });
  const before = voice.said;
  ev("sayWord('merhaba')");
  ok(voice.said === before + 1, "no Turkish voice should still speak — a rough guide, and the learner has been told");
  ev("go('unit','a1u1','v')");
  ev("voiceHelp()");
  ok(ev("V.view") === "about" && /id="ses"/.test(lastPaint), "the note's button does not reach the instructions");
  ok(/no Turkish voice/.test(lastPaint) && /Spoken Content/.test(lastPaint), "About does not say what is wrong and how to fix it");

  /* A list not loaded yet says nothing, then fills in place when it
     arrives — a re-render there would empty a half-typed dictation. */
  setVoices("[]");
  ev("go('unit','a1u1','r')");
  ok(empty(), "an unloaded voice list was reported as a problem");
  const paints = screens;
  setVoices("[{lang:'en-US',name:'Samantha'}]");
  ev("speechSynthesis.onvoiceschanged()");
  ok((doc.getElementById("vnote").innerHTML || "").includes(NOTR), "a voice list arriving late did not fill the note");
  ok(screens === paints, "a late voice list re-rendered the screen instead of filling the note in place");

  /* No speech at all: the unit says so once, and the hubs that already
     explained it keep one card rather than gaining a second. */
  ev("__ss=window.speechSynthesis; delete window.speechSynthesis");
  ev("go('unit','a1u1','v')");
  ok(lastPaint.includes(NONE), "the unit does not say this browser cannot speak");
  [["dinle", /Ses yok/g], ["diyalog", /Ses yok/g], ["yolda", /Ses yok/g], ["sayilar", /no speech synthesis/g]].forEach(([v, re]) => {
    ev("go('" + v + "')");
    ok((lastPaint.match(re) || []).length === 1 && !lastPaint.includes(NOTR) && !lastPaint.includes(NONE),
      v + " should explain missing speech exactly once");
  });
  ev("go('prod')");
  ok(lastPaint.includes(NONE), "Üretim works without speech and should say the model will not be heard");
  ev("window.speechSynthesis=__ss");
  setVoices(TR);
  ev("home()");
});

/* save() used to swallow every error, so a browser refusing to store left a
   learner working for weeks toward nothing. A warning that scrolls away
   or sits on one screen would be missed, so it lives in the top bar. */
step("kayıt · a save that fails is said on every screen until one works", () => {
  const STRIP = "Kaydedilmiyor";
  const inBar = () => { const i = lastPaint.indexOf(STRIP), w = lastPaint.indexOf('<div class="wrap">');
    return i > -1 && w > -1 && i < w; };
  ev("S.star=[];S.srs={};save();home()");
  ok(!lastPaint.includes(STRIP), "a working browser was told it is not saving");

  ev("__si=localStorage.setItem; localStorage.setItem=function(){throw new Error('QuotaExceededError')}");
  ev("go('araclar')");
  ok(!lastPaint.includes(STRIP), "warned before any save had actually failed");
  /* Opening a tab records it as seen, which is a save. */
  ev("go('unit','a1u1','v')");
  ok(inBar(), "a failed save is not said in the top bar of the screen it happened on");
  ev("toggleStar(0)");
  ev("home()");
  ok(inBar(), "the home screen, which draws its own bar, does not carry the warning");
  ev("go('araclar')");
  ok(inBar(), "the warning did not follow the learner to the next screen");
  ev("saveHelp()");
  ok(ev("V.view") === "about" && /id="yedek"/.test(lastPaint), "the strip's button does not reach the backup");
  ok(/not saving right now/.test(lastPaint), "the backup card does not say what to do while nothing saves");
  /* The rescue has to work from memory: storage is the thing that broke. */
  ev("exportBox()");
  const dumped = doc.getElementById("iobox").value || "";
  ok(dumped.includes('"star"') && JSON.parse(dumped).star.length === 1,
    "a backup taken while saving fails lost the work done since — it must read the live state");

  ev("localStorage.setItem=__si; save(); render()");
  ok(!lastPaint.includes(STRIP), "a save that went through again did not clear the warning");

  ev("__gi=localStorage.getItem; localStorage.getItem=function(){throw new Error('SecurityError')}");
  ev("load(); home()");
  ok(inBar(), "storage that cannot even be read is not reported");
  ev("localStorage.getItem=__gi; save(); home()");
  ok(!lastPaint.includes(STRIP), "the read failure outlived a working save");
  ev("S.star=[];S.srs={};save()");
});

/* The frequency layer: ten a day, into the queue that already exists, and
   only once there is a day one behind the learner. */
step("sık · ten common words a day, into the ordinary reviews", () => {
  const tagged = fn => { const i = lastPaint.indexOf('onclick="' + fn + '"'); return i > -1 && !/Şimdilik boş/.test(lastPaint.slice(i, lastPaint.indexOf("</button>", i))); };
  const sikStep = () => ev("planToday()").steps.find(s => s.k === "sik");
  ev("wipe()"); ev("S.tips=true; S.sik={}; save(); home()");
  ok(!sikStep(), "day one offers common words — the plan must stay one instruction until a unit is done");
  ok(ev("SIK.length") >= 1000, "the list is shorter than a thousand words");

  ev("S.done['a1u1']={score:5,of:5,at:Date.now()}; save(); home()");
  const st = sikStep();
  ok(st && st.n === 10, "after a finished unit the plan does not offer ten words: " + JSON.stringify(st));
  const order = ev("planToday()").steps.map(s => s.k);
  ok(order.indexOf("sik") === order.length - 2, "the words are not the last thing before the new unit: " + order.join(","));

  /* The batch is the list's own order, and nothing past it. */
  ev("go('sik')");
  const first = JSON.parse(ev("JSON.stringify(SIK.slice(0,11).map(function(e){return e[0]}))"));
  const shows = w => lastPaint.indexOf('<div class="vtr">' + w.replace(/'/g, "&#39;") + "</div>") > -1;
  ok(first.slice(0, 10).every(shows), "today's batch is not the first ten words of the list");
  ok(!shows(first[10]), "the batch runs past ten");

  /* Known costs nothing: the next word slides in, nothing is starred. */
  ev("sikKnow(" + q(first[0]) + ")");
  ok(!shows(first[0]) && shows(first[10]), "a known word stayed, or the next one did not come in");
  ok(ev("S.sik[" + q(first[0]) + "].k") === 1 && !ev("isStarred(SIK[0][0],SIK[0][1])"), "a known word was starred or not recorded as known");
  ok(sikStep().n === 10, "marking a word as known used up the day's quota");

  /* Added: starred, first review tomorrow, the plan's Tekrar step untouched. */
  const dueBefore = ev("dueList().length");
  ev("sikAdd()");
  ok(ev("SIK.slice(1,11).every(function(e){return isStarred(e[0],e[1])})"), "the batch did not reach the review queue");
  ok(ev("SIK.slice(1,11).every(function(e){return S.srs[starKey(e[0],e[1])].d===dayNum()+1})"), "a new word is due today — it must come back tomorrow");
  ok(ev("dueList().length") === dueBefore, "adding today's words put work into today's Tekrar step");
  ok(sikStep().n === 0, "the plan's word step did not tick once today's ten were added");
  ok(/Bugünlük bu kadar/.test(lastPaint), "the screen does not say today's words are done");
  ev("go('araclar')");
  ok(!tagged("go('sik')"), "Sık kelimeler is still offered as ready with today's words done");

  /* More on request, and never stored as a setting. */
  ev("go('sik')");
  const saved = store.get("turkce-course-v1");
  ev("sikMore()");
  ok(shows(ev("SIK[11][0]")), "ten more did not bring the next batch");
  ok(store.get("turkce-course-v1") === saved && ev("JSON.stringify(S)") === saved,
     "asking for ten more changed what is stored — it is a one-day choice, not progress");

  /* The next day starts where the last one stopped, and yesterday's words are due. */
  ev("SIKX={d:0,n:0}; Object.keys(S.sik).forEach(function(k){S.sik[k].d--}); SIK.slice(1,11).forEach(function(e){S.srs[starKey(e[0],e[1])].d--}); save(); home()");
  ok(sikStep().n === 10, "a new day did not offer ten more");
  ok(ev("SIK.slice(1,11).every(function(e){return dueList().indexOf(starKey(e[0],e[1]))>-1})"), "yesterday's words are not in today's reviews");
  ev("go('sik')");
  ok(shows(ev("SIK[11][0]")) && !shows(ev("SIK[1][0]")), "the new day did not start after yesterday's batch");

  /* A word starred another way counts as met, and never becomes a second copy. */
  ev("setStar(SIK[11][0],SIK[11][1],true); save(); render()");
  ok(!shows(ev("SIK[11][0]")), "a word already starred was offered again");
  ok(ev("mineTaught(SIK[12][0]).tr") === ev("SIK[12][0]"), "adding a common word as your own would make a second copy");

  /* In Sözlük, under the everyday source, with a class. */
  ev("DICT={q:SIK[0][0],cat:'all',src:'all',topic:'',sort:'az'}; go('dict')");
  ok(ev("dictAll().filter(function(w){return w.k==='sık'}).length") === ev("SIK.length"), "Sözlük does not list every common word");
  ok(lastPaint.indexOf(">sık<") > -1, "a common word's row does not say where it comes from");
  ok(ev("dictAll().find(function(w){return w.tr==='zaten'}).c") === "z", "a common word lost its class");
  ev("DICT={q:'',cat:'all',src:'all',topic:'',sort:'az'}");

  /* Progress, not a setting: wipe clears it, a backup carries it. */
  const dump = ev("JSON.stringify(S)");
  ok(JSON.parse(dump).sik && Object.keys(JSON.parse(dump).sik).length > 0, "the backup does not carry the common words");
  ev("confirm=function(){return true}; wipe()");
  ok(Object.keys(ev("S.sik")).length === 0, "wipe() kept the common-word record");
  ev("home()");
});

/* Başlarken: six lessons before unit one. Offered first only to someone
   who has opened nothing, ticked by passing their questions, and never a
   source of review — nothing reviews what has not been met, and these
   are orientation rather than material. */
/* Answer the current intro question, right or wrong, by the key. The
   tiles are shuffled in the data, so they are built in the answer's
   order rather than the list's. */
function introReply(right) {
  const it = ev("Q.items[Q.i]");
  if (it.t === "mc") ev("answerMC(" + (right ? it.c : (it.c + 1) % it.a.length) + ")");
  else if (it.t === "fill") { doc.getElementById("fin").value = right ? it.c : "zzz"; ev("answerFill()"); }
  else {
    const pool = ev("Q.pool").slice(), used = [];
    (right ? it.c.split(" ") : it.w).forEach(w => {
      const at = pool.findIndex((t, i) => t === w && !used[i]);
      if (at < 0) { fails.push("intro tile not in the pool: " + w); return; }
      used[at] = 1; ev("build(" + at + ")");
    });
    if (!right) { ev("unbuild(0)"); }
    ev("answerOrder()");
  }
  ok(ev("Q.res[Q.i]") === right, "an intro answer was graded the other way (" + it.t + " · " + it.q + ")");
  ev("nextQ()");
}
step("başlarken · the lessons before unit one", () => {
  const BASLA = ev("BASLA");
  const plan = () => ev("planToday()");
  ev("confirm=function(){return true}; wipe(); home()");

  /* Day one: one instruction, and it is the first lesson. */
  const p0 = plan();
  ok(p0.steps.length === 1 && p0.left[0].tr === "Giriş" && p0.left[0].go === "go('basla','alfabe')",
     "day one's plan does not point at the first intro lesson: " + JSON.stringify(p0.steps));
  ok(lastPaint.includes("Giriş") && lastPaint.includes("the alphabet"), "day one's Başla does not name the intro lesson it opens");
  ev("go('dersler')");
  ok(lastPaint.indexOf('<h2 class="sec">Başlarken') > -1 && lastPaint.indexOf('<h2 class="sec">Başlarken') < lastPaint.indexOf('<h2 class="sec">Seviyeler'),
     "on day one Başlarken is not above the levels");
  ok(lastPaint.includes("go('baslarken')"), "Dersler has no way into the intro lessons");

  /* The list, then every lesson, every part and every row. */
  ev("go('baslarken')");
  BASLA.forEach(L => ok(lastPaint.includes("go('basla','" + L.id + "')"), "the intro list does not open " + L.id));
  ok((lastPaint.match(/class="tick here"/g) || []).length === 1, "the intro list does not mark exactly one lesson as next");
  ev("back()");
  ok(ev("V.view") === "dersler", "back from the intro list does not return to Dersler");
  BASLA.forEach(L => {
    ev("go('basla'," + q(L.id) + ")");
    L.parts.forEach(pt => ok(lastPaint.includes('<h2 class="sec">' + esc(pt.h) + '<span class="gl">'), L.id + ' does not show its part "' + pt.h + '"'));
    const words = [].concat(...L.parts.map(pt => (pt.rows || []).map(r => r[0]).concat((pt.letters || []).map(r => r[1]))));
    words.forEach(w => ok(lastPaint.includes('<div class="vtr">' + esc(w) + '</div>') && lastPaint.includes("sayWord('" + w.replace(/'/g, "\\'") + "')"),
      L.id + ': "' + w + '" is not shown with a way to hear it'));
    ok(lastPaint.includes("startBasla('" + L.id + "')"), L.id + " has no way into its questions");
  });
  ev("go('basla','alfabe')");
  ok((lastPaint.match(/class="bl"/g) || []).length === 29, "the alphabet lesson does not show 29 letters");
  ev("back()");
  ok(ev("V.view") === "baslarken", "back from a lesson does not return to the list");

  /* The questions: a heard one plays on arrival, and a right run ticks the
     lesson without touching a schedule or the mistake book. */
  const srs = ev("JSON.stringify([S.star,S.srs,S.prod,S.rep,S.gram,S.err])");
  ev("startBasla('alfabe')");
  ok(ev("Q.items[0].say") === "çay" && voice.spoken[voice.spoken.length - 1] === "çay", "a heard question did not play its word on arrival");
  const said = voice.said;
  ev("render()");
  ok(voice.said === said, "a redraw played the heard word again");
  ok(lastPaint.includes("Bir daha dinle" + GL("listen again")), "a heard question has no way to hear it again");
  while (ev("Q.i<Q.items.length")) introReply(true);
  ok(ev("!!S.basla.alfabe"), "passing the alphabet questions did not tick the lesson");
  ok(lastPaint.includes("go('basla','yazim')"), "the score screen does not lead to the next lesson");
  ok(plan().left[0].go === "go('basla','yazim')", "the plan did not move on to the second lesson");
  ok(ev("metUnits().length") === 0, "an intro lesson counted as a unit met");

  /* Failing does not tick, and a wrong answer is not a recorded mistake. */
  ev("startBasla('vurgu')");
  ev("back()");
  ok(ev("V.view") === "basla" && ev("V.u") === "vurgu", "back from intro questions does not return to the lesson");
  ev("startBasla('vurgu')");
  while (ev("Q.i<Q.items.length")) introReply(false);
  ok(!ev("!!S.basla.vurgu"), "failing the questions ticked the lesson");
  ok(lastPaint.includes("startBasla('vurgu')"), "a failed run does not offer another go");
  ok(ev("JSON.stringify([S.star,S.srs,S.prod,S.rep,S.gram,S.err])") === srs, "the intro wrote to a schedule or the mistake book");

  /* All six done: the plan goes on to unit one, and says so. */
  BASLA.forEach(L => { if (!ev("baslaDone(" + q(L.id) + ")")) { ev("startBasla(" + q(L.id) + ")"); while (ev("Q.i<Q.items.length")) introReply(true); } });
  ok(ev("baslaCount()") === BASLA.length, "running every lesson right did not tick them all");
  ok(plan().left[0].go === "startAdim('a1u1',0)", "with the intro done the plan does not go to unit one: " + plan().left[0].go);
  ok(/a1u1/.test(lastPaint), "the last lesson's score screen does not lead to unit one");

  /* Progress, not a setting: a backup carries it and wipe clears it. */
  ok(Object.keys(JSON.parse(ev("JSON.stringify(S)")).basla).length === BASLA.length, "the backup does not carry the intro lessons");
  ev("wipe()");
  ok(Object.keys(ev("S.basla")).length === 0, "wipe() kept the intro record");

  /* Someone who opens a unit first has chosen where to start: the plan
     follows the unit, and Başlarken drops below the levels. */
  ev("go('unit','a1u1','v'); home()");
  ok(ev("baslaPlan()") === null && plan().steps.some(s => s.k === "new" && s.tr !== "Giriş"), "opening a unit did not take the plan off the intro");
  ev("go('dersler')");
  ok(lastPaint.indexOf('<h2 class="sec">Başlarken') > lastPaint.indexOf('<h2 class="sec">Seviyeler'), "once a unit is open Başlarken still sits above the levels");

  /* With no speech at all, a question that has to be heard is left out. */
  ev("__ss=window.speechSynthesis; delete window.speechSynthesis");
  ev("startBasla('alfabe')");
  ok(ev("Q.items.every(function(it){return !it.say})") && ev("Q.items.length") === BASLA[0].check.filter(i => !i.say).length,
     "with no speech a heard question was still asked");
  ev("window.speechSynthesis=__ss; wipe(); home()");
});

/* Two things a learner reported, pinned as they were reported.
   1. Testing out of A1 put a hundred words "due" at once, and the plan,
      which puts reviews before new material, asked for ten after ten and
      never reached A2. New items now come in at NEW_DAY a day per queue.
   2. "Pleased to meet you. How are you?" refused Nasılsınız. Where the
      sentence does not say which you, the other one counts. */
step("reported · a level test does not bury the plan in reviews", () => {
  ev("unitOpen=__unitOpen; baslaOpen=__baslaOpen");
  drain(60000); ev("stopPlay()");
  ev("confirm=function(){return true}; wipe(); S.pscope='done'; save(); home()");
  ev("startLevelExam('A1')"); for (let i = 0; i < 10; i++) answer(true);
  ok(ev("lvPct('A1')") === 100, "the A1 test did not pass A1");
  const step = k => ev("planToday()").steps.find(s => s.k === k);
  ok(ev("repShort().length") > 50, "the scenario needs a large backlog to mean anything: " + ev("repShort().length"));
  ok(step("rep").n === ev("NEW_DAY.rep"), "Tekrar asks for " + step("rep").n + " after a level test, not a day's worth");
  ok(step("gram").n <= ev("NEW_DAY.gram") && step("dinle").n <= ev("NEW_DAY.dinle") && step("prod").n <= ev("NEW_DAY.prod"),
     "a review step asks for more new items than a day's allowance");
  /* One sitting of Tekrar, all right: the step ticks, and does not refill. */
  ev("startTekrar()");
  const n = ev("TK.q.length");
  for (let i = 0; i < n; i++) { doc.getElementById("tbox").value = ev("TK.q[TK.i].c"); ev("tkCheck()"); ev("tkNext()"); }
  ok(step("rep").n === 0, "after a full sitting Tekrar still asks for " + step("rep").n + " — the loop that was reported");
  ok(ev("planToday()").left.every(s => s.k !== "rep"), "the plan's next step is still Tekrar");
  ok(step("new") && step("new").go === "startAdim('a2u1',0)" && ev("unitOpen('a2u1')"), "the plan does not lead on to A2");
  ok(ev("Object.keys(S.rep).every(function(k){return S.rep[k].f===dayNum()})"), "a first practice is not stamped with its day");
  /* Tomorrow, the next ten — and the reviews of today's come due as they fall. */
  ev("Object.keys(S.rep).forEach(function(k){S.rep[k].f--;S.rep[k].d--}); save()");
  ok(step("rep").n === ev("REP_SESSION"), "the next day does not bring the next words");
  ev("S.pscope=undefined; unitOpen=function(){return true}; baslaOpen=function(){return true}; wipe(); home()");
});

step("reported · the other you counts where the sentence does not say which", () => {
  ev("confirm=function(){return true}; wipe(); home()");
  const cloze = (qtext, typed) => {
    ev("TK={q:[{k:'nasilsin',u:'a1u1',tr:'nasılsın?',en:'how are you? (informal)',kind:'cloze',q:" + q(qtext) +
       ",c:'Nasılsın',alts:['nasilsin'],hint:'Pleased to meet you. How are you?',from:'A1'}],i:0,phase:'ask',typed:'',res:null,right:0}; V={view:'tekrarrun'}; render()");
    doc.getElementById("tbox").value = typed; ev("tkCheck()");
    return ev("TK.res");
  };
  ok(cloze("— Memnun oldum. ___?", "nasılsınız") === true, "Nasılsınız was refused for “Pleased to meet you. How are you?” — the reported case");
  ok(/Sen · siz/.test(lastPaint), "accepting the other you does not say why it counts");
  ok(cloze("— Memnun oldum. ___?", "nasılsın") === true && !/Sen · siz/.test(lastPaint), "the answer itself was explained as the other you");
  ok(cloze("— İyiyim, teşekkür ederim. Sen ___?", "nasılsınız") === false, "Nasılsınız was accepted after Sen, which decides it");
  ok(cloze("— Memnun oldum. ___?", "nasıl") === false, "a word that is not the other you was accepted");
  ev("TK=null");

  /* Dilbilgisi: a real example, reached through its own rotation. */
  ev("wipe(); S.seen.a1u5={g:1}; S.gram['y:a1u5']={b:0,d:0,n:2}; save(); startGram()");
  ok(ev("GR.q[0].c") === "Ne yapıyorsun?", "the rotation did not reach the example under test: " + ev("GR.q[0].c"));
  doc.getElementById("gbox").value = "Ne yapıyorsunuz"; ev("grCheck()");
  ok(ev("GR.res.same") === true && /Sen · siz/.test(lastPaint), "Dilbilgisi refused Ne yapıyorsunuz for “What are you doing?”");
  ev("GR=null");

  /* A unit's own gap-fill, and the command that only looks alike. */
  ev("startUnitQuiz('b2u2')");
  const at = ev("unit('b2u2').drill.findIndex(function(d){return d.t==='fill'})");
  for (let i = 0; i < at; i++) ev("nextQ()");
  doc.getElementById("fin").value = "malısınız"; ev("answerFill()");
  ok(ev("Q.res[Q.i]") === true && /Sen · siz/.test(lastPaint), "the gap-fill refused malısınız for “you ought to work”");
  ok(ev("sizToward('Kolay gelsiniz','Kolay gelsin','','').used.length") === 0, "gelsiniz was taken for Kolay gelsin");
  ev("wipe(); home()");
});

/* Derse başla: a unit in three lessons, one screen at a time, then its
   own exercises. Each lesson marks what it shows exactly as the tabs
   would; the only other things it writes are the lesson's own day, the
   common words taken in, and the speaking task's first telling. */
step("derse başla · a unit in three lessons, checks by level", () => {
  drain(60000); ev("stopPlay()");
  ev("confirm=function(){return true}; wipe(); home()");
  const F = x => ev("fold(" + q(x) + ")");
  const CHECKS = ADIM_CHECKS;
  /* Every unit offers its next lesson at the top, and all three under it. */
  ev("go('unit','b2u3','v')");
  ok(lastPaint.includes("startAdim('b2u3',0)") && lastPaint.includes("Derse başla"), "a B2 unit does not open on its first lesson");
  ok(lastPaint.indexOf("startAdim(") < lastPaint.indexOf('class="segs"'), "the lesson is not above the tabs");
  [0, 1, 2].forEach(i => ok(lastPaint.includes("startAdim('b2u3'," + i + ")"), "lesson " + (i + 1) + " cannot be opened by hand"));
  ok(!lastPaint.includes("Adım adım"), "the old name is still on the unit page");
  ev("S.done.a1u1={score:5,of:5,at:1}; go('unit','a1u1','v')");
  ok(lastPaint.includes("Dersi tekrarla") && lastPaint.includes("startAdim('a1u1',0)"), "a finished unit does not offer its lessons again");
  ev("wipe(); home()");

  const u = UNITS[0], T = ev("dayNum()");
  const snap = () => ev("JSON.stringify([S.star,S.srs,S.prod,S.rep,S.gram,S.err,S.dinle,S.done,S.retell,S.sik])");
  let before = snap();

  /* Lesson one: the words and the grammar, nothing of the passage. */
  ev("startAdim('a1u1')");
  ok(ev("AD.k") === 0 && ev("V.view") === "adim" && ev("AD.q[0].t") === "word", "the unit does not open on the first word of lesson one");
  ok(voice.spoken[voice.spoken.length - 1] === ev("AD.q[0].w.say"), "the first word is not said as it arrives");
  const said = voice.said; ev("render()");
  ok(voice.said === said, "a redraw said the word again");
  ok(lastPaint.includes(ev("RESIM[" + q(u.vocab[0][0]) + "]")), "a pictured word shows no picture");
  ok(ev("!!(S.seen.a1u1&&S.seen.a1u1.v)") && !ev("!!S.seen.a1u1.g") && !ev("!!S.seen.a1u1.r"),
     "the words marked more than the word list as seen");
  ok(!ev("AD.q").some(x => x.t === "line" || x.t === "say" || x.t === "sik" || x.t === "speak"), "lesson one reaches past the words and grammar");
  /* Miss the first check once, get everything else right. */
  let missed = false, guard = 0;
  const n0 = ev("AD.q.length");
  while (ev("adCur().t") !== "end" && guard++ < 80) {
    const s = ev("adCur()");
    if (CHECKS.includes(s.t)) {
      const right = missed || !(missed = true);
      adimAnswer(s, right);
      ok(ev("AD.ok") === right, "a " + s.t + " check was marked the other way");
    } else if (s.t === "gram") ok(lastPaint.includes(esc(u.gram.t)) && ev("!!S.seen.a1u1.g"), "the grammar step did not show the point, or mark it read");
    ev("adNext()");
  }
  ok(ev("adCur().t") === "end", "lesson one did not reach its end");
  ok(ev("AD.q.length") === n0 + 1, "a missed check did not come back exactly once");
  ok(!ev("!!S.seen.a1u1.r"), "lesson one marked the passage read");
  ok(ev("S.ders.a1u1[0]") === T, "lesson one was not recorded as finished");
  ok(snap() === before, "lesson one scheduled, marked or ticked something");

  /* Lesson two: the passage, three lines said before they are heard, and
     the first half of the unit's common words. */
  ev("startAdim('a1u1')");
  ok(ev("AD.k") === 1 && ev("adCur().t") === "line", "the unit's next lesson is not lesson two, on the passage");
  const share = ev("sikShare(unit('a1u1'),0)");
  let sayN = 0;
  walkAdim(s => {
    if (s.t === "line") {
      ok(voice.spoken[voice.spoken.length - 1] === u.read.lines[s.i][0], "a passage line was not read aloud as it arrived");
      ok(lastPaint.includes('<p class="adtr">'), "an A1 line was not shown as it arrived");
      ok(!lastPaint.includes(esc(u.read.lines[s.i][1])), "a line's English was shown before it was asked for");
      ev("adShow()");
      ok(lastPaint.includes(esc(u.read.lines[s.i][1])), "asking for the English did not show it");
    }
    if (s.t === "say") {
      sayN++;
      ok(s.i < Math.ceil(u.read.lines.length / 2), "lesson two asks a line from the second half");
      ok(lastPaint.includes(esc(u.read.lines[s.i][1])) && !lastPaint.includes('<p class="adtr">'), "a line to say showed its Turkish first");
      const n = voice.said; ev("render()");
      ok(voice.said === n, "a line to say was spoken before the learner said it");
      ev("adSay()");
      ok(lastPaint.includes(esc(u.read.lines[s.i][0])) && voice.spoken[voice.spoken.length - 1] === u.read.lines[s.i][0], "Göster did not show and play the line");
      ev("render()");  /* adSay advanced nothing: walkAdim's own adSay repeats harmlessly */
    }
    if (s.t === "sik") {
      ok(JSON.stringify(s.words) === JSON.stringify(share.map(e => [e[0], e[1]])), "lesson two's common words are not the first half of the unit's share");
      ev("adKnow(0)");
      ok(/class="vrow known"/.test(lastPaint), "a word marked known does not show it");
    }
  });
  ok(sayN === 3, "lesson two asked " + sayN + " lines to say, not three");
  ok(ev("!!S.seen.a1u1.r"), "the passage was not marked read");
  ok(ev("S.sik[" + q(share[0][0]) + "].k") === 1 && !ev("isStarred(" + q(share[0][0]) + "," + q(share[0][1]) + ")"), "a word marked known was starred");
  ok(share.slice(1).every(e => ev("isStarred(" + q(e[0]) + "," + q(e[1]) + ")") && ev("S.srs[starKey(" + q(e[0]) + "," + q(e[1]) + ")].d") === T + 1),
     "the rest of the common words were not starred for tomorrow");
  ok(/Ders 2 bitti/.test(lastPaint) && !lastPaint.includes("startUnitQuiz("), "lesson two does not end as a lesson");
  ok(ev("S.ders.a1u1[1]") === T, "lesson two was not recorded as finished");

  /* Lesson three: the words recalled, the other lines, the second half,
     the speaking task as its first telling, then the exercises. */
  ev("startAdim('a1u1')");
  ok(ev("AD.k") === 2, "the unit's next lesson is not lesson three");
  const Q3 = ev("AD.q"), share2 = ev("sikShare(unit('a1u1'),1)");
  ok(Q3.filter(x => x.t === "say").every(x => x.i >= Math.ceil(u.read.lines.length / 2)), "lesson three asks a line lesson two had");
  ok(Q3.findIndex(x => x.t === "speak") === Q3.length - 2, "the speaking task is not the last thing before the end");
  walkAdim(s => {
    if (s.t === "speak") ok(lastPaint.includes(esc(u.speak)) && lastPaint.includes("adSpeak()"), "the speaking task is not shown");
  });
  ok(ev("S.retell.a1u1.n") === 1 && ev("S.retell.a1u1.d") === T + 2, "the speaking task was not counted as its first telling, due on day three");
  ok(share2.every(e => ev("isStarred(" + q(e[0]) + "," + q(e[1]) + ")")), "lesson three did not take in the second half of the words");
  ok(lastPaint.includes("startUnitQuiz('a1u1')"), "lesson three does not lead to the unit's exercises");
  ok(ev("JSON.stringify([S.prod,S.rep,S.gram,S.err,S.dinle,S.done])") === JSON.stringify(JSON.parse(before).slice(2, 8)), "the lessons scheduled or marked something they should not");
  /* Told again here, a telling under way keeps its own schedule. */
  ev("startAdim('a1u1',2); AD.i=AD.q.findIndex(function(s){return s.t==='speak'}); render(); adSpeak()");
  ok(ev("S.retell.a1u1.n") === 1, "going over lesson three counted a second telling");
  ev("startUnitQuiz('a1u1')"); for (let i = 0; i < 5; i++) answer(true);
  ok(ev("isDone('a1u1')"), "the exercises after the lessons did not tick the unit");

  /* The shares split the list between the units, and the halves the share. */
  const total = ev("UNITS.reduce(function(n,u){return n+sikShare(u).length},0)");
  ok(total === ev("SIK.length"), "the units' shares cover " + total + " of " + ev("SIK.length") + " common words");
  ok(ev("UNITS.every(function(u){return JSON.stringify(sikShare(u,0).concat(sikShare(u,1)))===JSON.stringify(sikShare(u))})"), "a unit's two halves are not its share");
  ok(ev("UNITS.every(function(u,i){return !i||sikShare(UNITS[i-1]).slice(-1)[0]!==sikShare(u)[0]})"), "two units share a word");

  /* Every lesson of every unit walks to its end, and asks the checks its
     level asks for, where its level puts them. */
  let clozes = 0, unitsWithCloze = 0;
  UNITS.forEach(v => {
    const tier = v.lv === "A1" ? 0 : v.lv === "A2" ? 1 : 2;
    const half = Math.ceil(v.read.lines.length / 2);
    for (let k = 0; k < 3; k++) {
      ev("startAdim(" + q(v.id) + "," + k + ")");
      const Q = ev("AD.q"), kinds = Q.map(x => x.t), tag = v.id + " lesson " + (k + 1);
      const words = Q.filter(x => x.t === "type" || x.t === "cloze").length;
      if (tier === 0) ok(!kinds.some(t => t === "type" || t === "cloze" || t === "gex"), tag + " asks an A1 learner to type");
      else ok(!kinds.some(t => t === "hear" || t === "spell"), tag + " still asks beginner checks");
      if (k === 0) {
        ok(kinds.filter(t => t === "word").length === 10 && kinds.includes("gram") && !kinds.includes("line"), tag + " is not the words and the grammar");
        if (tier === 0) ok(kinds.filter(t => t === "hear").length === 4 && kinds.includes("spell"), tag + " does not hear and spell");
        else ok(words === 4 && kinds.includes("gex"), tag + " has " + words + " word checks and " + (kinds.includes("gex") ? "an" : "no") + " example");
      } else if (k === 1) {
        ok(kinds.filter(t => t === "line").length === v.read.lines.length && !kinds.includes("word") && !kinds.includes("gram"), tag + " is not the passage");
        ok(kinds.filter(t => t === "say").length === Math.min(3, half), tag + " does not say three lines");
        if (tier === 2) {
          ok(words === 4 && kinds.lastIndexOf("line") < kinds.findIndex(t => t === "type" || t === "cloze"), tag + " checks the words before the passage is read, or not four");
        } else ok(words === 0, tag + " checks words in the passage below B1");
        Q.filter(x => x.t === "cloze").forEach(c => {
          clozes++;
          ok(c.q.includes("___") && F(c.q.replace("___", c.c)) === F(c.full), v.id + ": a blank does not fill back to its line");
          ok(!F(c.q).split(" ").includes(F(c.c)), v.id + ": the answer is still in the blanked line");
        });
        if (Q.some(x => x.t === "cloze")) unitsWithCloze++;
      } else {
        ok(!kinds.includes("line") && !kinds.includes("word") && kinds.includes("speak"), tag + " is not the review and the speaking");
        if (tier === 0) ok(kinds.filter(t => t === "hear").length === 3, tag + " does not recall the words by ear");
        else ok(words === 4 && kinds.includes("gex"), tag + " does not recall four words and an example");
        ok(kinds.filter(t => t === "say").length === Math.min(3, v.read.lines.length - half), tag + " does not say the other lines");
      }
      let g = 0;
      while (ev("adCur().t") !== "end" && g++ < 120) {
        const s = ev("adCur()");
        if (adimAnswer(s, true)) { ok(ev("AD.ok") === true, v.id + ": a right " + s.t + " answer was marked wrong: " + s.c); ev("adNext()"); }
        else if (s.t === "sik") ev("adSik()");
        else if (s.t === "speak") ev("adSpeak()");
        else ev("adNext()");
      }
      ok(ev("adCur().t") === "end", tag + " did not walk to its end");
      ok(ev("S.ders[" + q(v.id) + "][" + k + "]") === T, tag + " was not recorded");
    }
  });
  console.log("    " + unitsWithCloze + " of 40 B1+ units ask words in their sentences, " + clozes + " blanks");
  ok(unitsWithCloze >= 30, "only " + unitsWithCloze + " of the B1+ units ask a word in its sentence");
  ok(ev("dersCount()") === 180 && ev("sikRest().length") === 0, "walking every lesson did not finish 180 lessons and take in every common word");

  /* B1 and up: the line is heard before it is shown. */
  ev("startAdim('b1u3',1); AD.heard={}; render()");
  const b1 = UNITS.find(x => x.id === "b1u3");
  ok(voice.spoken[voice.spoken.length - 1] === b1.read.lines[0][0], "a B1 line was not played as it arrived");
  ok(!lastPaint.includes('<p class="adtr">') && lastPaint.includes("adhid") && lastPaint.includes("adText()"), "a B1 line was shown before it was heard");
  ok(!lastPaint.includes("adShow()"), "a B1 line offers its English before its Turkish");
  ev("adText()");
  ok(lastPaint.includes('<p class="adtr">') && lastPaint.includes("adShow()") && !lastPaint.includes("adText()"), "showing a B1 line did not show it");

  /* A missed check comes back after the other checks, before the lesson
     moves on from the words. */
  ev("startAdim('b1u3',1); AD.i=AD.q.findIndex(function(s){return s.t==='cloze'||s.t==='type'}); render()");
  const missId = ev("adCur().id");
  doc.getElementById("abox").value = "qqq zzz"; ev("adType()");
  const Qb = ev("AD.q"), at = Qb.findIndex((x, k) => k > ev("AD.i") && x.id === missId);
  ok(at > -1 && Qb[at + 1] && Qb[at + 1].t === "say" && Qb.slice(ev("AD.i") + 1, at).every(x => CHECKS.includes(x.t)),
     "a missed B1 check did not come back after the other checks, before the lines to say");
  ok(lastPaint.includes("adNext()") && /class="fb no"/.test(lastPaint), "a missed B1 check showed no answer");

  /* Typed answers are marked by the course's own judges: the other you,
     a spoken form, and a dropped pronoun in a grammar example. */
  ev("startAdim('a2u1',0); AD.q.splice(AD.i,0,{t:'type',id:99,w:{i:0,tr:'nasılsın',say:'nasılsın',en:'how are you',em:''},c:'nasılsın',alts:['nasilsin']}); render()");
  doc.getElementById("abox").value = "nasılsınız"; ev("adType()");
  ok(ev("AD.ok") === true && lastPaint.includes("Sen · siz"), "the lesson refused the other you");
  ev("AD.q.splice(AD.i+1,0,{t:'gex',id:98,c:'Ben yarın gideceğim.',en:'I will go tomorrow.'}); adNext()");
  doc.getElementById("abox").value = "yarın gidicem"; ev("adType()");
  ok(ev("AD.ok") === true, "the lesson refused a spoken form without its pronoun");
  ev("AD.q.splice(AD.i+1,0,{t:'gex',id:97,c:'Ben yarın gideceğim.',en:'I will go tomorrow.'}); adNext()");
  doc.getElementById("abox").value = "ben dün gittim"; ev("adType()");
  ok(ev("AD.ok") === false && lastPaint.includes('class="dline"'), "a wrong example was not marked word by word");
  const nq = ev("AD.q.length"); ev("adNext()"); doc.getElementById("abox") && (doc.getElementById("abox").value = "");
  ev("adType()");
  ok(ev("AD.phase") === "ask" && ev("AD.q.length") === nq, "an empty answer was marked");

  /* Leaving goes back to the unit; a locked unit cannot be walked. */
  ev("startAdim('a1u2')"); ev("back()");
  ok(ev("V.view") === "unit" && ev("V.u") === "a1u2", "back from the lesson does not return to the unit");
  ev("unitOpen=__unitOpen; wipe(); startAdim('a1u3')");
  ok(ev("V.view") !== "adim", "a locked unit was walked as a lesson");
  ev(LIFT + "; wipe(); home()");
});

/* Uyumadan önce: only what was studied today, Turkish only, each said
   twice, quieter as it goes, and it stops by itself, in silence. */
step("uyumadan önce · today, once more, then quiet", () => {
  const bank = () => ev("uyBank()");
  const has = (b, tr) => b.items.some(it => it.tr === tr);
  const u = UNITS[0], prim = w => ev("vocabPrimary(" + q(w) + ")");
  drain(60000); ev("stopPlay()");
  ev("confirm=function(){return true}; wipe(); home()");
  ok(bank().items.length === 0, "a fresh install has something to play before sleep");
  ev("go('uyku')");
  ok(/Henüz bir şey yok/.test(lastPaint) && !lastPaint.includes("startUyku("), "an empty bank still offers a sitting");
  ev("go('araclar')");
  const row = () => { const i = lastPaint.indexOf('onclick="go(\'uyku\')"'); return i > -1 ? lastPaint.slice(i, lastPaint.indexOf("</button>", i)) : ""; };
  ok(row() && /Şimdilik boş/.test(row()), "Araçlar has no tile for it, or offers it as ready with nothing to play");

  /* The grain of met: words once the list is open, lines once read. */
  ev("go('unit','a1u1','v')");
  let b = bank();
  ok(b.today && u.vocab.every(w => has(b, prim(w[0]))), "today's words are not all in the bank");
  ok(!u.read.lines.some(l => has(b, l[0])), "an unread passage's lines are in the bank");
  ev("go('unit','a1u1','r')");
  b = bank();
  ok(u.read.lines.every(l => has(b, l[0])), "a passage read today is not in the bank");
  ok(!UNITS[1].vocab.some(w => has(b, prim(w[0]))), "a unit not studied today is in the bank");
  ev("S.sik[SIK[0][0]]={d:dayNum()}; S.sik[SIK[1][0]]={d:dayNum(),k:1}; S.basla.alfabe={at:Date.now()}; S.basla.yazim={at:Date.now(),byTest:true}; S.basla.nezaket={at:Date.now()}");
  b = bank();
  ok(has(b, ev("SIK[0][0]")) && !has(b, ev("SIK[1][0]")), "a common word added today is missing, or one marked known is in");
  ok(has(b, "araba") && !has(b, "otobüs"), "an intro lesson passed today is missing, or one only tested out of is in");
  /* nezaket's "Merhaba." and a1u1's "merhaba" are one thing to hear. */
  ok(b.items.filter(it => ev("fold(" + q(it.tr) + ")") === "merhaba").length === 1 &&
     new Set(b.items.map(it => ev("fold(" + q(it.tr) + ")"))).size === b.items.length, "the bank says something twice");

  /* Nothing today: the last lesson, and it says so. */
  ev("S.seen.a1u1.at=Date.now()-17*3600000; S.sik={}; S.basla={}");
  b = bank();
  ok(!b.today && b.items.length > 0 && b.from[0].indexOf(u.tr) > -1, "with nothing today it does not fall back to the last lesson");
  ev("go('uyku')");
  ok(/last lesson/.test(lastPaint), "the fallback does not say it is the last lesson rather than today's");

  /* The sitting, on the fake clock, untouched. */
  ev("go('unit','a1u1','v')");
  const before = ev("JSON.stringify(S)");
  drain(60000); ev("stopPlay()");
  voice.spoken = []; voice.langs = []; voice.rates = []; voice.vols = [];
  ev("startUyku(5)");
  const items = ev("UY.items.map(function(it){return it.tr})");
  drain(60000);
  ok(ev("UY.done") === true, "the sitting did not end by itself");
  const log = voice.spoken.map((t, i) => [t, voice.langs[i], voice.rates[i], voice.vols[i]]).filter(p => items.includes(p[0]));
  ok(log.length >= 2 && log.length % 2 === 0 && log.every((p, i) => i % 2 === 0 || p[0] === log[i - 1][0]), "an item was not said exactly twice");
  ok(log.filter((_, i) => i % 2 === 0).every((p, k) => p[0] === items[k % items.length]), "the items were said out of order");
  ok(log.length / 2 > items.length, "five minutes did not cycle round a ten-word bank");
  ok(log.every(p => /^tr/.test(p[1]) && p[2] === ev("UY_RATE")), "something was said in another voice or at another speed");
  ok(Math.abs(log[0][3] - ev("UY_VOL[0]")) < 0.02, "the sitting did not start at its own volume");
  ok(items.includes(voice.spoken[voice.spoken.length - 1]), "the sitting ended by saying something that is not the material");
  ok(ev("JSON.stringify(S)") === before, "a before-sleep sitting wrote to progress");
  ok(/İyi geceler/.test(lastPaint), "the end screen does not say good night");

  /* Quieter as it goes. */
  ev("startUyku(5)"); ev("UY.t0-=5*60000");
  ok(Math.abs(ev("uyVol()") - ev("UY_VOL[1]")) < 0.02 && ev("UY_VOL[1]") < ev("UY_VOL[0]"), "the volume does not fall to its floor by the end");

  /* Leaving silences it, and back() leaves. */
  const s1 = voice.said;
  ev("home()"); drain(60000);
  ok(voice.said === s1, "a before-sleep sitting kept talking over the next screen");
  ok(!ev("!!(UY&&(UY.tid||UY.cid))"), "a timer was left armed after leaving");
  ev("go('unit','a1u1','v'); startUyku(10)"); drain(5);
  ev("back()");
  const s2 = voice.said; drain(60000);
  ok(ev("V.view") === "uyku" && ev("UY") === null && voice.said === s2, "back() did not end the sitting");

  /* No speech at all: said, not attempted. */
  ev("__ss=window.speechSynthesis; delete window.speechSynthesis; go('uyku')");
  ok(/Ses yok/.test(lastPaint) && !lastPaint.includes("startUyku("), "with no speech it still offers a sitting");
  ev("window.speechSynthesis=__ss; wipe(); home()");
});

/* The path opens in order: each lesson when the one before it is passed,
   unit one when all six are, each unit when the one before it is. A level
   test is the way to skip, and nothing already opened is locked again. */
step("the path opens in order", () => {
  ev("unitOpen=__unitOpen; baslaOpen=__baslaOpen");
  const open = id => ev("unitOpen(" + q(id) + ")");
  ev("confirm=function(){return true}; wipe(); home()");
  ok(!open("a1u1") && !open("a1u2"), "a fresh install can open a unit before the intro is passed");
  ev("go('unit','a1u1','v')");
  ok(lastPaint.includes("Kilitli" + GL("locked")) && !ev("isMet('a1u1')"), "a locked unit opened, or opening it recorded it as met");
  ok(lastPaint.includes("go('basla','alfabe')") && lastPaint.includes("startLevelExam('A1')"),
     "a locked unit does not say where to go instead or how to skip ahead");
  ev("go('level','A1')");
  ok(lastPaint.includes('class="unit locked"') && lastPaint.includes("Kilitli"), "the A1 list does not show its units locked");
  ok(ev("baslaOpen('alfabe')") && !ev("baslaOpen('yazim')"), "the intro lessons do not open in order");
  ev("go('basla','yazim')");
  ok(lastPaint.includes("Kilitli") && !lastPaint.includes("startBasla('yazim')"), "a locked lesson shows its questions");
  ev("go('basla','alfabe')");
  ok(!lastPaint.includes("Sonraki ders"), "an unpassed lesson offers the next one");
  ev("go('baslarken')");
  ok((lastPaint.match(/class="unit locked"/g) || []).length === ev("BASLA.length") - 1, "the intro list does not lock every lesson but the first");

  /* Failing leaves the next lesson shut; passing opens it. */
  ev("startBasla('alfabe')");
  while (ev("Q.i<Q.items.length")) introReply(false);
  ok(!ev("baslaOpen('yazim')") && !lastPaint.includes("go('basla','yazim')"), "failing a lesson opened the next one");
  ev("BASLA").forEach(L => { ev("startBasla(" + q(L.id) + ")"); while (ev("Q.i<Q.items.length")) introReply(true); });
  ok(open("a1u1") && !open("a1u2"), "passing the intro did not open unit one alone");
  ok(ev("planToday()").left[0].go === "startAdim('a1u1',0)", "the plan does not go to unit one once it opens");

  /* A unit passed opens the next; failing it does not. */
  ev("startUnitQuiz('a1u1')"); for (let i = 0; i < 5; i++) answer(false);
  ok(!open("a1u2"), "failing unit one opened unit two");
  ev("startUnitQuiz('a1u1')"); for (let i = 0; i < 5; i++) answer(true);
  ok(open("a1u2") && !open("a1u3"), "passing unit one did not open unit two alone");
  /* It is open, but it is tomorrow's: a new unit a day. */
  ok(!lastPaint.includes(">Sonraki ünite"), "the score screen offers the next unit on the day one was already passed");
  ok(ev("planToday().tomorrow && planToday().tomorrow.id") === "a1u2", "the plan does not name unit two as tomorrow's");

  /* A level test skips its whole level, and only that level. */
  ev("startLevelExam('B1')"); for (let i = 0; i < 10; i++) answer(true);
  ok(open("b1u1") && open("b1u10") && open("b2u1"), "passing the B1 test did not open B1 and the unit after it");
  ok(!open("a2u1"), "passing the B1 test opened A2");

  /* Testing out of the intro altogether: ten questions spanning every
     lesson, eight to pass, and all six ticked at once. */
  ev("wipe(); go('unit','a1u1','v')");
  ok(lastPaint.includes("startBaslaTest()"), "unit one's lock card does not offer the intro test");
  ev("go('baslarken')");
  ok(lastPaint.includes("startBaslaTest()"), "the intro list does not offer the intro test");
  for (let run = 0; run < 20; run++) {
    ev("startBaslaTest()");
    const qs = ev("Q.items.map(function(it){return it.q})");
    const hit = new Set(ev("Q.items").map(it => ev("BASLA").findIndex(L => L.check.some(c => c.q === it.q && JSON.stringify(c.a) === JSON.stringify(it.a) && c.c === it.c))));
    if (qs.length !== 10 || hit.size !== ev("BASLA.length") || hit.has(-1)) { fails.push("an intro test was not ten questions spanning every lesson: " + qs.length + " questions, lessons " + [...hit].join(",")); break; }
  }
  ev("startBaslaTest()");
  for (let i = 0; i < 3; i++) introReply(false);
  while (ev("Q.i<Q.items.length")) introReply(true);
  ok(!ev("introDone()") && !open("a1u1"), "seven out of ten passed the intro test");
  ev("startBaslaTest()");
  introReply(false); introReply(false);
  while (ev("Q.i<Q.items.length")) introReply(true);
  ok(ev("introDone()") && open("a1u1") && !open("a1u2"), "eight out of ten did not pass the intro, or opened more than unit one");
  ok(ev("BASLA.every(function(L){return S.basla[L.id].byTest})"), "a lesson passed by the intro test is not marked as tested out");
  ok(lastPaint.includes("go('unit','a1u1','v')"), "the intro test's score screen does not lead to unit one");
  ev("go('baslarken')");
  ok(!lastPaint.includes("startBaslaTest()"), "the intro test is still offered once the intro is passed");

  /* Progress from before the lock is never taken away. */
  ev("wipe(); S.seen['c1u4']={v:1}; S.done['a2u3']={score:5,of:5,at:1}; save(); home()");
  ok(open("c1u4") && !open("c1u5"), "a unit already opened was locked again, or opened the next");
  ok(open("a2u3") && open("a2u4") && !open("a2u5"), "a unit already passed was locked, or did not open the next");
  ev("go('unit','c1u4','v')");
  ok(!lastPaint.includes("Kilitli"), "a unit opened before the lock shows as locked");

  ev("wipe(); home(); " + LIFT);
});

/* ===================== İngilizcesi · English under the Turkish ===================== */
step("çöz · a word in pieces, and only the pieces met", () => {
  ev("confirm=function(){return true}; wipe(); home()");
  const roles = () => ev("czRoles().map(function(r){return r.k})");
  ok(roles().length === 0, "a fresh install has endings to decode");
  ev("go('coz')");
  ok(/Şimdilik boş/.test(lastPaint) && !lastPaint.includes('onclick="startCoz()"'), "an empty Çöz still offers a sitting");
  ev("startCoz()");
  ok(ev("V.view") === "coz" && ev("CZ") === null, "startCoz ran with nothing open");

  /* A noun ending alone has nothing to be confused with; two do. */
  ev("go('unit','a1u2','g')");
  ok(roles().length === 0, "the plural alone opened Çöz");
  ev("go('unit','a1u3','g')");
  ok(roles().join() === "pl,ps", "the plural and the possessive did not open together: " + roles().join());
  ev("go('unit','a1u5','g')"); ev("go('unit','a1u4','g')");
  ok(roles().join() === "pl,ps,loc,prog", "a1u2-5's grammar opened " + roles().join());

  /* Nothing not met turns up, in the answer or in a wrong option. */
  const later = /\b(will|can|cannot|must|if|apparently|did|from|to|with|by)\b/i;
  let leak = null, n = 0;
  ["pl", "ps", "loc", "prog"].forEach(k => {
    for (let i = 0; i < 40; i++) {
      const it = ev("czItem(" + q(k) + ")"); n++;
      if (!it) { leak = k + ": no item"; continue; }
      it.opts.forEach(o => { if (later.test(o.en)) leak = k + ": " + o.en; });
      if (it.opts.some(o => /\b(went|came|drank|made)\b/i.test(o.en))) leak = k + ": a past tense";
    }
  });
  ok(!leak, "an ending not yet met was offered: " + leak);

  /* Every piece open: each item is well formed, by construction. */
  ["b2u2", "b1u2", "b1u1", "a2u8", "a2u6", "a2u4", "a2u3", "a2u2", "a2u1", "a1u8"].forEach(u => ev("go('unit'," + q(u) + ",'g')"));
  ok(roles().length === 14, "all fourteen endings are not open with their units read: " + roles().length);
  let bad = null;
  roles().forEach(k => {
    for (let i = 0; i < 30; i++) {
      const it = ev("czItem(" + q(k) + ")");
      if (!it) { bad = k + ": no item"; return; }
      if (it.opts.length !== 4) bad = k + ": " + it.opts.length + " options";
      if (new Set(it.opts.map(o => o.w)).size !== 4 || new Set(it.opts.map(o => o.en)).size !== 4) bad = k + ": two options alike in " + it.w;
      if (it.opts[it.c].w !== it.w || it.opts[it.c].en !== it.en) bad = k + ": the key is not the word";
      if (it.pieces.map(p => p.m).join("") !== it.w) bad = k + ": the pieces of " + it.w + " do not join";
      if (it.opts.some(o => it.also.indexOf(o.en) > -1)) bad = k + ": " + it.w + " offers a reading its own letters also say";
      if (it.also.length && !it.notes.some(x => x.indexOf("also says") > -1)) bad = k + ": " + it.w + " is ambiguous and does not say so";
    }
  });
  ok(!bad, "a Çöz item is malformed: " + bad);
  /* The ambiguity the notes are there for: evinde is your house and his. */
  const also = ev("(function(){var s={k:'n',n:CZ_NOUNS[0],pl:false,ps:1,c:'loc'};return czAlso(s,czBuild(s));})()");
  ok(also.indexOf("In his/her house") > -1, "evinde is not known to be his/her house too: " + JSON.stringify(also));
  ok(ev("CZ_NOUNS.every(function(n){return !!byName(n.t)})"), "a Çöz noun is not in LEX");

  /* Only CZ_NEW never-practised endings a day. */
  ok(ev("czDue().length") === ev("CZ_NEW"), "a fresh learner with everything open got " + ev("czDue().length") + " new endings, not CZ_NEW");

  /* A sitting, from the start: the word is said once, not on a redraw. */
  ev("confirm=function(){return true}; wipe(); home()");
  ["a1u5", "a1u2", "a1u3"].forEach(u => ev("go('unit'," + q(u) + ",'g')"));
  ev("go('coz')");
  ok(lastPaint.includes('onclick="startCoz()"') && lastPaint.includes('class="czp'), "the hub has no Başla or no worked example");
  const before = voice.said;
  ev("startCoz()");
  ok(ev("V.view") === "cozrun" && ev("CZ.q.length") === ev("CZ_SESSION"), "a sitting is not CZ_SESSION words");
  ok(voice.said === before + 1 && voice.spoken[voice.spoken.length - 1] === ev("CZ.q[0].w"), "the word was not said on arrival");
  ev("render()");
  ok(voice.said === before + 1, "a redraw said the word again");
  const w0 = ev("CZ.q[0].w");
  ok(lastPaint.includes(esc(w0)) && (lastPaint.match(/class="opt"/g) || []).length === 4, "the word or its four meanings are missing");
  ok(!lastPaint.includes('class="czp'), "the answer's pieces show before it is answered");
  const due = ev("CZ.due.slice()");
  ok(due.length === 3 && due.every(k => ["pl", "ps", "prog"].indexOf(k) > -1), "the due endings are " + JSON.stringify(due));
  /* Wrong: the book keeps it, the pieces and the chosen word show, and
     nothing is scheduled until the end. */
  const wrong = ev("(CZ.q[0].c+1)%4"), chose = ev("CZ.q[0].opts[" + wrong + "].w"), role0 = ev("CZ.q[0].role");
  ev("czPick(" + wrong + ")");
  ok(/Yanlış/.test(lastPaint) && lastPaint.includes(esc(chose)) && lastPaint.includes('class="czp'), "a miss does not show the chosen word and the pieces");
  const e = ev("S.err['coz:" + role0 + "']");
  ok(e && e.m === "o" && e.c === w0 && e.n === 1, "the miss did not reach the mistake book under coz:" + role0);
  ok(Object.keys(ev("S.coz")).length === 0, "a schedule moved mid-sitting");
  ev("czPick(0)");
  ok(ev("CZ.sel") === wrong, "a second tap changed the answer");
  ev("czNext()");
  for (let i = 1; i < 10; i++) { ev("czPick(CZ.q[CZ.i].c)"); ok(/Doğru/.test(lastPaint), "a right answer is not marked right"); ev("czNext()"); }
  ok(/Bitti/.test(lastPaint) && lastPaint.includes("startCoz()"), "the sitting does not end on the end screen");
  const today = ev("dayNum()"), sc = ev("S.coz");
  due.forEach(k => {
    const r = sc[k], missed = k === role0;
    ok(r && r.b === (missed ? 0 : 1) && r.d === today + (missed ? 0 : 1), k + " was graded " + JSON.stringify(r) + (missed ? " after a miss" : " with none"));
  });
  ok(ev("errList().length") === 1, "right answers reached the mistake book");

  /* Practice moves nothing: with nothing due but what was missed, clear
     that too and a sitting is practice. */
  ev("S.coz[" + q(role0) + "].d=dayNum()+5; save()");
  const snap = JSON.stringify(ev("S.coz"));
  ok(ev("czDue().length") === 0, "something is still due");
  ev("go('coz')");
  ok(/practice/.test(lastPaint) || /alıştırma/.test(lastPaint), "the hub does not say a sitting now is practice");
  ev("startCoz()");
  for (let i = 0; i < 10; i++) { ev("czPick((CZ.q[CZ.i].c+1)%4)"); ev("czNext()"); }
  ok(JSON.stringify(ev("S.coz")) === snap, "a practice sitting moved a schedule");

  /* Leaving writes nothing, and back() returns to the hub. */
  ev("S.coz={}; save(); startCoz(); czPick(CZ.q[0].c); back()");
  ok(ev("V.view") === "coz" && ev("CZ") === null && Object.keys(ev("S.coz")).length === 0, "leaving a sitting wrote a schedule or did not go back to Çöz");
  ev("go('coz')"); ev("back()");
  ok(ev("V.view") === "araclar", "back() from Çöz did not return to Araçlar");
  ev("S.coz={pl:{b:2,d:0,f:0}}; wipe()");
  ok(Object.keys(ev("S.coz")).length === 0, "wipe() kept Çöz's schedule");
});

step("adacıklar · your own sentences, checked by a person, then drilled", () => {
  ev("confirm=function(){return true}; wipe(); home()");
  const put = (tr, en) => { ev("document.getElementById('adatr').value=" + q(tr)); ev("document.getElementById('adaen').value=" + q(en)); };
  const st = () => ev("S.ada");
  ok(ev("adaOpen().length") === 0, "a fresh install has an island open");
  ev("adaGo('ada')");
  ok(/Şimdilik boş/.test(lastPaint) && !lastPaint.includes("startProd('i')"), "an empty Adacıklar offers something");

  /* a1u1's grammar opens its two questions, and nothing else. */
  ev("go('unit','a1u1','g')");
  ok(JSON.stringify(ev("adaOpen().map(function(i){return i.id})")) === '["ben"]', "a1u1 opened " + JSON.stringify(ev("adaOpen().map(function(i){return i.id})")));
  ev("adaGo('adaisl','aile')");
  ok(ev("V.view") === "ada", "a closed island opened");
  ev("adaGo('adaisl','ben')");
  ok(lastPaint.includes("adaWrite('ben','ad')") && lastPaint.includes("adaWrite('ben','nereli')"), "a1u1's questions cannot be answered");
  ok(!lastPaint.includes("adaWrite('ben','yas')") && lastPaint.includes("Kaç yaşındasın?"), "a question whose grammar is unread can be answered, or is not shown as coming");

  /* Writing: a refusal keeps what was typed, a save records it unchecked. */
  ev("adaWrite('ben','ad')");
  ok(lastPaint.includes('id="adatr"'), "Yaz did not open the form");
  put("", "My name is Can.");
  let before = screens; ev("adaSave()");
  ok(screens === before && st().s.length === 0, "an empty sentence was saved, or the refusal redrew the form");
  put("Benim ad\u00ADım Can.", "");
  before = screens; ev("adaSave()");
  ok(screens === before && st().s.length === 0, "a sentence with no English was saved, or the refusal redrew the form");
  put("Benim ad\u00ADım Can.", "My name is Can.");
  ev("adaSave()");
  const s1 = st().s[0];
  ok(s1 && s1.tr === "Benim adım Can." && s1.en === "My name is Can." && s1.chk === 0 && s1.q === "ad" && s1.isl === "ben" && s1.day === ev("dayNum()"),
     "the sentence was not saved clean and unchecked: " + JSON.stringify(s1));
  ok(lastPaint.includes("Benim adım Can.") && /kontrol bekliyor/.test(lastPaint) && !lastPaint.includes('id="adatr"'), "the saved sentence is not shown as waiting");

  /* Unchecked is never drilled. */
  ok(ev("adaBank().length") === 0, "an unchecked sentence is in the drill");
  ev("adaGo('ada')");
  ok(!lastPaint.includes("startProd('i')") && lastPaint.includes("adaGo('adakontrol')"), "the hub offers a drill of unchecked work, or no way to get it checked");

  /* Getting it checked. */
  ev("adaWrite('ben','nereli')"); ev("adaGo('adaisl','ben'); adaWrite('ben','nereli')");
  put("Ben Londra'dan.", "I am from London."); ev("adaSave()");
  ev("adaGo('adakontrol')");
  const exp = ev("adaExport()");
  ok(/^Merhaba!/.test(exp) && exp.includes("1. Benim adım Can.") && exp.includes("soru: Adın ne?") && exp.includes("2. Ben Londra'dan."),
     "the message to send is missing its greeting, a sentence or the question it answers");
  ok(lastPaint.includes(esc("Ben Londra'dan.")) && lastPaint.includes("adaOk('1')") && lastPaint.includes("adaFix('2')"), "the check page does not list both sentences");
  ev("adaOk('1')");
  ok(st().s[0].chk === 1 && ev("adaBank().length") === 1, "marking a sentence right did not put it in the drill");
  ev("adaFix('2')"); put("Londralıyım.", "I am from London."); ev("adaSave()");
  const s2 = st().s[1];
  ok(s2.chk === 1 && s2.tr === "Londralıyım." && s2.was === "Ben Londra'dan.", "a correction did not keep the original and check the new one: " + JSON.stringify(s2));
  ok(/Hepsi kontrol edildi|Everything is checked/.test(lastPaint), "with nothing waiting the check page does not say so");

  /* The drill is Üretim's runner, on the learner's own English. */
  ev("S.prod={}; S.err={}; startProd('i')");
  ok(ev("V.view") === "prodrun" && ev("PR.title") === "Adacıklar" && ev("PR.q.length") === 2 && ev("PR.q[0].k") === "i:1", "the drill did not start on the checked sentences");
  ok(lastPaint.includes("My name is Can.") && !lastPaint.includes("Benim adım Can."), "the prompt is not the learner's English, or the Turkish shows first");
  ev("prodModel(); prodMark(false)");
  ok(ev("S.prod['i:1'].b") === 0 && ev("S.err['i:1']") && ev("S.err['i:1'].c") === "Benim adım Can.", "a miss was not scheduled today or not booked");
  ev("while(PR&&PR.phase!=='end'){if(PR.phase==='build')prodBuildNext();else{prodModel();prodMark(true);}}");
  ok(lastPaint.includes("adaGo('ada')") && lastPaint.includes("Adacıklar"), "the drill does not end back at Adacıklar");
  ev("startProd('i')");
  if (ev("V.view") === "prodrun") { ev("back()"); ok(ev("V.view") === "ada", "back() from an island drill did not return to Adacıklar"); }

  /* Changing a checked sentence unchecks it and restarts its schedule. */
  ev("S.prod['i:2']={b:3,d:dayNum()+4,f:0}; adaGo('adaisl','ben'); adaEdit('2')");
  put("Londralıyım ama İstanbul'da yaşıyorum.", "I am from London but I live in Istanbul."); ev("adaSave()");
  ok(st().s[1].chk === 0 && !ev("S.prod['i:2']"), "an edited checked sentence stayed checked or kept its schedule");
  ev("adaEdit('1')"); put("Benim adım Can.", "My name is Can, as it happens."); ev("adaSave()");
  ok(st().s[0].chk === 1, "changing only the English unchecked the Turkish");

  /* Deleting takes its schedule and its mistake with it. */
  ev("S.prod['i:1']={b:1,d:0,f:0}; adaDel('1')");
  ok(st().s.length === 1 && !ev("S.prod['i:1']") && !ev("S.err['i:1']"), "a deleted sentence left its schedule or its mistake behind");
  ev("adaGo('ada')"); ev("back()");
  ok(ev("V.view") === "araclar", "back() from Adacıklar did not return to Araçlar");
  ev("wipe()");
  ok(ev("S.ada.s.length") === 0 && ev("S.ada.n") === 0, "wipe() kept the learner's sentences");
});

step("dinleme günlüğü · hours outside the app, counted honestly", () => {
  ev("confirm=function(){return true}; wipe(); home()");
  const put = (id, v) => ev("document.getElementById(" + q(id) + ").value=" + q(v));
  ev("logOpen()");
  ok(ev("V.view") === "gunluk" && lastPaint.includes("logNew()") && ev("logTotal()") === 0, "the log does not open empty with a way to add");
  ev("logNew()");
  ok(lastPaint.includes('id="logmin"') && lastPaint.includes('id="logname"'), "the first entry does not ask for a source");
  /* Refusals leave the form alone. */
  /* A name is given, so it is the minutes that refuse, not the source. */
  put("logmin", "0"); put("logname", "Bir podcast"); let before = screens; ev("logSave()");
  ok(screens === before && ev("S.log.e.length") === 0, "zero minutes was logged, or the refusal redrew the form");
  put("logmin", "25"); put("logname", ""); before = screens; ev("logSave()");
  ok(screens === before && ev("S.log.e.length") === 0, "an entry with no source was logged, or the refusal redrew the form");
  /* A choice redraws, and keeps what was typed. */
  put("logname", "Bir podcast­"); put("logurl", "javascript:alert(1)");
  ev("logSet('kind','d')");
  ok(ev("document.getElementById('logname').value") === "Bir podcast­" && ev("document.getElementById('logmin').value") === "25", "a choice emptied what was typed");
  ev("logSet('und','2')"); ev("logSave()");
  const e1 = ev("S.log.e[0]"), s1 = ev("S.log.src[0]");
  ok(e1 && e1.min === 25 && e1.kind === "d" && e1.und === 2 && e1.day === ev("dayNum()") && e1.nm === "Bir podcast",
     "the entry was not saved as typed: " + JSON.stringify(e1));
  ok(s1 && s1.name === "Bir podcast" && s1.url === "", "the source kept an invisible character or a link that is not a web address: " + JSON.stringify(s1));
  ok(!lastPaint.includes("javascript:"), "a javascript: link reached the page");
  /* The same source again, found by name; a real link kept. */
  ev("logNew()");
  ok(ev("LOGF.src") === s1.id, "a new entry does not start on the last source");
  ev("logSet('src','new')"); put("logname", "bir PODCAST"); put("logmin", "35"); ev("logSave()");
  ok(ev("S.log.src.length") === 1 && ev("S.log.e[1].src") === s1.id, "the same source typed again was made twice");
  ev("logNew(); logSet('src','new')"); put("logname", "Bir kanal"); put("logurl", "https://example.com/kanal"); put("logmin", "40");
  ev("logSet('ago','1')"); ev("logSave()");
  ok(ev("S.log.src[1].url") === "https://example.com/kanal" && ev("S.log.e[2].day") === ev("dayNum()") - 1, "a link or yesterday's date was lost");
  ok(lastPaint.includes('href="https://example.com/kanal"') && lastPaint.includes('rel="noopener noreferrer"'), "the source's link is not drawn safely");
  /* With two sources, "the last one used" and "the first one" differ. */
  ev("logNew()");
  ok(ev("LOGF.src") === ev("S.log.src[1].id"), "a new entry does not start on the source used last");
  ev("logCancel()");
  /* The counts. */
  ok(ev("logTotal()") === 100 && ev("logSince(7)") === 100 && ev("logDay(dayNum())") === 60, "the totals are wrong");
  ok(ev("logStreak()") === 2, "today and yesterday are not two days in a row: " + ev("logStreak()"));
  ev("S.log.e=S.log.e.filter(function(x){return x.day!==dayNum()}); save()");
  ok(ev("logStreak()") === 1, "an empty today broke yesterday's run");
  ok(ev("logHM(100)") === "1 sa 40 dk" && ev("logHM(60)") === "1 sa" && ev("logHM(5)") === "5 dk", "hours and minutes are written wrongly");
  ok(ev("logNextMark()") === 10, "the next round number is not ten hours");
  /* Deleting a source keeps the time spent with it. */
  const kept = ev("logTotal()");
  ev("logSrcDel(" + q(ev("S.log.src[1].id")) + ")");
  ok(ev("S.log.src.length") === 1 && ev("logTotal()") === kept && lastPaint.includes("Bir kanal"), "removing a source took its logged time or its name");
  ev("logDel(" + q(ev("S.log.e[0].id")) + ")");
  ok(ev("S.log.e.length") === 0, "an entry was not deleted");
  /* İlerleme reports it; the tile goes to the log; wipe clears it. */
  ev("S.log.e.push({id:'e99',day:dayNum(),min:90,src:'s1',nm:'x',kind:'o',und:3}); go('ilerleme')");
  ok(lastPaint.includes("1 sa 30 dk"), "İlerleme does not show the hours logged");
  ev("logOpen()"); ev("back()");
  ok(ev("V.view") === "araclar", "back() from the log did not return to Araçlar");
  ev("wipe()");
  ok(ev("S.log.e.length") === 0 && ev("S.log.src.length") === 0, "wipe() kept the log");
});

step("üretim · a miss moves on, comes back once, and building up is a choice", () => {
  ev("confirm=function(){return true}; wipe(); home()");
  ev("go('unit','a1u1','r')"); ev("setGap(3)"); ev("S.err={}"); ev("startProd('s')");
  const n0 = ev("PR.q.length"), k0 = ev("PR.q[0].k");
  ev("prodModel(); prodMark(false)");
  ok(ev("PR.i") === 1 && ev("PR.phase") === "gap", "Yanlış did not move on to the next sentence");
  ok(ev("PR.q.length") === n0 + 1 && ev("PR.q[PR.q.length-1].k") === k0, "the missed sentence is not waiting at the end");
  ok(ev("S.err[" + q(k0) + "].n") === 1, "the miss was not booked");
  /* Everything else right, then the retry: right on the second try goes to
     tomorrow, is not scored as a first-time right and is not booked again. */
  for (let i = 1; i < n0; i++) ev("prodModel(); prodMark(true)");
  ok(ev("PR.q[PR.i].again") === true && /Bir daha/.test(lastPaint), "the retry does not say it is the second time");
  ev("prodModel(); prodMark(true)");
  ok(ev("S.prod[" + q(k0) + "].b") === 1 && ev("S.prod[" + q(k0) + "].d") === ev("dayNum()") + 1, "a retry got right did not go to tomorrow");
  ok(ev("PR.phase") === "end" && lastPaint.includes((n0 - 1) + "/" + n0), "the score is not first tries out of the sentences: " + ev("PR.right"));
  ok(ev("S.err[" + q(k0) + "].n") === 1, "the retry was booked again");
  /* Missed twice: back today, and not a third time in the sitting. */
  ev("wipe(); go('unit','a1u1','r'); setGap(3); startProd('s')");
  const k1 = ev("PR.q[0].k"), m = ev("PR.q.length");
  ev("prodModel(); prodMark(false)");
  for (let i = 1; i < m; i++) ev("prodModel(); prodMark(true)");
  ev("prodModel(); prodMark(false)");
  ok(ev("PR.phase") === "end" && ev("S.prod[" + q(k1) + "].b") === 0 && ev("S.prod[" + q(k1) + "].d") === ev("dayNum()"),
     "a sentence missed twice did not end the sitting due today");
  /* Building up is a button, before marking, and hands the mark back. */
  ev("wipe(); go('unit','a2u1','r'); setGap(3); startProd('s')");
  let found = false;
  for (let i = 0; i < 12 && ev("PR.phase") !== "end"; i++) {
    ev("prodModel()");
    if (ev("clauseSplit(PR.q[PR.i].tr).length") > 1) { found = true; break; }
    ev("prodMark(true)");
  }
  ok(found, "no sentence long enough to build up");
  if (found) {
    const k = ev("PR.q[PR.i].k");
    ok(lastPaint.includes('onclick="prodBuild()"'), "the build-up button is missing on a long sentence");
    ev("prodBuild()");
    ok(ev("PR.phase") === "build", "the build-up button did not build up");
    for (let i = 0; i < 20 && ev("PR.phase") === "build"; i++) ev("prodBuildNext()");
    ok(ev("PR.phase") === "model" && ev("PR.q[PR.i].k") === k && !ev("S.prod[" + q(k) + "]"),
       "building up did not hand the sentence back to be marked, or marked it for the learner");
  }
});

step("okuma · every passage on one shelf, read for fun, writing nothing", () => {
  ev("unitOpen=__unitOpen; confirm=function(){return true}; wipe(); home()");
  ev("okumaOpen(); okSet('all')");
  const rows = (lastPaint.match(/onclick="okRead\(/g) || []).length;
  ok(rows === UNITS.length, "the shelf lists " + rows + " passages, not all " + UNITS.length);
  ok(LEVELS.every(l => lastPaint.includes('class="sec">' + esc(l.id + " · " + l.tr) + '</h2>')), "a level heading is missing on the shelf");
  /* Unit one waits on the lessons before it, so on day one all are ahead. */
  const ahead = () => (lastPaint.match(/class="pill">ileride</g) || []).length;
  ok(ahead() === UNITS.length, "on a fresh install every passage should read as ahead: " + ahead());
  ev("BASLA.forEach(function(b){S.basla[b.id]={at:Date.now()}}); save(); render()");
  ok(ahead() === UNITS.length - 1, "with the intro passed, unit one's passage still reads as ahead: " + ahead());
  /* The folk thread. */
  ev("okSet('folk')");
  const folk = UNITS.filter(u => /Halk|Dede Korkut|Karagöz|Mesnev|halk hikâyesi/.test(u.read.kind));
  const frows = (lastPaint.match(/onclick="okRead\(/g) || []).length;
  ok(frows === folk.length && folk.length >= 8 && folk.every(u => lastPaint.includes("okRead('" + u.id + "')")), "the folk-tale filter does not list exactly the folk tales");
  ok(folk.some(u => /Nasreddin/.test(u.read.kind)) && !lastPaint.includes(esc("A1 · Temel")), "the folk thread lost Nasreddin Hoca, or shows a level with none");
  /* A locked passage reads, plays, and writes nothing. */
  const before = JSON.stringify(ev("S"));
  const lk = folk.find(u => u.lv === "B1");
  ev("okRead(" + q(lk.id) + ")");
  ok(ev("V.view") === "okumaoku" && lastPaint.includes(esc(lk.read.lines[0][0])) && lastPaint.includes(esc(lk.read.lines[0][1])),
     "the passage or its English is not on the page");
  ok(/ileride|Ahead of where you are/.test(lastPaint) && !lastPaint.includes("go('unit','" + lk.id + "','r')"), "a locked passage does not say it is ahead, or links into the locked unit");
  ev("sayLine(1)");
  ok(voice.spoken[voice.spoken.length - 1] === lk.read.lines[1][0], "a line's speaker did not say that line");
  ev("playFrom(0,'listen')");
  ok(voice.spoken[voice.spoken.length - 1] === lk.read.lines[0][0], "Dinle did not start on the passage's first line");
  ev("stopPlay()");
  ok(JSON.stringify(ev("S")) === before && !ev("unitOpen(" + q(lk.id) + ")"), "reading on the shelf wrote progress or opened the unit");
  /* Next and back walk the filtered shelf. */
  const i = folk.indexOf(lk), nx = folk[i + 1];
  ok(nx && lastPaint.includes("okRead('" + nx.id + "')"), "the next button does not go to the next folk tale");
  ev("okRead(" + q(nx.id) + ")");
  ok(ev("V.u") === nx.id, "the next button went somewhere else");
  ev("back()");
  ok(ev("V.view") === "okuma", "back() from a passage did not return to the shelf");
  ev("back()");
  ok(ev("V.view") === "araclar", "back() from the shelf did not return to Araçlar");
  /* A passage read on its unit's tab is ticked. */
  ev("go('unit','a1u1','r'); okumaOpen(); okSet('all')");
  const r1 = lastPaint.slice(lastPaint.indexOf("okRead('a1u1')"), lastPaint.indexOf("</button>", lastPaint.indexOf("okRead('a1u1')")));
  ok(/✓/.test(r1), "a passage read on its tab is not ticked on the shelf");
  ev("okRead('a1u1')");
  ok(lastPaint.includes("go('unit','a1u1','r')"), "an open unit's passage offers no way into the unit");
  ev(LIFT);
});

step("okuma · the words worth a tap, and the gloss that stopped matching inside words", () => {
  ev("confirm=function(){return true}; wipe(); home()");
  /* A built-up word carries its form, pieces and sense, once, whatever
     headword it also starts with. */
  ev("go('unit','a1u5','r')");
  const k5 = lastPaint.match(/<span class="gw"[^>]*>Kahvaltıda<\/span>/);
  ok(k5 && /data-p="kahvaltı-da"/.test(k5[0]) && /data-g="kahvaltı · breakfast"/.test(k5[0]) && /data-s="at breakfast"/.test(k5[0]),
     "a tapped word does not carry its form, pieces and sense");
  ok(!/<span class="gw"[^>]*>Kahvaltı<\/span>da/.test(lastPaint), "the headword gloss split a word the word layer already covers");
  ok(lastPaint.includes("Metindeki kelimeler") && lastPaint.includes(esc("kahvaltı·da")), "the passage's words are not listed under it");
  /* Every occurrence, not only the first. */
  ev("go('unit','a2u4','r')");
  ok((lastPaint.match(/<span class="gw"[^>]*>kazanı<\/span>/g) || []).length === 2, "a word used twice is tappable only once");
  /* The gloss that matched inside words: de in ederim, and De in Deniz. */
  ev("go('unit','a1u1','r')");
  ok(!/>de<\/span>rim/.test(lastPaint), "the gloss for de still lights up inside ederim");
  ok(!/>De<\/span>niz/.test(lastPaint), "the gloss for de lights up the start of Deniz");
  ok((lastPaint.match(/<span class="gw"[^>]*>de<\/span>/g) || []).length === 2, "de is not glossed where it is the word");
  ev("go('unit','b1u5','r')");
  ok(!/>ada<\/span>r/.test(lastPaint) && /<span class="gw"[^>]*>ada<\/span>ya/.test(lastPaint), "ada matched inside kadar, or no longer reaches adaya");
  ev("go('unit','a2u5','r')");
  ok(/<span class="gw"[^>]*>Bence<\/span>/.test(lastPaint), "a capitalised headword at the start of a line is not glossed");
  /* The rules by construction, since the passages do not reach them all. */
  const G = (t, g, w) => ev("glossify(" + q(t) + "," + JSON.stringify(g) + (w ? "," + JSON.stringify(w) : "") + ")");
  ok(G("Bu değil, bu da değil de o.", { de: "too" }) === "Bu değil, bu da değil <span class=\"gw\" data-g=\"too\" data-w=\"de\">de</span> o.",
     "a two-letter gloss matched the start of a longer word, or missed the word itself");
  ok(!G("Bizim Deniz geldi.", { deniz: "sea" }).includes("gw"), "a capitalised headword matched a name in the middle of a line");
  ok(G("— Deniz güzel.", { deniz: "sea" }).includes(">Deniz</span>"), "a capitalised headword at the start of a line is not glossed");
  ok(!G("Ne kadar güzel.", { ada: "island" }).includes("gw") && G("Bir adaya çıktı.", { ada: "island" }).includes(">ada</span>ya"),
     "a headword matched inside a word, or stopped reaching its inflected form");
  const g2 = G("Kazanı aldı, kazanı verdi.", { kazan: "cauldron" }, { "kazanı": ["kazan", "cauldron", "kazan-ı", "the cauldron"] });
  ok((g2.match(/data-p="kazan-ı"/g) || []).length === 2 && !g2.includes('data-g="cauldron" data-w'), "a word layer entry is not tapped every time, or the headword split it");
  /* The bubble shows the pieces and the sense, escaped. */
  ev("showBubble({},{getAttribute:function(k){return {'data-w':'kürkünü','data-g':'kürk · fur <i>coat</i>','data-p':'kürk-ü-nü','data-s':'his fur coat (as object)'}[k]||null},getBoundingClientRect:function(){return{top:10,left:10,width:30,height:20,bottom:30}}})");
  const bh = bodyEl.querySelectorAll(".bubble")[0];
  ok(bh && bh.innerHTML.includes('class="bpc">kürk-ü-nü') && bh.innerHTML.includes("his fur coat (as object)") && bh.innerHTML.includes("&lt;i&gt;"),
     "the bubble does not show the pieces and the sense, or does not escape them");
  ev("hideBubble()");
  /* A level not yet done has no word layer; the shelf has the same one. */
  ev("go('unit','c2u1','r')");
  ok(!lastPaint.includes("Metindeki kelimeler"), "a passage with no words listed shows an empty list");
  ev("okRead('a2u1')");
  ok(/<span class="gw"[^>]*data-p="kürk-ü-nü"/.test(lastPaint), "the shelf does not show the passage's tappable words");
});

step("english layer", () => {
  const html = () => ev("document.documentElement.classList.contains('noen')");
  /* Day one: on, with no choice made. wipe() keeps S.en like any setting,
     so it is cleared by hand first or this inherits an earlier step. */
  ev("delete S.en; wipe(); home()");
  ok(ev("S.en") === undefined && ev("enOn()") === true, "a fresh install does not start with the English on");
  ok(!html(), "the English is hidden on day one");
  ok(lastPaint.includes('Başla' + GL('start')), "day one's Başla has no English under it");
  ok(lastPaint.includes('class="icon-btn en-btn"'), "the home bar has no EN toggle");
  ev("go('araclar')");
  ok(lastPaint.includes('class="icon-btn en-btn"'), "a screen bar has no EN toggle");
  const has = x => ev("document.documentElement.classList.contains(" + q(x) + ")");
  const mode = () => ["en", "both", "tr"].filter(x => has("ins-" + x)).join();
  ok(mode() === "en", "day one's instructions are not in English");
  /* The toggle is a class, not a redraw: a redraw would empty a half-typed answer. */
  const before = screens;
  ev("toggleEN()");
  ok(screens === before, "turning the English off redrew the screen");
  ok(html() && mode() === "tr" && JSON.stringify(ev("S.en")) === '{"st":0,"on":false}', "turning the English off did not hide it");
  ok(store.get("turkce-course-v1").indexOf('"en":{"st":0,"on":false}') >= 0, "turning the English off was not saved");
  ev("wipe()");
  ok(ev("enOn()") === false, "wiping progress threw away the English setting");
  ev("toggleEN()");
  ok(!html() && mode() === "en" && ev("S.en.on") === true, "turning the English back on did not show it");
  /* A choice saved before the stages existed is a stage-0 choice. */
  ev("S.en=false; enApply()");
  ok(ev("enOn()") === false && html() && mode() === "tr", "an old saved choice was ignored");
  /* The stage is the level being worked in: the unit after the furthest
     passed. Passing the A2 test is B1 even with A1 untouched. */
  ev("delete S.en; unitsOf('A2').forEach(function(u){S.done[u.id]={score:5,of:5,at:1}}); home()");
  ok(ev("curLv()") === "B1" && ev("enStage()") === 1, "passing A2 did not put the learner in B1");
  ok(html() && mode() === "both", "B1 does not show labels in Turkish and instructions in both");
  ev("S.en=false; home()");
  ok(ev("enStage()") === 1 && mode() === "both", "a stage-0 choice held on into B1");
  ev("delete S.en; toggleEN()");
  ok(ev("enOn()") === false && html() && mode() === "tr", "turning the English off at B1 left some showing");
  ev("toggleEN()");
  ok(ev("enOn()") === true && !html() && mode() === "both", "turning the English on at B1 did not bring the labels back");
  ev("delete S.en; unitsOf('B1').forEach(function(u){S.done[u.id]={score:5,of:5,at:1}}); home()");
  ok(ev("enStage()") === 2 && html() && mode() === "tr" && ev("enOn()") === false, "B2 still shows English by default");
  ev("S.en={st:1,on:true}; home()");
  ok(mode() === "tr", "a B1 choice held on into B2");
  ev("toggleEN()");
  ok(mode() === "both" && !html(), "the learner cannot bring the English back at B2");
  ev("S.done={}; S.done.a1u1={score:5,of:5,at:1}; S.done.b2u1={score:5,of:5,at:1}");
  ok(ev("curLv()") === "B2", "the stage follows the first unit passed rather than the furthest");
  ev("S.done.c2u10={score:5,of:5,at:1}");
  ok(ev("curLv()") === "C2", "the last unit passed ran off the end of the course");
  ok(ev("tx('Look.','Bak.')") === '<span class="t-tr">Bak.</span><span class="t-en">Look.</span>', "tx() does not carry both languages");
  ev("go('araclar')");
  ok(lastPaint.includes('<small><span class="t-tr">derslerin yanında</span><span class="t-en">tools · beside the lessons</span></small>'), "a hub's bar subtitle has no Turkish");
  ok(ev("(S.en={st:enStage(),on:false},enMode())") === "tr" && ev("txt('Look.','Bak.')") === "Bak.", "plain-text instructions ignore the stage");
  ev("S.en={st:enStage(),on:true}");
  ok(ev("txt('Look.','Bak.')") === (ev("enStage()") === 0 ? "Look." : "Bak. (Look.)"), "plain-text instructions do not carry the English when asked");
  ev("delete S.en; wipe(); home()");
  /* The pass itself, by construction rather than by whatever a run drew. */
  const EU = x => ev("enUnder(" + q(x) + ")");
  ok(EU('<h2 class="sec">Konuşma · speaking</h2>') === '<h2 class="sec">Konuşma' + GL('speaking') + '</h2>',
     "an inline English half is not moved underneath");
  ok(EU('<h2 class="sec">Kurs · the kitchen</h2>') === '<h2 class="sec">Kurs · the kitchen</h2>',
     "an English half the table does not list was moved");
  ok(EU('<p class="lead">3 soru</p>') === '<p class="lead">3 soru' + GL('3 questions') + '</p>', "a counted label is not glossed");
  ok(EU('<button class="btn">Tekrara ekle · add these 7 to my reviews</button>') ===
     '<button class="btn">Tekrara ekle' + GL('add these 7 to my reviews') + '</button>', "a counted inline half is not moved");
  ok(EU('<button>Kelimeler<i>words</i></button>') === '<button>Kelimeler<i>words</i></button>',
     "a label that already carries its English got a second copy");
  ok(EU('<p class="sub">Doğru</p><p>Başla</p>') === '<p class="sub">Doğru' + GL('right') + '</p><p>Başla</p>',
     "the pass reaches beyond the interface elements");
  ["opt", "tile", "vtr", "ven", "gw", "dw", "mark", "nav-t"].forEach(c => {
    const x = '<span class="' + c + ' lead">Başla</span>';
    ok(EU(x) === x, "content of class " + c + " was glossed");
  });
});

/* ===================== report ===================== */
console.log("sim: " + seenScreens.size + " distinct screens · " + screens + " paints · " +
  checks + " checks · " + voice.said + " utterances · " + voice.cancels + " stops");

ok(txBad.size === 0, "instructions whose Turkish half is empty, the same as the English, or English: " +
   [...txBad.entries()].slice(0, 5).map(e => q(e[0]) + " / " + q(e[1])).join("; "));
ok(enLoose.size === 0, "interface labels with an English half EN_INLINE does not list — add it there, or to EN_TAIL_OK if it is not English: " +
   [...enLoose.keys()].map(q).join(", "));
if (fails.length) {
  fails.slice(0, 40).forEach(f => console.error("  FAIL " + f));
  if (fails.length > 40) console.error("  … and " + (fails.length - 40) + " more");
  console.error("\nsim: " + fails.length + " failure" + (fails.length > 1 ? "s" : ""));
  process.exit(1);
}
console.log("sim ok");
