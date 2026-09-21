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

/* ===================== the DOM stub ===================== */
const VOID = new Set(["br", "hr", "img", "input", "meta", "link", "source", "path", "circle", "rect", "use", "stop"]);

class El {
  constructor(tag, attrs) {
    this.tagName = (tag || "div").toLowerCase();
    this.attrs = attrs || {};
    this.id = this.attrs.id || "";
    this.className = this.attrs.class || "";
    this.dataset = {};
    Object.keys(this.attrs).forEach(k => {
      if (k.startsWith("data-")) this.dataset[k.slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = this.attrs[k];
    });
    this.style = { display: /display:\s*none/.test(this.attrs.style || "") ? "none" : "" };
    this.value = this.attrs.value || "";
    this.textContent = "";
    this.parentNode = null;
    this.children = [];
    this._html = "";
    this._doc = null;
    const self = this;
    this.classList = {
      contains: c => self._classes().includes(c),
      add(c) { if (!self._classes().includes(c)) self.className = (self.className + " " + c).trim(); },
      remove(c) { self.className = self._classes().filter(x => x !== c).join(" "); },
      toggle(c, on) { const has = self._classes().includes(c); const want = on === undefined ? !has : !!on; if (want) self.classList.add(c); else self.classList.remove(c); }
    };
  }
  _classes() { return String(this.className).split(/\s+/).filter(Boolean); }
  get innerHTML() { return this._html; }
  set innerHTML(h) {
    this._html = String(h);
    this.children = parseInto(this, this._html);
    if (this._doc) this._doc.reindex();
    if (this._onpaint) this._onpaint(this._html);
  }
  get offsetWidth() { return 0; }
  get offsetHeight() { return 0; }
  descendants() { const out = []; const walk = n => n.children.forEach(c => { out.push(c); walk(c); }); walk(this); return out; }
  matches(sel) {
    if (sel.startsWith(".")) return this._classes().includes(sel.slice(1));
    if (sel.startsWith("#")) return this.id === sel.slice(1);
    return this.tagName === sel.toLowerCase();
  }
  querySelectorAll(sel) { const r = this.descendants().filter(e => e.matches(sel)); r.forEach = Array.prototype.forEach.bind(r); return r; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  closest(sel) { let n = this; while (n) { if (n.matches && n.matches(sel)) return n; n = n.parentNode; } return null; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "class") this.className = String(v); }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null; }
  getBoundingClientRect() { return { top: 10, left: 10, right: 40, bottom: 30, width: 30, height: 20 }; }
  focus() { this._focused = true; }
  select() { this._selected = true; }
  addEventListener(t, fn) { (this._ev = this._ev || {})[t] = fn; }
  removeEventListener() {}
  scrollIntoView() {}
}

/* A forgiving tag scanner — enough structure for getElementById,
   querySelectorAll and closest, which is all the app asks of the DOM. */
function parseInto(rootEl, html) {
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  const top = [];
  const stack = [];
  let m;
  while ((m = re.exec(html))) {
    const [, slash, tag, attrText, selfClose] = m;
    const name = tag.toLowerCase();
    if (slash) {
      for (let i = stack.length - 1; i >= 0; i--) { if (stack[i].tagName === name) { stack.length = i; break; } }
      continue;
    }
    const attrs = {};
    const ar = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let a;
    while ((a = ar.exec(attrText))) attrs[a[1]] = a[2] !== undefined ? a[2] : a[3];
    const el = new El(name, attrs);
    const parent = stack[stack.length - 1];
    if (parent) { el.parentNode = parent; parent.children.push(el); }
    else { el.parentNode = rootEl; top.push(el); }
    if (!selfClose && !VOID.has(name)) stack.push(el);
  }
  return top;
}

/* ===================== fake clock and voice ===================== */
const clock = { now: 0, seq: 0, timers: [] };
function setTimeoutStub(fn, ms) { const t = { id: ++clock.seq, fn, at: clock.now + (ms || 0), dead: false }; clock.timers.push(t); return t.id; }
function clearTimeoutStub(id) { clock.timers = clock.timers.filter(t => t.id !== id); }
function drain(limit) {
  let n = 0;
  while (clock.timers.length && n < (limit || 500)) {
    clock.timers.sort((a, b) => a.at - b.at);
    const t = clock.timers.shift();
    clock.now = Math.max(clock.now, t.at);
    if (!t.dead) { t.fn(); n++; }
  }
  return n;
}

