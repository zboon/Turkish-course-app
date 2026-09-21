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

const voice = { spoken: [], said: 0, cancels: 0, pending: [] };
class SpeechSynthesisUtteranceStub {
  constructor(text) { this.text = text; this.lang = ""; this.rate = 1; this.voice = null; this.onend = null; }
}
const speechSynthesisStub = {
  onvoiceschanged: null,
  getVoices() { return [{ lang: "en-GB", name: "Daniel" }, { lang: "tr-TR", name: "Yelda" }]; },
  speak(u) {
    voice.spoken.push(u.text); voice.said++;
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

/* ===================== 8 · about, backup, restore ===================== */
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

/* ===================== 9 · storage, theme, streak ===================== */
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
