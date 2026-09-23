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
const ev = env.ev, app = env.appEl, doc = env.doc, drain = env.drain;
const q = s => JSON.stringify(s);
const hash = s => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

const snap = {};
const grab = k => { snap[k] = hash(app.innerHTML); };
/* Two things on these screens read the wall clock and no seed can make
   either reproducible: how long the learner took in Sayılar, and the live
   clock on the home screen, which changes on the minute — so a run that
   straddles one would disagree with itself. Only those readings are
   blanked, and everything else stays pinned: the verdict, the answer,
   which way a pill is coloured, every other word on the page. "N.Ns"
   appears nowhere else, speeds render with × and durations in dakika or
   gün, and the clock's two elements hold nothing but text. */
const scrub = h => h
  .replace(/\d+\.\d+s/g, "#s")
  .replace(/(id="hclock(?:d)?"[^>]*>)[^<]*/g, "$1#");
const grabx = k => { snap[k] = hash(scrub(app.innerHTML)); };
/* Reseeding before each walk keeps one section's randomness from
   shifting the next one's. */
const reseed = n => ev("Math.random=(function(){var s=" + n + ";return function(){s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};})()");

const meetAll = () => ev("UNITS.forEach(function(u){S.seen[u.id]={v:1,g:1,r:1,d:1}}); save()");

ev("wipe()");
reseed(12345);
ev("home()"); grabx("home");            /* day one: orientation, one step */
/* The two doors, and the hubs behind them. The landing page is the plan,
   the road and the blocks; everything the page used to list in one
   column now lives on one of these two. */
ev("go('dersler')"); grab("dersler");
ev("go('araclar')"); grab("araclar");
ev("go('nasil')"); grab("nasil");
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
/* Every review mode is scoped to units met, so the hubs are empty until
   something has been. Meet the course here and the hub fingerprints stay
   meaningful; the beginner's view, where all of this is deliberately
   absent, is the "home" grab above and the plan grabs below. */
meetAll();
ev("go('prod')"); grab("prod");

reseed(999); ev("startProd('g')"); grab("prod:gen");
for (let i = 0; i < 3; i++) { ev("prodModel()"); grab("prod:gen:model:" + i); ev("prodMark(true)"); }
reseed(777); ev("startProd('t')"); grab("prod:move");
for (let i = 0; i < 3; i++) { ev("prodModel()"); grab("prod:move:model:" + i); ev("prodMark(true)"); }
reseed(555); ev("startProd('s')"); grab("prod:sent");
reseed(333); ev("startProd('k')"); grab("prod:chunk");

/* Dinleme. The scored screen is the one worth fingerprinting: a change to
   dictScore shows up here as the marked-up line changing shape. */
ev("go('dinle')"); grab("dinle");
reseed(2468); ev("startDinle('d')"); grab("dinle:dikte");
env.doc.getElementById("dbox").value = ev("DK.q[DK.i].tr");
ev("dikteCheck()"); grab("dinle:dikte:clean");
ev("dinleNext()");
env.doc.getElementById("dbox").value = ev("DK.q[DK.i].tr").split(/\s+/).slice(1).join(" ") + " zürafa";
ev("dikteCheck()"); grab("dinle:dikte:marked");
reseed(1357); ev("startDinle('a')"); grab("dinle:hear");
ev("hearReveal()"); grab("dinle:hear:reveal");
ev("setDrate(1.5)"); ev("go('dinle')"); grab("dinle:fast"); ev("setDrate(1)");

/* Tekrar. The hub carries the encounter distribution, so a change to the
   index or the matcher shows up here as the bars moving — which is the
   one number the engine exists to shift. Both question shapes are taken:
   a cloze, and the recall the once-only words fall back on. */
/* Every review mode is scoped to units met, so the walk has to meet them
   before there is anything to fingerprint. The beginner's view — where all
   of this is deliberately absent — is captured separately below. */
ev("wipe()"); meetAll(); ev("go('tekrar')"); grab("tekrar");
reseed(1122); ev("startTekrar()"); grab("tekrar:ask");
env.doc.getElementById("tbox").value = ev("TK.q[TK.i].c");
ev("tkCheck()"); grab("tekrar:right");
ev("tkNext()");
env.doc.getElementById("tbox").value = "yanlış";
ev("tkCheck()"); grab("tekrar:wrong");
/* A cloze, wherever the first one in this sitting turns up. */
ev("wipe()"); meetAll();
ev("TKX = wordIndex().words.map(repItem).filter(function(i){return i.kind==='cloze'})[0]");
ev("TK = {q:[TKX], i:0, phase:'ask', typed:'', res:null, right:0}");
ev("V = {view:'tekrarrun'}"); ev("render()"); grab("tekrar:cloze");
env.doc.getElementById("tbox").value = ev("TK.q[0].c");
ev("tkCheck()"); grab("tekrar:cloze:right");

