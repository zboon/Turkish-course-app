#!/usr/bin/env node
/* Türkçe Macera — the app driven headlessly on the course's DOM stub
   (test/dom.js): every unit's lessons and trophy played through the real
   engine, right and wrong, the map opening in order, the review ladder,
   the comic read aloud, backup and restore, and a browser with no voice.
   Usage: node kids/test/sim.js [dist/kids/index.html]                   */
const path = require("path");
const file = process.argv[2] || path.join(__dirname, "..", "..", "dist", "kids", "index.html");
const boot = require(path.join(__dirname, "..", "..", "test", "dom.js"));
const env = boot(file);
const { ev, doc, voice, drain, store } = env;
const fails = []; let checks = 0, paints = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const q = s => JSON.stringify(s);
let last = env.lastHTML();
const BAD = /undefined|\bNaN\b|\[object Object\]/;
env.appEl._onpaint = h => { paints++; last = h; if (BAD.test(h)) fails.push("a screen leaks " + BAD.exec(h)[0] + ": " + h.slice(Math.max(0, h.search(BAD) - 80), h.search(BAD) + 30)); };
const step = (name, fn) => { try { fn(); } catch (e) { fails.push(name + " threw: " + (e && e.stack || e)); } };

/* Answer the round in play, right or wrong, the way a child would. */
function answer(right) {
  const r = ev("cur()");
  if (r.t === "learn" || r.t === "talk") { ev("next()"); return; }
  if (r.t === "hear" || r.t === "see") {
    const k = right ? r.w.k : r.opts.find(o => o.k !== r.w.k).k;
    ev("pick(" + q(k) + ")");
  } else if (r.t === "match") {
    if (!right) { ev("mTapL(" + q(r.left[0].k) + ")"); ev("mTapR(" + q(r.right.find(w => w.k !== r.left[0].k).k) + ")"); }
    r.left.forEach(w => { ev("mTapL(" + q(w.k) + ")"); ev("mTapR(" + q(w.k) + ")"); });
  } else if (r.t === "spell") {
    const used = [];
    const letters = right ? r.w.tr.split("") : r.w.tr.split("").reverse().concat(["x"]).slice(0, 2);
    letters.forEach(l => { const i = r.tiles.findIndex((t, j) => t === l && !used.includes(j)); if (i > -1) { used.push(i); ev("tAdd(" + i + ")"); } });
    if (!used.length) ev("tAdd(0)");
    ev("spellCheck()");
  } else if (r.t === "order") {
    const used = [];
    const words = right ? r.p.tr.split(" ") : r.tiles.slice().reverse();
    words.forEach(w => { const i = r.tiles.findIndex((t, j) => t === w && !used.includes(j)); used.push(i); ev("tAdd(" + i + ")"); });
    if (!right && r.tiles.slice().reverse().join(" ") === r.p.tr) ev("tDel(0)");
    ev("orderCheck()");
  } else if (r.t === "type") {
    doc.getElementById("kbox").value = right ? r.w.tr : "yanlış";
    ev("typeCheck()");
  } else if (r.t === "say") { ev("sayShow()"); ev("saySelf(" + right + ")"); }
  ok(ev("G.phase") === "fb", "a " + r.t + " round did not reach its feedback");
  ok(ev("G.ok") === right, "a " + r.t + " round was marked the other way");
  ev("next()");
}
/* Play the run to its end: `wrongFirst` misses each round's first try. */
function playAll(wrongFirst) {
  let guard = 0;
  while (!ev("G.done") && guard++ < 200) {
    const r = ev("cur()");
    const first = !ev("G.tries[" + r.rid + "]");
    answer(!(wrongFirst && first && !ev("UNSCORED[" + q(r.t) + "]")));
  }
  ok(ev("G.done"), "a run did not finish");
}

step("home", () => {
  ok(/Adın ne\?/.test(last) && last.includes('id="nbox"'), "a first visit does not ask the child's name");
  doc.getElementById("nbox").value = "Deniz";
  ev("setName()");
  ok(ev("S.name") === "Deniz" && /Merhaba, Deniz/.test(last), "the name was not taken");
  ok(voice.spoken[voice.spoken.length - 1] === "Merhaba Deniz", "the name was not greeted aloud");
  ok(ev("unitOpen('k1')") && !ev("unitOpen('k2')"), "the map does not open at unit one only");
  ok((last.match(/class="tile locked"/g) || []).length === 11, "the map does not show eleven locked units");
});

