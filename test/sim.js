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
  ok(ev("sentenceBank().length") > 0, "an empty course still has to offer something to say");
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
/* This engine decides which of 600 words the learner sees next, from a
   count it derives itself. If the count is wrong the whole thing points at
   the wrong words, so the invariants matter more than the screens. */
step("the word index counts what it claims to", () => {
  ev("wipe()");
  const words = ev("wordIndex().words");
  ok(words.length === 600, "the index holds " + words.length + " words, expected 600");
  ok(ev("repBands().reduce(function(a,b){return a+b})") === 600, "the bands do not add up to 600");

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
  ev("wipe()");
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
  ev("wipe()");
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
step("the plan says what to do, in the order it should be done", () => {
  ev("wipe()"); ev("home()");
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

  /* A step ticks when its own queue empties — no stored completion flag. */
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
  ev("wipe()"); ev("home()");
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
  ev("wipe()");
  ev("UNITS.forEach(function(u){S.done[u.id]={score:5,of:5,at:Date.now()}})");
  ev("S.rep={}; repBank().forEach(function(e){S.rep[e.k]={b:5,d:dayNum()+9,n:30}})");
  ev("S.dinle={}; ['d:','a:'].forEach(function(p){listenBank(p).forEach(function(it){S.dinle[it.k]={b:3,d:dayNum()+9}})})");
  ev("S.prod={}; sentenceBank().forEach(function(it){S.prod[it.k]={b:3,d:dayNum()+9}})");
  ev("save()"); ev("home()");
  ok(ev("planToday().left.length") === 0, "with everything clear the plan still lists work");
  ok(/Bugünlük bitti/.test(lastPaint), "a cleared plan does not say so");
});

step("the repetition schedule is progress, its settings are not", () => {
  ev("wipe()");
  ev("startTekrar()");
  doc.getElementById("tbox").value = ev("TK.q[TK.i].c");
  ev("tkCheck()");
  ok(ev("Object.keys(S.rep).length") === 1, "nothing was scheduled");
  const saved = ev("JSON.stringify(S)");

  ev("wipe()");
  ok(ev("Object.keys(S.rep).length") === 0, "wipe left the repetition schedule behind");

  ev("go('about')");
  doc.getElementById("iobox").value = saved;
  ev("importBox()");
  ok(ev("Object.keys(S.rep).length") === 1, "restore lost the repetition schedule");
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
