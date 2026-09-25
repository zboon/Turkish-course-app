#!/usr/bin/env node
/* The native speaker's review page, built from the source.

     node tools/review.js                     dist/kontrol/index.html, for Pages
     node tools/review.js --artifact <file>   and the artifact's copy too

   Everything in the course is written by the author, and only the spoken
   material (Konuşma dili, v3.61) has been read by a native speaker. This
   page gathers the next round, in the order a learner meets it: the
   Nasreddin Hoca tales, the lessons before unit one, the interface
   Turkish, the Adacıklar questions and the words to tap in every
   passage. It is built from src/, so it can be rebuilt whenever the
   Turkish changes, and every item carries a stable id (a tale line
   hk:nh01#3, a word ok:a1u5:kahvaltıda, an instruction tx:<hash>) so the
   answers that come back can be found in the source again.

   The reviewer flags only what is wrong or doubtful and then marks a
   section done, which says the rest of it is fine: with some two
   thousand items, a verdict on each would be days of tapping. Answers
   stay in the reviewer's browser until they copy them out as text. */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const { interfaceStrings } = require("./strings.js");

const files = ["levels", "a1", "a2", "b1", "b2", "c1", "c2", "_close", "baslarken", "ada", "okuma", "hikaye"];
const sb = {};
vm.createContext(sb);
vm.runInContext(files.map(n => fs.readFileSync(path.join(ROOT, "src/data", n + ".js"), "utf8")).join("\n") +
  "\nthis.OUT={UNITS:UNITS,BASLA:BASLA,ADA:ADA,OKW:OKW,HIKAYE:HIKAYE};", sb);
const { UNITS, BASLA, ADA, OKW, HIKAYE } = sb.OUT;
const unit = id => UNITS.find(u => u.id === id);

/* A short stable id for a string, so an instruction keeps its id when
   the file around it changes. */