step("unit screens", () => {
  ev("KUNITS").forEach(u => {
    ev("go('unit'," + q(u.id) + ")");
    ok(last.length > 200, u.id + " painted nothing");
  });
  ev("go('unit','k2')");
  ok(/Kilitli/.test(last) && !last.includes("startLesson('k2'"), "a locked unit offers its lessons");
  ev("go('unit','k1')");
  ok(last.includes("startLesson('k1',0)") && !last.includes("startLesson('k1',1)") && last.includes("startCup('k1')"),
     "unit one does not open with lesson one and the trophy only");
});

step("lesson one, all right", () => {
  const xp0 = ev("S.xp");
  ev("startLesson('k1',0)");
  ok(ev("cur().t") === "learn" && voice.spoken[voice.spoken.length - 1] === ev("cur().w.tr"), "a new word is not said as it arrives");
  const said = voice.said; ev("render()");
  ok(voice.said === said, "a redraw said the word again");
  playAll(false);
  ok(ev("prog('k1').l[0]") === 3, "a perfect lesson did not earn three stars");
  ok(ev("S.xp") - xp0 === 100, "ten first-try answers did not earn 100 XP: " + (ev("S.xp") - xp0));
  ok(Object.keys(ev("S.srs")).length === 10 && Object.values(ev("S.srs")).every(r => r.d === ev("dayNum()") + 1),
     "lesson one did not put its ten words on tomorrow's review");
  ok(Object.keys(ev("S.srs")).every(k => /^k\d+#\d$/.test(k)), "review keys are not unit#index");
  ok(ev("lessonOpen('k1',1)") && !ev("lessonOpen('k1',2)"), "lesson two did not open after lesson one");
  ok(/Mükemmel/.test(last), "a perfect lesson does not say so");
});

step("lesson two, every first try wrong", () => {
  ev("startLesson('k1',1)");
  const n0 = ev("G.q.length");
  playAll(true);
  ok(ev("G.q.length") > n0, "missed rounds did not come back");
  ok(ev("G.first") === 0 && ev("prog('k1').l[1]") === 1, "a lesson with every first try wrong did not score one star");
  ok(ev("lessonOpen('k1',2)"), "finishing lesson two, however badly, did not open lesson three");
});

step("lesson three and the comic", () => {
  ev("startLesson('k1',2)");
  ok(ev("cur().t") === "talk", "lesson three does not open on the comic");
  const lines = ev("kunit('k1').talk").map(l => l[1]);
  voice.spoken = [];
  ev("talkPlay(0)"); drain(200);
  ok(lines.every((l, i) => voice.spoken[i] === l), "the comic was not read aloud in order: " + voice.spoken.slice(0, 6).join(" | "));
  voice.spoken = [];
  ev("talkPlay(0)"); ev("next()"); drain(200);
  ok(voice.spoken.filter(t => lines.includes(t)).length <= 1, "the comic kept reading over the next round");
  /* Walked, not sampled once: every unit's lesson three built ten times. */
  ok(ev("KUNITS").every(u => { for (let i = 0; i < 10; i++) if (!ev("buildLesson(kunit(" + q(u.id) + "),2)").filter(r => r.t === "order").every(r => r.p.tr.split(" ").length >= 2)) return false; return true; }),
     "a one-word phrase was given as tiles");
  playAll(false);
  ok(ev("prog('k1').l[2]") === 3, "lesson three did not score");
});

step("the trophy", () => {
  ev("startCup('k1')");
  ok(ev("G.q.length") === ev("CUP_N"), "the trophy is not " + ev("CUP_N") + " questions");
  const n = ev("G.q.length");
  let i = 0;
  while (!ev("G.done")) answer(i++ >= 3);          /* three wrong: 7 of 10 */
  ok(ev("G.q.length") === n, "the trophy brought a missed question back — it is a test");
  ok(!ev("cupWon('k1')") && !ev("unitOpen('k2')"), "seven of ten won the trophy");
  ok(/Az kaldı/.test(last), "a lost trophy does not say so");
  ev("startCup('k1')");
  i = 0;
  while (!ev("G.done")) answer(i++ >= 2);          /* two wrong: 8 of 10 */
  ok(ev("cupWon('k1')") && ev("unitOpen('k2')") && !ev("unitOpen('k3')"), "eight of ten did not win the trophy and open unit two only");
  ok(/Sayılar/.test(last), "winning does not name the unit it opened");
});

step("every unit, through to the end", () => {
  ev("KUNITS").forEach(u => {
    ok(ev("unitOpen(" + q(u.id) + ")"), u.id + " was not open when its turn came");
    for (let n = 0; n < 3; n++) { ev("startLesson(" + q(u.id) + "," + n + ")"); playAll(false); }
    ev("startCup(" + q(u.id) + ")"); playAll(false);
    ok(ev("cupWon(" + q(u.id) + ")"), u.id + "'s trophy could not be won with every answer right");
  });
  ev("home()");
  ok(/Every trophy is won/.test(last), "a finished map does not say so");
});

step("testing out", () => {
  ev("confirm=function(){return true}; wipe()");
  ok(Object.keys(ev("S.u")).length === 0 && ev("S.name") === "", "wipe kept progress");
  ev("startCup('k1')"); playAll(false);
  ok(ev("unitOpen('k2')") && ev("prog('k1').l[0]") === 0, "winning the trophy straight away did not open unit two");
  ev("startCup('k2')"); playAll(false);
  ok(ev("metWords().length") === 20, "units tested out of do not count their words as met");
  ok(ev("reviewDue().length") === ev("KNEW_DAY"), "tested-out words did not reach the review, a day's worth at a time");
});

step("the review", () => {
  ev("home()");
  ok(last.includes("startReview()"), "home does not offer the review");
  ev("startReview()"); playAll(false);
  ok(Object.values(ev("S.srs")).every(r => r.b === 1), "words got right in review did not move up a box");
  ok(ev("reviewDue().length") === 0, "the review refilled past the day's allowance");
  ev("Object.keys(S.srs).forEach(function(k){S.srs[k].d-=1;S.srs[k].f-=1}); save()");
  ev("startReview()"); playAll(true);
  ok(Object.values(ev("S.srs")).every(r => r.b === 0 && r.d === ev("dayNum()")), "words missed in review did not come back today");
});

step("leaving stops the voice", () => {
  ev("startLesson('k2',0)");
  const c = voice.cancels;
  ev("back()");
  ok(ev("V.view") === "unit" && voice.cancels > c, "back() from a lesson did not stop the voice and return to the unit");
  /* Leaving mid-comic silences it: its own timers die with the screen. */
  ev("S.u.k1={l:[1,1,0],cup:S.u.k1&&S.u.k1.cup}; startLesson('k1',2)");
  ok(ev("cur().t") === "talk", "lesson three did not open on the comic for the leaving check");
  ev("talkPlay(0)");
  const lines = ev("kunit('k1').talk").map(l => l[1]);
  voice.spoken = [];
  ev("home()"); drain(200);
  ok(!voice.spoken.some(t => lines.includes(t)), "the comic kept reading after leaving the lesson");
});

step("backup and restore", () => {
  ev("go('parents')");
  ok(/For grown-ups|for grown-ups/.test(last) && last.includes("exportBox()"), "the grown-ups page is missing its backup");
  ev("exportBox()");
  const dump = doc.getElementById("iobox").value;
  ok(JSON.parse(dump).u.k1, "the backup does not carry the units");
  ev("wipe()");
  ev("go('parents')");
  doc.getElementById("iobox").value = dump;
  ev("importBox()");
  ok(ev("cupWon('k1')") && ev("V.view") === "home", "restoring did not bring the progress back");
  ok(store.get("turkce-kids-v1") && !store.get("turkce-course-v1"), "the app saved under the wrong key — it must never touch the course's progress");
});

step("no voice", () => {
  ev("__ss=window.speechSynthesis; delete window.speechSynthesis; home()");
  ok(/can’t speak/.test(last), "home does not say the browser cannot speak");
  ev("startLesson('k1',0)"); playAll(false);
  ok(ev("G.done"), "a lesson could not be played without speech");
  ev("window.speechSynthesis=__ss; home()");
});

console.log("kids sim: " + paints + " paints · " + checks + " checks · " + voice.said + " utterances");
if (fails.length) { fails.slice(0, 30).forEach(f => console.error("  FAIL " + f)); console.error("\nkids sim: " + fails.length + " failure(s)"); process.exit(1); }
console.log("kids sim ok");
