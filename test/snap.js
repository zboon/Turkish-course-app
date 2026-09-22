#!/usr/bin/env node
/* A fingerprint of what the app draws and what the language engine
   builds. Renders every screen with a seeded Math.random, hashes each,
   and hashes every noun form, conjugation and backward buildup.

     node test/snap.js            compare against test/snapshot.json
     node test/snap.js --write    re-record it

   This is the net for refactoring. sim.js asks whether the app works;
   this asks whether it still does exactly what it did before, which is
   the question that matters when moving code rather than changing it.
   A deliberate change to a screen will fail here — that is the point.
   Read the diff, satisfy yourself the change is the one you meant, then
   re-record.                                                          */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const boot = require("./dom.js");

const root = path.join(__dirname, "..");
const write = process.argv.includes("--write");
const file = process.argv.slice(2).filter(a => a !== "--write")[0] || path.join(root, "dist", "index.html");
const store = path.join(__dirname, "snapshot.json");

const env = boot(file, { seed: 12345 });
const ev = env.ev, app = env.appEl, doc = env.doc;
const q = s => JSON.stringify(s);
const hash = s => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

const snap = {};
const grab = k => { snap[k] = hash(app.innerHTML); };
/* Reseeding before each walk keeps one section's randomness from
   shifting the next one's. */
const reseed = n => ev("Math.random=(function(){var s=" + n + ";return function(){s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};})()");

ev("wipe()");
reseed(12345);
ev("home()"); grab("home");
ev("LEVELS").forEach(l => { ev("go('level'," + q(l.id) + ")"); grab("level:" + l.id); });
ev("UNITS").forEach(u => ["v", "g", "r", "d"].forEach(s => { ev("go('unit'," + q(u.id) + "," + q(s) + ")"); grab("unit:" + u.id + ":" + s); }));
ev("go('about')"); grab("about");
ev("go('words')"); grab("words:empty");
ev("go('dict')"); grab("dict");
["n", "f", "s", "z", "e", "i"].forEach(c => { ev("dictCat(" + q(c) + ")"); grab("dict:" + c); });
ev("dictCat('all')"); ev("dictSearch('göz')"); grab("dict:search"); ev("dictSearch('')");
["course", "core"].forEach(s => { ev("dictSrc(" + q(s) + ")"); grab("dict:src:" + s); });
ev("dictSrc('core')"); ev("dictTopic('yemek')"); grab("dict:topic"); ev("dictTopic('')"); ev("dictSrc('all')");
ev("dictSort()"); grab("dict:bylevel"); ev("dictSort()");
ev("go('prod')"); grab("prod");

reseed(999); ev("startProd('g')"); grab("prod:gen");
for (let i = 0; i < 3; i++) { ev("prodModel()"); grab("prod:gen:model:" + i); ev("prodMark(true)"); }
reseed(777); ev("startProd('t')"); grab("prod:move");
for (let i = 0; i < 3; i++) { ev("prodModel()"); grab("prod:move:model:" + i); ev("prodMark(true)"); }
reseed(555); ev("startProd('s')"); grab("prod:sent");
reseed(333); ev("startProd('k')"); grab("prod:chunk");

ev("go('unit','a1u1','v')"); ev("starAll('a1u1')");
ev("go('words')"); grab("words:full");
ev("startCards()"); grab("cards"); ev("flip()"); grab("cards:flip");
ev("startReview()"); grab("review"); ev("rvFlip()"); grab("review:flip");
reseed(4242); ev("startUnitQuiz('a1u1')"); grab("quiz");
reseed(4242); ev("startPlacement()"); grab("placement");
ev("startRetell('a1u2')"); grab("retell");

/* The language engine, hashed as data rather than as a screen. */
const pure = {};
ev("UNITS").forEach(u => u.read.lines.forEach((l, i) => {
  pure["split:" + u.id + "#" + i] = ev("clauseSplit(" + q(l[0]) + ")").join("|");
}));
ev("LEX").forEach(e => {
  const find = "LEX.find(function(x){return x.t===" + q(e.t) + "})";
  if (e.p === "n") ["nAcc", "nDat", "nLoc", "nAbl", "nGen", "nP1", "nP3", "nPlur"]
    .forEach(f => { pure[f + ":" + e.t] = ev(f + "(" + find + ")"); });
  if (e.p === "v") ["prog", "past", "fut", "aor"].forEach(t =>
    [0, 1, 2, 3, 4, 5].forEach(p => [false, true].forEach(n => {
      pure["conj:" + e.t + ":" + t + ":" + p + ":" + n] = ev("conj(" + find + "," + q(t) + "," + p + "," + n + ")");
    })));
});
snap.__pure = hash(JSON.stringify(pure));
snap.__pureForms = Object.keys(pure).length;
snap.__screens = Object.keys(snap).length - 2;

if (write) {
  fs.writeFileSync(store, JSON.stringify(snap, null, 1) + "\n");
  console.log("snap: recorded " + snap.__screens + " screens and " + snap.__pureForms + " generated forms");
  process.exit(0);
}
let old;
try { old = JSON.parse(fs.readFileSync(store, "utf8")); }
catch (e) { console.error("snap: no snapshot.json — record one with: node test/snap.js --write"); process.exit(1); }

const keys = [...new Set(Object.keys(old).concat(Object.keys(snap)))].sort();
const diffs = keys.filter(k => old[k] !== snap[k]);
if (diffs.length) {
  diffs.slice(0, 20).forEach(k => console.error("  CHANGED " + k + ": " + (old[k] === undefined ? "(new)" : old[k]) + " → " + (snap[k] === undefined ? "(gone)" : snap[k])));
  if (diffs.length > 20) console.error("  … and " + (diffs.length - 20) + " more");
  console.error("\nsnap: " + diffs.length + " of " + keys.length + " changed. If you meant it: node test/snap.js --write");
  process.exit(1);
}
console.log("snap ok · " + snap.__screens + " screens and " + snap.__pureForms + " generated forms unchanged");