const voice = { spoken: [], langs: [], said: 0, cancels: 0, pending: [] };
class SpeechSynthesisUtteranceStub {
  constructor(text) { this.text = text; this.lang = ""; this.rate = 1; this.voice = null; this.onend = null; }
}
const speechSynthesisStub = {
  onvoiceschanged: null,
  getVoices() { return [{ lang: "en-GB", name: "Daniel" }, { lang: "tr-TR", name: "Yelda" }]; },
  speak(u) {
    voice.spoken.push(u.text); voice.said++; voice.langs.push(u.lang);
    if (u.onend) { const t = setTimeoutStub(() => { voice.pending = voice.pending.filter(x => x !== t); u.onend(); }, 20); voice.pending.push(t); }
  },
  cancel() {
    voice.cancels++;
    voice.pending.forEach(id => clearTimeoutStub(id));
    voice.pending = [];
  }
};

/* ===================== context ===================== */
const html = fs.readFileSync(file, "utf8");
const open = html.indexOf("<script>"), close = html.lastIndexOf("</script>");
if (open < 0 || close < 0) { console.error("sim: no <script> block in " + file); process.exit(1); }
const code = html.slice(open + "<script>".length, close);

const store = new Map();
const documentEl = new El("html", {});
const bodyEl = new El("body", {});
const appEl = new El("div", { id: "app" });
const byId = new Map();

const doc = {
  documentElement: documentEl,
  body: bodyEl,
  reindex() {
    byId.clear();
    [bodyEl, appEl].forEach(rootNode => rootNode.descendants().forEach(e => { if (e.id && !byId.has(e.id)) byId.set(e.id, e); }));
    byId.set("app", appEl);
  },
  getElementById(id) { return byId.get(id) || null; },
  querySelector(sel) { return appEl.querySelector(sel) || bodyEl.querySelector(sel); },
  querySelectorAll(sel) { const r = appEl.querySelectorAll(sel).concat(bodyEl.querySelectorAll(sel)); r.forEach = Array.prototype.forEach.bind(r); return r; },
  createElement(t) { const e = new El(t, {}); e._doc = doc; return e; },
  addEventListener() {},
  execCommand() { return true; },
  activeElement: null
};
appEl._doc = doc;
bodyEl._doc = doc;
bodyEl.appendChild(appEl);
doc.reindex();

let lastPaint = "";
appEl._onpaint = h => { screens++; lastPaint = h; };

const sandbox = {
  console,
  document: doc,
  setTimeout: setTimeoutStub, clearTimeout: clearTimeoutStub,
  setInterval: () => 0, clearInterval: () => {},
  localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  },
  navigator: {
    /* The published artifact has no service worker; the call is wrapped
       and must fail silently rather than take the boot down. */
    serviceWorker: { register: () => Promise.reject(new Error("no service worker here")) },
    clipboard: { writeText: () => {} }
  },
  location: { protocol: "https:" },
  speechSynthesis: speechSynthesisStub,
  SpeechSynthesisUtterance: SpeechSynthesisUtteranceStub,
  confirm: () => true,
  Date, Math, JSON, String, Number, Object, Array, Boolean, Set, Map, Error, RegExp, isNaN, parseFloat, parseInt
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.innerWidth = 390;
sandbox.window.innerHeight = 780;
sandbox.window.scrollTo = () => {};
sandbox.window.addEventListener = () => {};
sandbox.window.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });

vm.createContext(sandbox);
const ev = expr => vm.runInContext(expr, sandbox, { filename: "sim" });

try { vm.runInContext(code, sandbox, { filename: file }); }
catch (e) { console.error("sim: the app threw while booting\n  " + (e && e.stack || e)); process.exit(1); }

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
  ok(ev("dictAll().every(function(w){return w.tr&&w.en&&w.lv&&w.u&&w.c})"), "a word row is missing a field");

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

  /* A row opens the unit it came from */
  ev("go('unit'," + q(w.u) + ",'v')");
  ok(ev("V.view") === "unit" && ev("V.u") === w.u, "the word does not lead back to its unit");
});

/* ===================== 9 · about, backup, restore ===================== */
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

/* ===================== 10 · storage, theme, streak ===================== */
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
