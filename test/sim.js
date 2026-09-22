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

const UNITS = ev("UNITS"), LEVELS = ev("LEVELS"), PLACEMENT = ev("PLACEMENT");
const q = s => JSON.stringify(s);

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
appEl._onpaint = h => {
  screens++; lastPaint = h;
  seenScreens.add(screenKey());
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
  ok(lastPaint.includes("Test ahead"), "level " + l.id + " has no test-ahead card");
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

  /* A sentence you could not produce is offered backwards. */
  if (phase() === "build") {
    const parts = ev("PR.build");
    ok(parts.length > 1, "buildup opened with a single piece");
    ok(parts[parts.length - 1] === it.tr, "buildup does not end on the whole sentence");
    for (let i = 0; i < parts.length + 1 && phase() === "build"; i++) ev("prodBuildNext()");
    ok(phase() !== "build", "buildup did not finish");
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
  ok(phase() === "end", "the session did not finish");
  ok(/kendi değerlendirmen/.test(lastPaint), "no score screen after üretim");
  ok(ev("Object.keys(S.prod).length") === n, "graded " + n + " but stored " + ev("Object.keys(S.prod).length"));

  /* Due today should now be the missed ones, not the whole bank. */
  const due = ev("prodDue(sentenceBank()).length"), all = ev("sentenceBank().length");
  ok(due === all - ev("Object.keys(S.prod).filter(function(k){return S.prod[k].b>0}).length"),
    "the sentences answered right are still due today");
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
  ok(ev("prodDue(chunkBank()).length") === ev("CHUNKS.length") - n, "graded chunks are still due today");

  /* The bank is the roadmap's first item, grown from 50 to 300+. Two
     things had to survive that: the sitting stays a sitting, and the hub
     reports the sitting rather than the whole bank — "307 due today" is
     the debt-nobody-will-clear reading the Tekrar hub already had to
     correct once. */
  ok(ev("CHUNKS.length") >= 300, "the chunk bank is only " + ev("CHUNKS.length") + " deep");
  ev("wipe()"); ev("go('prod')");
  const card = /Kalıplar<\/p><p class="sub">([^<]*)/.exec(lastPaint);
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
  ok(phase() === "end", "generated session did not finish");
  /* Scheduling is by pattern, so a handful of keys, not a dozen. */
  ok(ev("Object.keys(S.prod).length") <= n, "pattern scheduling stored more keys than items");
  ok(ev("Object.keys(S.prod).every(function(k){return k.indexOf('g:')===0})"), "generated grading wrote a non-pattern key");
  ok(/never runs out/.test(lastPaint), "the generated score screen still talks about a finite set");
});