/* Dilbilgisi. The marked line is worth a fingerprint for the same reason
   dikte's is — it is where a change to the judge shows up — and the
   reorder case pins the one thing that judge exists to allow. */
ev("wipe()"); ev("UNITS.forEach(function(u){S.seen[u.id]={g:1}}); save()");
ev("go('gram')"); grab("gram");
reseed(3690); ev("startGram()"); grab("gram:ask");
ev("grHint()"); grab("gram:hint");
env.doc.getElementById("gbox").value = ev("GR.q[GR.i].c");
ev("grCheck()"); grab("gram:right");
ev("grNext()");
env.doc.getElementById("gbox").value = ev("GR.q[GR.i].c").split(/\s+/).reverse().join(" ");
ev("grCheck()"); grab("gram:reordered");
ev("grNext()");
env.doc.getElementById("gbox").value = ev("GR.q[GR.i].c").split(/\s+/).slice(1).join(" ") + " zürafa";
ev("grCheck()"); grab("gram:marked");
ev("grAccept()"); grab("gram:overruled");
ev("wipe()"); ev("go('gram')"); grab("gram:empty");

/* Yolda. The run screen is the one thing in the app nobody is expected to
   read while it is happening, so what is fingerprinted is that it stays
   the same three shapes — prompt, countdown, model — plus the marking
   screen, which is the only part that gets touched. */
ev("wipe()"); ev("setYgap(5)"); ev("setYrate(1)");
ev("go('yolda')"); grab("yolda:prefabs-only");
ev("go('unit','a1u1','r')"); ev("go('unit','a1u2','r')");
ev("go('yolda')"); grab("yolda");
reseed(1470); ev("startYolda(5)"); grab("yolda:prompt");
ev("yolGap()"); grab("yolda:gap");
ev("yolModel()"); grab("yolda:model");
drain(60000); grab("yolda:marking");
ev("yolMiss(yolCovered()[0].k)"); grab("yolda:marking:missed");
ev("YL=null;");

/* Sor. The hub is stable prose; the two runners are what move, so both
   are caught at the moment the statement is up and again once the
   question has been revealed. */
ev("wipe()"); ev("setGap(3)");
ev("go('sor')"); grab("sor");
reseed(3310); ev("startProd('q')"); grab("sor:ask:prompt");
ev("prodModel()"); grab("sor:ask:model");
reseed(3311); ev("startProd('e')"); grab("sor:yesno:prompt");
ev("prodModel()"); grab("sor:yesno:model");
ev("PR=null;"); ev("wipe()");

/* Diyalog. The run screen is the one that matters: what a learner can see
   while the other person is still talking, which must be the moves and
   nothing else. Both endings are here too, because they are the whole
   score. */
ev("wipe()");
reseed(5200); ev("go('diyalog')"); grab("diyalog");
ev("startDia('bilet')"); grab("diyalog:hear");
ev("diaRepair(0)"); grab("diyalog:repair");
ev("diaRepair(2)"); grab("diyalog:rephrase");
ev("diaPick(0)"); grab("diyalog:model");
ev("diaNext()"); ev("diaPick(0)"); ev("diaNext()"); grab("diyalog:number");
ev("document.getElementById('dgbox').value='1'"); ev("diaCheck()"); grab("diyalog:number:wrong");
ev("diaNext()"); ev("diaPick(0)"); ev("diaNext()"); grab("diyalog:done");
reseed(5201); ev("startDia('eczane')"); ev("diaPick(0)"); ev("diaNext()");
ev("diaQuit()"); grab("diyalog:left");
ev("DG=null;"); ev("wipe()");

/* Atasözleri ve deyimler. Both banks, and every verdict the strictest
   judge in the app can give: exact, marked, and overruled. No seed is
   needed — the queue is bank order until something has been graded. */
ev("wipe()"); ev("S.ata={};save()");
ev("go('ata')"); grab("ata");
ev("startAta('a')"); grab("ata:say:ask");
ev("document.getElementById('abox').value=AT.q[0].c"); ev("ataCheck()"); grab("ata:say:exact");
ev("ataNext()");
ev("document.getElementById('abox').value='bambaşka bir cümle'"); ev("ataCheck()"); grab("ata:say:marked");
ev("ataAccept()"); grab("ata:say:overruled");
ev("S.ata={};save()"); ev("startAta('d')"); grab("ata:deyim:ask");
ev("document.getElementById('abox').value=AT.q[0].c"); ev("ataCheck()"); grab("ata:deyim:reveal");
/* The variant card: a right answer that names the other real wording. */
ev("S.ata={};save()"); ev("startAta('a')");
ev("while(AT.q[AT.i]&&!(AT.q[AT.i].alt||[]).length)AT.i++;");
ev("if(AT.q[AT.i]){AT.phase='ask';render();}");
ev("if(AT.q[AT.i]){document.getElementById('abox').value=AT.q[AT.i].alt[0];ataCheck();}");
grab("ata:say:variant");
ev("AT=null;"); ev("wipe()");

