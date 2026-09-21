#!/usr/bin/env node
/* The headless environment the tests run the built app in: a DOM stub
   forgiving enough for innerHTML + getElementById + querySelectorAll, a
   fake clock so countdowns and the voice player advance on demand, and a
   speech-synthesis stub that records what was said.

   Shared by test/sim.js, which drives the app, and test/snap.js, which
   hashes what it draws. Keep it dumb: anything clever here is a place
   for a test to pass while the app is broken.

     boot(file, {seed})  →  { ev, doc, appEl, bodyEl, documentEl,
                              voice, drain, clock, store,
                              lastHTML(), onPaint(fn) }

   Passing a seed replaces Math.random inside the sandbox with a repeatable
   generator, which is what makes shuffles and generated drills comparable
   between two runs.                                                    */
const fs = require("fs");
const vm = require("vm");

module.exports = function boot(file, opts) {
  opts = opts || {};
  let onPaint = null, lastHTML = "";

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

/* A repeatable Math.random, so two runs of the same walk agree. */
function seededMath(seed) {
  if (seed === undefined) return Math;
  let s = seed >>> 0;
  const m = Object.create(Math);
  m.random = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  return m;
}

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
appEl._onpaint = h => { lastHTML = h; if (onPaint) onPaint(h); };

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
  Date, Math: seededMath(opts.seed), JSON, String, Number, Object, Array, Boolean, Set, Map, Error, RegExp, isNaN, parseFloat, parseInt
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.innerWidth = 390;
sandbox.window.innerHeight = 780;
sandbox.window.scrollTo = () => {};
sandbox.window.addEventListener = () => {};
sandbox.window.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });

vm.createContext(sandbox);
const ev = expr => vm.runInContext(expr, sandbox, { filename: "sandbox" });

try { vm.runInContext(code, sandbox, { filename: file }); }
catch (e) { console.error("the app threw while booting\n  " + (e && e.stack || e)); process.exit(1); }

  return {
    ev, doc, appEl, bodyEl, documentEl, voice, drain, clock, store,
    /* The app paints once while booting, before any caller can listen,
       so the last screen is always readable after the fact. */
    lastHTML: () => lastHTML,
    onPaint(fn) { onPaint = fn; }
  };
};