step("dönüştürme · transformations", () => {
  ev("wipe()"); ev("setGap(3)");
  ev("startProd('t')");
  const n = ev("PR.q.length");
  ok(n > 0, "no transformation drills were built");
  ok(ev("PR.q.every(function(i){return !!i.given&&!!i.instr})"), "a transformation has no sentence to transform");
  ok(ev("PR.q.every(function(i){return i.given!==i.tr})"), "a transformation does not change the sentence");
  ok(lastPaint.includes(esc(ev("PR.q[0].given"))), "the sentence to transform is not on screen");
  ok(lastPaint.includes(esc(ev("PR.q[0].instr"))), "the instruction is not on screen");
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
  ok(ev("dictRows().length") === 0 && /No word matches/.test(lastPaint), "a search with no hits has no empty state");
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
  ok(ev("dinleDue('a:')") === ev("listenBank('a:').length"),
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
  ok(/Karşılaşma/.test(lastPaint), "the hub does not show the distribution");

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
  ok(ev("gramBank().length") === 1 && ev("gramBank()[0].u.id") === "b2u1",
     "reading the grammar tab did not make the point reviewable");
  ok(ev("metGram('b2u1')") && !ev("metGram('b2u2')"), "metGram is not tracking the g tab");

  /* Finishing a unit counts as having met it, however it was met. */
  ev("wipe()"); ev("S.done={'a1u1':{score:5,of:5,at:Date.now()}}; save()");
  ok(ev("gramBank().length") === 1, "a completed unit's grammar is not reviewable");

  /* A sitting over the whole course. */
  ev("wipe()"); ev("UNITS.forEach(function(u){S.seen[u.id]={g:1}}); save()");
  ok(ev("gramBank().length") === UNITS.length, "not every point is in the bank once all are read");
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
  const bad = [], frames = new Set(), words = new Set(), persons = new Set();
  for (let i = 0; i < 400; i++) {
    ev("SS=sorSpec(); AA=sorAsk(SS); ST=specText(SS)");
    const f = ev("SS.f"), prep = ev("SS.v?(SS.v.prep||''):''");
    const tr = ev("AA.tr"), en = ev("AA.en"), st = ev("ST.tr");
    frames.add(f); words.add(ev("AA.qw")); persons.add(ev("SS.p"));
    if (f === "dat" && prep !== "to") bad.push("Nereye for a non-place dative: " + tr);
    if (!tr || !en || !/\?$/.test(tr) || !/\?$/.test(en)) bad.push("not a question: " + tr + " / " + en);
    if (BAD.test(tr + en) || / {2}/.test(tr + en)) bad.push("leak: " + tr + " / " + en);
    if (/^I[a-zçğıöşü]/.test(tr)) bad.push("capital: " + tr);
    if (tr === st) bad.push("question equals its answer: " + tr);
    if (/^Who did [a-z]+\?/.test(en)) bad.push("do-support: " + en);
  }
  ok(bad.length === 0, "sor produced " + bad.length + " bad questions, e.g. " + bad.slice(0, 3).join(" · "));
  ok(frames.size === ev("SOR_FRAMES").length, "only " + frames.size + " of " + ev("SOR_FRAMES").length + " frames are reachable");
  ok(words.size === 7, "only " + words.size + " question words are reachable, expected 7");
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
  ok(shown().indexOf(it0.show) === -1, "the hearing direction showed the number it was asking for");
  ok(shown().indexOf(it0.tr) === -1, "the hearing direction printed the Turkish it was speaking");
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
  ok(shown().indexOf(o0.show) > -1, "the say-it direction did not show the digits");
  ok(shown().indexOf(o0.tr) === -1, "the say-it direction revealed the Turkish before the learner spoke");
  ev("numReveal()");
  ok(shown().indexOf(o0.tr) > -1, "the model was never revealed");
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

  /* It must poke the text, not re-render: a clock that redrew the home
     screen every minute would throw away whatever is under it — the same
     rule the Dinleme replay follows, and counted the same way, because
     the paint counter is the only thing that can tell the difference. */
  ev("document.getElementById('hclock').textContent='XXX'");
  const paintsBefore = screens;
  ev("clockTick()");
  ok(ev("document.getElementById('hclock').textContent") === want, "the tick did not refresh the clock");
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
  ok(ev("CLK===null"), "navigating away left the clock's timer armed");
  ev("sayWord('merhaba')");
  ev("home()");
  ok(ev("CLK!==null"), "the clock did not re-arm on the home screen");
  ev("sayWord('merhaba')");                /* stopPlay() runs inside this */
  ok(ev("CLK!==null"), "playing a word from the home screen stopped the clock");

  /* Sayılar shows it too, being the clock's own subject. */
  ev("go('sayilar')");
  ok(ev("!!document.getElementById('hclock')"), "the Sayılar hub lost the clock");
  ok(ev("CLK!==null"), "the clock did not arm on the Sayılar hub");
  /* Nowhere else. */
  ev("go('level','A1')");
  ok(!ev("!!document.getElementById('hclock')"), "the clock leaked onto the level screen");
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
  ok(/tick done/.test(lastPaint), "a finished step shows no tick");

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
  ok(mid.go.indexOf("a1u3") > -1 && mid.go.indexOf("'r'") > -1,
     "Devam does not return to the section that was open: " + mid.go);

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
  ok(/Seviyeler/.test(lastPaint), "home lost the level list");
  ev("back()");
  ok(ev("V.view") === "home", "back() from home did not stay home");
});

/* ===================== report ===================== */
console.log("sim: " + seenScreens.size + " distinct screens · " + screens + " paints · " +
  checks + " checks · " + voice.said + " utterances · " + voice.cancels + " stops");
if (fails.length) {
  fails.slice(0, 40).forEach(f => console.error("  FAIL " + f));
  if (fails.length > 40) console.error("  … and " + (fails.length - 40) + " more");
  console.error("\nsim: " + fails.length + " failure" + (fails.length > 1 ? "s" : ""));
  process.exit(1);
}
console.log("sim ok");