/* Sayılar. Both directions at both ends: what is on screen while the
   clock runs, and what the verdict looks like — including the one that
   only this mode can give, right but too late. */
ev("wipe()"); ev("setNmax(9999)"); ev("setNcap(5)");
/* The hub draws a fresh example beside each shape on every paint, so it
   needs its own seed like every other walk in this file. */
reseed(4099); ev("go('sayilar')"); grabx("sayilar");
reseed(4100); ev("startNum('duy')"); grabx("sayilar:duy:ask");
ev("document.getElementById('nbox').value=NM.q[0].show.replace(' TL','')");
ev("numCheck()"); grabx("sayilar:duy:right");
ev("numNext()");
ev("document.getElementById('nbox').value='99999999'");
ev("numCheck()"); grabx("sayilar:duy:wrong");
ev("numNext()");
ev("NM.t0=Date.now()-9000");
ev("document.getElementById('nbox').value=NM.q[2].show.replace(' TL','')");
ev("numCheck()"); grabx("sayilar:duy:slow");
reseed(4101); ev("startNum('oku')"); grabx("sayilar:oku:ask");
ev("numReveal()"); grabx("sayilar:oku:model");
ev("numMark(true)");
ev("NM.i=NM.q.length;NM.phase='end'"); ev("render()"); grabx("sayilar:end");
ev("NM=null;"); ev("wipe()");

/* Hata defteri. The row is the thing worth fingerprinting: prompt, what
   was said, what was right, and the why — a change to any of those shows
   up here rather than in a count. */
ev("wipe()"); ev("go('hata')"); grab("hata:empty");
ev("go('unit','a1u1','g')");
ev("startUnitQuiz('a1u1')"); ev("answerMC(3)"); ev("nextQ()"); ev("answerMC(0)");
ev("startUnitQuiz('a1u1')"); ev("answerMC(3)");
ev("go('hata')"); grab("hata");
reseed(2580); ev("startProd('t')"); ev("prodModel()"); ev("prodMark(false)");
ev("go('hata')"); grab("hata:patterns");
ev("errForget('q:a1u1#0')"); grab("hata:forgotten");
ev("wipe()");

/* Kendi kelimelerim: empty, with a word, and mid-edit. */
ev("wipe()"); ev("mineOpen()"); grab("mine:empty");
env.doc.getElementById("mtr").value = "zeytinyağı";
env.doc.getElementById("men").value = "olive oil";
env.doc.getElementById("mnote").value = "market label";
ev("mineAdd()"); grab("mine");
ev("mineEdit(0)"); grab("mine:editing");
ev("mineCancel()");
ev("go('dict')"); ev("dictSrc('mine')"); grab("dict:src:mine"); ev("dictSrc('all')");
ev("wipe()");

/* The three views a learner actually meets in their first minutes: the
   orientation card with nothing behind them, the plan once one unit has
   been opened, and the plan mid-unit. */
ev("wipe()"); ev("go('unit','a1u1','v')"); ev("home()"); grabx("home:plan");
/* The orientation card folds once something has been met, so the open
   state needs its own grab. */
ev("S.tips=true;save()"); ev("TIPSOPEN=null"); ev("home()"); grabx("home:tips-folded");
ev("tipsToggle()"); grabx("home:tips-open"); ev("TIPSOPEN=null");
ev("go('unit','a1u4','r')"); ev("home()"); grabx("home:plan:resume");
ev("wipe()"); meetAll(); ev("hideTips()"); ev("home()"); grabx("home:tips-hidden");
/* The plan folded and unfolded. Only the folded state is the default, so
   the open one needs its own grab or a change inside the fold would go
   unfingerprinted. */
ev("planToggle()"); grabx("home:plan:open");
ev("planToggle()");
ev("go('dersler')"); grab("dersler:underway");
ev("go('araclar')"); grab("araclar:underway");
ev("go('about')"); grab("about:tips-hidden"); ev("showTips()");

ev("go('unit','a1u1','v')"); ev("starAll('a1u1')");
ev("go('words')"); grab("words:full");
/* Both of these shuffle, so they need their own seed: without it their
   hashes depend on how much randomness everything above them happened to
   consume, and adding a step anywhere earlier silently moves them. */
reseed(8080); ev("startCards()"); grab("cards"); ev("flip()"); grab("cards:flip");
reseed(9090); ev("startReview()"); grab("review"); ev("rvFlip()"); grab("review:flip");
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
