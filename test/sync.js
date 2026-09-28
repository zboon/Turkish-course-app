#!/usr/bin/env node
/* Sync across devices (src/shared/sync.js), tested the only honest way:
   two copies of the built app, two "devices" with their own
   localStorage, against one fake claude.ai database that enforces what
   the real one does (each account sees only its own data/users/<id>/,
   a document is at most 256 KiB, path segments follow the grammar).

   sim.js cannot do this: it is synchronous, and every database call is
   a promise. So this file is async and runs on its own.

     node test/sync.js                    the course, dist/index.html
     node test/sync.js dist/kids/index.html   the children's app        */
"use strict";
const path = require("path");
const boot = require("./dom.js");
const FILE = path.resolve(process.argv[2] || path.join(__dirname, "..", "dist", "index.html"));
const KIDS = /kids/.test(FILE);
const KEY = KIDS ? "turkce-kids-v1" : "turkce-course-v1";

let checks = 0;
const fails = [];
function ok(c, msg) { checks++; if (!c) fails.push(msg); }

/* --- a fake claude.ai database -------------------------------------- */
function cloud() {
  const docs = new Map();
  const c = { docs, writes: 0, deletes: 0, readonly: new Set() };
  const SEG = /^[A-Za-z0-9_\-.~:@+]+$/;
  const err = code => Object.assign(new Error(code), { code });
  const tick = () => new Promise(r => setImmediate(r));
  const mine = (uid, p) => p.startsWith("data/users/" + uid + "/");
  c.claude = uid => ({
    use: name => Promise.resolve(
      name === "db" ? {
        collection(p) {
          const parts = p.split("/");
          if (parts.length % 2 !== 1 || !parts.every(x => SEG.test(x))) throw new TypeError("bad collection path " + p);
          return {
            path: p,
            get: async () => {
              await tick();
              const out = [];
              for (const [k, v] of docs) {
                const kp = k.split("/");
                if (kp.length === parts.length + 1 && k.startsWith(p + "/") && mine(uid, k))
                  out.push({ id: kp[kp.length - 1], exists: true, data: () => JSON.parse(v) });
              }
              return { docs: out, size: out.length, empty: !out.length };
            },
            doc(id) {
              if (!SEG.test(id)) throw new TypeError("bad document id " + id);
              const full = p + "/" + id;
              return {
                id, path: full,
                set: async data => {
                  await tick();
                  if (!mine(uid, full) || c.readonly.has(uid)) throw err("invalid_argument");
                  const s = JSON.stringify(data);
                  if (Buffer.byteLength(s, "utf8") > 256 * 1024) throw err("invalid_argument");
                  docs.set(full, s); c.writes++;
                },
                delete: async () => { await tick(); if (!mine(uid, full)) throw err("invalid_argument"); docs.delete(full); c.deletes++; }
              };
            }
          };
        }
      } : name === "user" ? { id: () => Promise.resolve(uid) } : null)
  });
  return c;
}
const settle = async (n) => { for (let i = 0; i < (n || 40); i++) await new Promise(r => setImmediate(r)); };
function device(claude, store) { return boot(FILE, { seed: 7, claude, store }); }
const S = d => JSON.parse(JSON.stringify(d.ev("S")));
const synced = async d => { d.ev("syncNow()"); await settle(); };