function hash(s) {
  let h = 0x811c9dc5;
  for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
const low = s => String(s).replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
const WORD = /[A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû]+(?:'[A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû]+)?/g;

/* An item: {id, g (group heading), tr (the Turkish to check, large),
   en (its English), x (extra lines: [label, text])}. */
const SECS = [];

/* 1 · the tales */
{
  const it = [];
  HIKAYE.forEach(h => {
    const g = h.lv + " · " + h.n + " · " + h.read.t;
    it.push({ id: "hk:" + h.id + "#t", g, gn: h.read.note || "", tr: h.read.t, en: "title", x: [] });
    h.read.lines.forEach((l, i) => it.push({ id: "hk:" + h.id + "#" + i, g, tr: l[0], en: l[1], x: [] }));
  });
  SECS.push({ k: "hikaye", tr: "Nasreddin Hoca fıkraları", en: "The Nasreddin Hoca tales", min: 20, it,
    p: "Yeni yazılmış on iki kısa fıkra, uygulamanın en kolay okuma metinleri. A1’dekiler şimdiki zamanla, sesli anlatılır gibi; A2’dekiler geçmiş zamanla anlatılıyor. Dil bilerek basit tutuldu. Asıl soru: cümle doğal mı, bir Türk bu fıkrayı böyle anlatır mı? İngilizce çeviri yanlışsa onu da yaz.",
    e: "Twelve new short tales, the easiest reading in the app: A1 in the present tense, as a fıkra is told aloud, A2 in the past. Simple on purpose. Is each sentence natural, and is this how a Turk would tell it? Flag a wrong English line too." });
}

/* 2 · the lessons before unit one */
{
  const it = [];
  BASLA.forEach(b => {
    const g = b.tr + " · " + b.en;
    it.push({ id: "bs:" + b.id + "#intro", g, prose: b.intro, x: [] });
    b.parts.forEach((p, pi) => {
      it.push({ id: "bs:" + b.id + "#h" + pi, g, tr: p.h, en: p.en, x: [] });
      (p.p || []).forEach((t, ti) => it.push({ id: "bs:" + b.id + "#p" + pi + "." + ti, g, prose: t, x: [] }));
      (p.letters || []).forEach((l, li) => it.push({ id: "bs:" + b.id + "#l" + pi + "." + li, g, tr: l[0] + " · " + l[1], en: l[2], x: l[3] ? [["söylenişi", l[3]]] : [] }));
      (p.rows || []).forEach((r, ri) => it.push({ id: "bs:" + b.id + "#r" + pi + "." + ri, g, tr: r[0], en: r[1], x: r[2] ? [["not", r[2]]] : [] }));
    });
    b.check.forEach((c, ci) => {
      const x = [];
      if (c.say) x.push(["duyulan", c.say]);
      if (c.a) x.push(["şıklar", c.a.map((a, i) => (i === c.c ? "✓ " : "") + a).join("   ·   ")]);
      if (c.w) x.push(["kelimeler", c.w.join(" / ")]);
      if (c.t !== "mc") x.push(["cevap", c.c]);
      x.push(["açıklama", c.why]);
      it.push({ id: "bs:" + b.id + "#c" + ci, g, q: c.q, x });
    });
  });
  SECS.push({ k: "basla", tr: "Başlarken", en: "The six lessons before unit one", min: 30, it,
    p: "Hiç Türkçe görmemiş biri için altı giriş dersi: alfabe, yazım, vurgu, ekler, cümle düzeni ve nezaket. Açıklamalar İngilizce, çünkü okuyan henüz Türkçe bilmiyor. Bakılacak şey Türkçe hakkında söylenenlerin doğru olup olmadığı: bir harfin söylenişi, bir vurgu, bir örnek cümle, sorulardaki doğru cevap.",
    e: "Six short lessons for someone who has never seen Turkish: the alphabet, spelling, stress, endings, word order and politeness. The explanations are in English, for a learner with no Turkish yet. The check is whether what they say about Turkish is true: a sound, a stress, an example, the right answer to a question." });
}

/* 3 and 4 · the interface */
{
  const all = interfaceStrings(ROOT);
  const tx = all.filter(x => x.kind === "tx"), ui = all.filter(x => x.kind === "ui");
  const name = f => f.replace(/^app\./, "").replace(/\.js$/, "");
  SECS.push({ k: "talimat", tr: "Talimatlar", en: "Instructions", min: 30,
    it: tx.map(x => ({ id: "tx:" + hash(x.tr + "|" + x.en), g: name(x.files[0]), tr: x.tr, en: x.en, x: [] })),
    p: "Uygulamanın öğrenciye söylediği her şeyin Türkçesi: ne yapacağı, bir ekranın ne işe yaradığı. B1’den itibaren öğrenci bunları yalnız Türkçe görüyor, o yüzden kısa ve her gün aynı cümleler olmaları bilerek seçildi. Öğrenciye sen diye hitap ediliyor. “…” uygulamanın yerine bir sayı ya da isim koyduğu yer.",
    e: "Everything the app tells the learner to do, in Turkish. From B1 the learner sees these in Turkish only, so they are short and reused on purpose. The learner is addressed as sen. “…” marks where the app puts a number or a name." });
  SECS.push({ k: "etiket", tr: "Düğmeler ve başlıklar", en: "Buttons and headings", min: 10,
    it: ui.map(x => ({ id: "ui:" + hash(x.tr + "|" + x.en), g: "", tr: x.tr, en: x.en, x: [] })),
    p: "Düğmelerde, sekmelerde ve başlıklarda yazan kısa Türkçe. Bir ekranda bir düğme için doğal mı, ona bak.",
    e: "The short Turkish on buttons, tabs and headings. Is it what a Turkish app would put on a button?" });
}

/* 5 · Adacıklar */
{
  const it = [];
  ADA.forEach(i => {
    const g = i.tr + " · " + i.en;
    it.push({ id: "ada:" + i.id, g, tr: i.tr, en: i.en, x: [] });
    i.q.forEach(q => it.push({ id: "ada:" + i.id + "." + q.id, g, tr: q.tr, en: q.en, x: [["örnek cevap", q.eg[0] + "  (" + q.eg[1] + ")"]] }));
  });
  SECS.push({ k: "ada", tr: "Adacıklar", en: "Questions about the learner’s own life", min: 10, it,
    p: "Öğrenciye kendi hayatı hakkında sorulan sorular ve her birinin altında uyarlaması için bir örnek cevap. Soru, tanıştığın birine sorulacak gibi mi? Örnek cevap doğal mı?",
    e: "Questions the learner answers about their own life, each with a model answer to adapt. Is each question what you would really ask someone, and is the model answer natural?" });
}

/* 6 to 8 · the words to tap */
function wordItems(id, g, lines, w) {
  const it = [];
  Object.keys(w).forEach(k => {
    const e = w[k], ln = lines.find(l => (l[0].match(WORD) || []).some(t => low(t) === k));
    const x = [["sözlükte", e[0] + " · " + e[1]]];
    if (e[3]) x.push(["burada", e[3]]);
    if (ln) x.push(["metinde", ln[0]]);
    it.push({ id: "ok:" + id + ":" + k, g, tr: e[2] ? e[2].replace(/'-/g, "'").replace(/-/g, " · ") : k, en: "", x, w: k });
  });
  return it;
}
[["A1", "A2"], ["B1", "B2"], ["C1", "C2"]].forEach((lv, n) => {
  let it = [];
  if (n === 0) HIKAYE.forEach(h => { it = it.concat(wordItems(h.id, "Nasreddin Hoca · " + h.n + " · " + h.read.t, h.read.lines, h.w)); });
  UNITS.filter(u => lv.includes(u.lv) && OKW[u.id]).forEach(u => {
    it = it.concat(wordItems(u.id, u.lv + " · " + u.n + " · " + u.read.t, u.read.lines, OKW[u.id]));
  });
  SECS.push({ k: "kelime" + lv.join(""), tr: "Metindeki kelimeler · " + lv.join("–"), en: "Words to tap · " + lv.join("–"), min: [40, 45, 60][n], it,
    p: "Okuma metinlerinde öğrencinin dokunup açıklamasını görebildiği kelimeler: ekleriyle ayrılmış hâli, sözlükteki hâli ve anlamı, bu cümledeki anlamı. Ekler doğru mu ayrılmış? Anlam bu cümleye uyuyor mu? Altında kelimenin geçtiği cümle var." +
      (n === 2 ? " C2’de bazı metinler bilerek yöresel ya da eski (Karadeniz ağzı, Osmanlıca dilekçe); orada açıklama bunu söylüyor." : ""),
    e: "The words a learner can tap in a passage: split into its endings, its dictionary form and meaning, and what it means in this sentence. Is the split right, and does the meaning fit the sentence it comes from?" +
      (n === 2 ? " Some C2 passages are regional or old Turkish on purpose, and the note says so." : "") });
});

const DATA = SECS.map(s => ({ k: s.k, tr: s.tr, en: s.en, p: s.p, e: s.e, min: s.min, it: s.it }));
const total = DATA.reduce((n, s) => n + s.it.length, 0);
const ids = new Set();
DATA.forEach(s => s.it.forEach(i => { if (ids.has(i.id)) throw new Error("review: id " + i.id + " is used twice"); ids.add(i.id); }));

/* Two outputs from one template. Pages serves a whole document at
   dist/kontrol/index.html, which build.sh makes, so the page deploys with
   the app. The artifact wants the same page without <html>, <head> and
   <body>, because the platform wraps it; --artifact <file> writes that. */
const tpl = fs.readFileSync(path.join(__dirname, "review.html"), "utf8");
const json = JSON.stringify(DATA).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const page = tpl.replace("/*DATA*/null", () => json).replace(/__TOTAL__/g, total.toLocaleString("tr-TR"));
const cut = page.indexOf("</style>") + "</style>".length;
const doc = '<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  page.slice(0, cut) + "\n</head>\n<body>" + page.slice(cut) + "</body>\n</html>\n";
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); return path.relative(ROOT, file); };
const ai = process.argv.indexOf("--artifact");
const outs = [write(path.join(ROOT, "dist", "kontrol", "index.html"), doc)];
if (ai > -1) outs.push(write(path.resolve(process.argv[ai + 1]), page));
console.log("review: " + DATA.map(s => s.k + " " + s.it.length).join(" · ") + " · " + total + " items → " + outs.join(", "));