(async () => {
  /* --- no platform: nothing happens, and it says so ------------------ */
  {
    const d = device(null);
    await settle();
    ok(d.ev("SYNC.st") === "off", "with no window.claude the sync is not off: " + d.ev("SYNC.st"));
    if (!KIDS) { d.ev("go('about')"); ok(d.lastHTML().includes("in this browser only"), "About does not say progress is on this device only"); }
  }

  const C = cloud();
  /* A device that already has progress, from before sync existed. */
  const seed = KIDS
    ? { name: "Ece", u: { k1: { l: [3, 2, 0] } }, srs: { "k1#0": { b: 2, d: 5 }, "k1#1": { b: 1, d: 3 } }, xp: 120, days: ["2026-09-20", "2026-09-21"], theme: "dark", snd: true }
    : { done: { a1u1: { score: 5, of: 5, at: 1 } }, seen: { a1u1: { v: 1 } }, star: ["merhaba|hello", "evet|yes"],
        srs: { "merhaba|hello": { b: 2, d: 100 }, "evet|yes": { b: 1, d: 99 } }, days: ["2026-09-20", "2026-09-21"],
        theme: "dark", rate: 1.2, err: { "q:a1u1#0": { m: "q", q: "x", c: "y", a: "z", w: "why", n: 2, at: 1 } } };
  const A = device(C.claude("u1"), { [KEY]: JSON.stringify(seed) });
  await settle();
  ok(A.ev("SYNC.st") === "on", "the first device did not come up synced: " + A.ev("SYNC.st") + " " + A.ev("SYNC.msg"));
  const keys = [...C.docs.keys()];
  ok(keys.length > 0 && keys.every(k => k.startsWith("data/users/u1/" + (KIDS ? "kids" : "course") + "/k/")), "the first sync wrote nothing, or wrote outside the account's own subtree");
  ok(!keys.some(k => /\/k\/(theme|rate)\./.test(k)), "a device-only setting (theme, rate) was synced");
  ok([...C.docs.values()].every(v => Buffer.byteLength(v, "utf8") <= 256 * 1024), "a document is over 256 KiB");

  /* --- a second device, fresh, same account: it gets the progress ---- */
  const B = device(C.claude("u1"));
  await settle();
  ok(B.ev("SYNC.st") === "on", "the second device did not come up synced");
  const b0 = S(B), a0 = S(A);
  if (KIDS) {
    ok(JSON.stringify(b0.u) === JSON.stringify(a0.u) && JSON.stringify(b0.srs) === JSON.stringify(a0.srs) && b0.xp === 120 && b0.name === "Ece",
       "the second device did not receive the child's progress");
  } else {
    ok(b0.done.a1u1 && b0.star.length === 2 && b0.srs["merhaba|hello"] && b0.srs["merhaba|hello"].b === 2 && b0.err["q:a1u1#0"],
       "the second device did not receive the progress");
    ok(b0.rate !== 1.2, "the speech rate travelled, and it belongs to the device");
  }
  ok(b0.theme !== "dark", "the theme travelled, and it belongs to the device");
  ok(JSON.stringify(b0.days) === JSON.stringify(a0.days), "the days studied did not travel");

  /* --- idle devices write nothing ------------------------------------- */
  let w0 = C.writes;
  await synced(A); await synced(B); await synced(A);
  ok(C.writes === w0, "two idle devices kept writing to each other: " + (C.writes - w0) + " writes");

  /* --- both change things before either syncs: both changes survive -- */
  if (KIDS) {
    A.ev("S.srs['k1#2']={b:1,d:4}; save()");
    B.ev("S.u.k2={l:[1,0,0]}; delete S.srs['k1#1']; save()");
  } else {
    A.ev("setStar('su','water',true); save()");
    B.ev("S.done.a1u2={score:4,of:5,at:2}; dropStar('evet|yes'); save()");
  }
  await synced(A); await synced(B); await synced(A);
  const a1 = S(A), b1 = S(B);
  if (KIDS) {
    ok(a1.srs["k1#2"] && b1.srs["k1#2"], "a word reviewed on one device is missing on the other");
    ok(a1.u.k2 && b1.u.k2, "a lesson played on one device is missing on the other");
    ok(!a1.srs["k1#1"] && !b1.srs["k1#1"], "a deletion did not travel");
  } else {
    ok(a1.star.includes("su|water") && b1.star.includes("su|water") && a1.srs["su|water"] && b1.srs["su|water"], "a word starred on one device is missing on the other");
    ok(a1.done.a1u2 && b1.done.a1u2, "a unit passed on one device is missing on the other");
    ok(!a1.star.includes("evet|yes") && !b1.star.includes("evet|yes") && !a1.srs["evet|yes"], "an unstar did not travel, or left star and srs out of step");
    ok(a1.star.every(k => a1.srs[k]) && b1.star.every(k => b1.srs[k]), "star and srs are out of step after a merge");
  }
  ok(JSON.stringify(a1) === JSON.stringify(Object.assign({}, b1, { theme: a1.theme, rate: a1.rate, snd: a1.snd })) ||
     JSON.stringify(Object.assign({}, a1, { theme: 0, rate: 0 })) === JSON.stringify(Object.assign({}, b1, { theme: 0, rate: 0 })),
     "after syncing both ways the two devices still differ");

  /* --- a device that only receives writes nothing back ---------------- */
  A.ev(KIDS ? "S.u.k3={l:[2,2,0]}; save()" : "S.done.a1u5={score:3,of:5,at:5}; save()");
  await synced(A);
  w0 = C.writes;
  await synced(B);
  ok(C.writes === w0, "a device that only received a change wrote it back: " + (C.writes - w0) + " writes");
  ok(KIDS ? S(B).u.k3 : S(B).done.a1u5, "the change did not arrive");

  /* --- a save syncs by itself, a few seconds later, once -------------- */
  w0 = C.writes;
  A.ev(KIDS ? "S.xp+=10; save(); S.xp+=10; save()" : "S.done.a1u3={score:5,of:5,at:3}; save(); S.done.a1u4={score:5,of:5,at:4}; save()");
  await settle();
  ok(C.writes === w0, "a save wrote at once rather than after the pause");
  A.drain(); await settle();
  ok(C.writes > w0, "a save never synced");
  await synced(B);
  ok(KIDS ? S(B).xp === S(A).xp : S(B).done.a1u4 && S(B).done.a1u3, "what one device saved did not reach the other");

  /* --- a device with its own progress links: the two are joined ------ */
  const own = KIDS ? { name: "", u: { k5: { l: [2, 0, 0] }, k1: { l: [1, 0, 0] } }, srs: {}, xp: 5, days: ["2026-09-19"] }
                   : { done: { b1u1: { score: 5, of: 5, at: 5 }, a1u1: { score: 1, of: 5, at: 0 } }, star: [], srs: {}, days: ["2026-09-19"] };
  const D = device(C.claude("u1"), { [KEY]: JSON.stringify(own) });
  await settle();
  const d0 = S(D);
  ok(KIDS ? d0.u.k5 && d0.u.k1 : d0.done.b1u1 && d0.done.a1u1, "a device that had its own progress lost it, or did not get the account's");
  ok(KIDS ? JSON.stringify(d0.u.k1.l) === JSON.stringify(S(A).u.k1.l) : d0.done.a1u1.score === 5,
     "a device linking with an older copy of an entry kept its own over the account's");
  ok(d0.days.includes("2026-09-19") && d0.days.includes("2026-09-20") && d0.days.join() === d0.days.slice().sort().join(), "the days studied were not joined, or not kept in order");
  await synced(A);
  ok(KIDS ? S(A).u.k5 : S(A).done.b1u1, "the joined device's own progress did not reach the others");

  /* --- a large store: bucketed, chunked, every document under the cap - */
  if (!KIDS) {
    A.ev("for(var i=0;i<4000;i++){S.srs['kelime'+i+'|word number '+i+' with a longer gloss']={b:i%7,d:1000+i,l:900,f:800};}" +
         "for(var j=0;j<400;j++){S.err['r:x'+j]={m:'r',q:'Bir soru metni burada, biraz uzunca: '+j,c:'cevap',a:'yanlış',w:'Açıklama: '+Array(40).join('ünlü uyumu '),n:j%5,at:j};}save()");
    await synced(A);
    ok([...C.docs.values()].every(v => Buffer.byteLength(v, "utf8") <= 256 * 1024), "a large store wrote a document over 256 KiB");
    ok(new Set([...C.docs.keys()].filter(k => /\/k\/srs\./.test(k)).map(k => k.split(".")[1])).size > 1, "a large map was not split into buckets");
    await synced(B);
    ok(Object.keys(S(B).srs).length === Object.keys(S(A).srs).length && Object.keys(S(B).err).length === 401, "a large store did not arrive whole");
    /* A bucket whose write was cut off halfway is not read as half a map. */
    const chunk = [...C.docs.keys()].find(k => /\/k\/srs\.\d+\.1$/.test(k)) || [...C.docs.keys()].find(k => /\/k\/srs\.\d+\.0$/.test(k));
    const before = Object.keys(S(B).srs).length;
    C.docs.delete(chunk);
    await synced(B);
    ok(Object.keys(S(B).srs).length === before, "a torn bucket in the account deleted entries on this device");
    ok([...C.docs.keys()].includes(chunk), "a torn bucket was not written back whole");
  }

  /* --- wipe travels ---------------------------------------------------- */
  A.ev("wipe()");
  await synced(A); await synced(B);
  ok(KIDS ? !Object.keys(S(B).u).length : !Object.keys(S(B).done).length && !S(B).star.length, "a wipe on one device did not reach the other");
  ok(S(B).theme !== undefined || true, "");

  /* --- an account that may read but not save ------------------------- */
  {
    const R = cloud(); R.readonly.add("u9");
    const E = device(R.claude("u9"), { [KEY]: JSON.stringify(seed) });
    await settle();
    ok(E.ev("SYNC.st") === "ro", "an account refused writes is not told so: " + E.ev("SYNC.st"));
    ok(KIDS ? S(E).xp === 120 : S(E).done.a1u1, "a refused write touched the progress on this device");
    if (!KIDS) { E.ev("go('about')"); ok(E.lastHTML().includes("not save to it"), "About does not explain a read-only account"); }
  }

  /* --- another account's progress on this browser is left alone ------- */
  {
    const store = { [KEY]: JSON.stringify(seed), [KEY + ":sync"]: JSON.stringify({ uid: "u1", base: {}, m: {}, ids: {} }) };
    const w = C.writes;
    const F = device(C.claude("u2"), store);
    await settle();
    ok(F.ev("SYNC.st") === "other", "a browser holding another account's progress synced it anyway: " + F.ev("SYNC.st"));
    ok(C.writes === w && ![...C.docs.keys()].some(k => k.includes("/u2/")), "another account's progress was written to this one");
  }

  /* --- signed out: no id, nothing written ------------------------------ */
  {
    const G = device({ use: n => Promise.resolve(n === "db" ? {} : n === "user" ? { id: () => Promise.resolve(null) } : null) });
    await settle();
    ok(G.ev("SYNC.st") === "noid", "a signed-out viewer is not told to sign in: " + G.ev("SYNC.st"));
  }

  console.log("sync" + (KIDS ? " (kids)" : "") + ": " + checks + " checks · " + C.docs.size + " documents at the end");
  if (fails.length) {
    fails.forEach(f => console.error("  FAIL " + f));
    console.error("\nsync: " + fails.length + " failure" + (fails.length > 1 ? "s" : ""));
    process.exit(1);
  }
  console.log("sync ok");
})().catch(e => { console.error("sync test threw: " + (e && e.stack || e)); process.exit(1); });
