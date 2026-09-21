# CLAUDE.md — Türkçe course app

A single-file offline Turkish course, A1→C2. `src/` is the truth; `dist/index.html`
is generated. Never hand-edit `dist/`.

## Workflow

```bash
./build.sh              # concatenate src/ → dist/index.html, parse-check it
node test/validate.js   # data integrity: 60 units, answer keys, order tiles
node test/sim.js        # headless render of all 316 screens + quiz/voice/SRS paths
```

Run all three before every commit. `build.sh` already runs the parse check; the
other two take a second each. They exist because the data files are fragments of
one array literal — a stray comma in `src/data/b2.js` takes down the entire app,
and the browser shows a blank page with the error only in the console.

## How the build works

Concatenation *is* the build. Order is load-bearing:

```
src/shell.head.html      <!doctype … <style>…</style> … <div id="app"></div><script>
src/data/levels.js       const LEVELS=[…];  const UNITS=[
src/data/a1.js … c2.js   unit objects, comma-separated, in display order
src/data/_close.js       ];
src/data/placement.js    const PLACEMENT=[…];
src/app.js               everything else
src/shell.foot.html      </script></body></html>
```

`unitsOf(lv)` filters `UNITS` in array order, so a unit's position in its level
file is the order the learner sees. Keep `n:` in step with that position —
`validate.js` enforces it.

## Unit schema

```js
{id:"b1u3", lv:"B1", n:3,
 tr:"Gördüğüm şey", en:"The thing I saw", focus:"sıfat-fiiller -An · -DIK",
 vocab:[["kaşağı","curry comb"], …],            // 10 pairs, tr first
 gram:{t:"…", en:"…",
       body:["…"],                               // HTML allowed: <b> <code> <i>
       tbl:[["-An","doer"], …],                  // 4–6 rows
       eg:[["Türkçe sentence","English"], …]},   // 3
 read:{t:"Kaşağı",
       kind:"Uyarlama · Ömer Seyfettin, “Kaşağı” (1918)",  // see attribution
       src:"B1 · adapted and simplified for this course",
       note:"optional — context shown in a dashed card",
       lines:[["Turkish sentence","English"], …],          // 6–10
       gloss:{"tımar etmek":"to groom"}},                  // 4–7 headwords
 drill:[ …5 items… ],
 speak:"one spoken task"}
```

Drill types — exactly five per unit, `validate.js` enforces:

- `{t:"mc", q, a:[…], c:index, why}` — `why` is required and is shown on right
  answers too, so write it as an explanation, not a scolding.
- `{t:"fill", q:"… ___ .", c:"answer", why}` — the prompt must contain `___`.
  Matching is diacritic-folded (`fold()`), so a learner without a Turkish
  keyboard still passes.
- `{t:"order", q, w:[tiles], c:"full sentence"}` — `w.join(" ")` must fold-equal
  `c`. This is the check that breaks most often when editing.

Gloss keys are dictionary headwords. `glossify()` wraps the first literal match
(and tries a capitalised sentence-initial form); unmatched keys still appear in
the Sözlük list under the passage. That's intended — don't "fix" it by changing
headwords to inflected forms.

## Text sourcing — the rule that matters

Every passage declares what it is in `kind:`, and the About screen explains the
three labels to the learner. Keep this honest:

- **Özgün metin** — written for this course.
- **Sadeleştirilmiş / yeniden anlatım** — anonymous folklore (Nasreddin Hoca,
  Keloğlan, Dede Korkut, Karagöz) retold in graded Turkish.
- **Uyarlama** — a public-domain work whose situation and argument are retold in
  graded modern Turkish, *not* quoted. Named author + work + date.

If a passage ever becomes verbatim, its `kind:` must say so and the text must be
checked against a real source — not typed from memory. Turkish public domain is
life + 70: Ömer Seyfettin (d.1920), Ziya Gökalp (1924), Ahmet Rasim (1932),
Mehmet Akif (1936), Hüseyin Rahmi (1944), Sabahattin Ali (1948), Sait Faik
(1954) are clear. Nâzım Hikmet (1963), Tanpınar (1962), Halide Edib (1964),
Refik Halid (1965) are **not** — do not use them.

No verse. Poems and song lyrics stay out of the app entirely, whatever their
copyright status; teach the language around them and point the learner to the
full text elsewhere. The Mevlid unit (c1u7) is the model: it describes the
gathering and the tradition without reproducing Süleyman Çelebi's lines.

## Progress storage — do not break it

`localStorage["turkce-course-v1"]`, one object:

```js
{done:{unitId:{score,of,at,byTest}}, seen:{unitId:{v,g,r,d}},
 place:{u,s}, star:["tr|en"], srs:{"tr|en":{b:box,d:dueDay}},
 tested:{A1:true}, days:["YYYY-MM-DD"], theme, rate}
```

**Unit ids are permanent.** Everything above is keyed to them, so renaming
`b1u3` silently wipes that unit's progress for every existing learner. Add
units, never renumber them. Same for the storage key itself — bump it only with
a migration.

Starred words are the SRS queue: `star` is the membership list, `srs` the
schedule (`STEPS` in days). `toggleStar`/`starAll`/`unstar` must keep the two in
step.

The artifact link and a GitHub Pages copy are different origins, so progress
does not travel between them. That's why About has backup/restore
(`exportBox`/`importBox`) — keep it working.

## Deploying

Two independent targets:

1. **Published artifact** — `dist/index.html` published through Claude. No
   service worker there; the registration call is wrapped and fails silently.
2. **GitHub Pages** — push `dist/index.html`, `sw.js`, `manifest.json` to the
   Pages branch. Bump `APP_VERSION` in `src/app.js` **and** `CACHE` in `sw.js`
   together on every release, then open the app twice to clear the old worker.

## House style

- Interface language is Turkish with English underneath (`Kelimeler · words`).
  Learner-facing prose is plain English, no exclamation marks, no cheerleading.
- Palette is İznik: cobalt `--cobalt`, turquoise `--turk`, bole red `--bole`,
  gold `--gold`, ivory paper. Red is for wrong answers only. Gold is for
  bookmarks, glosses and "test ahead".
- Type: Crimson Pro for Turkish text and display, Karla for interface.
- Everything is `innerHTML` + inline `onclick` calling globals — deliberate, it
  survives a full re-render with no framework. `render()` redraws the whole
  screen; anything that must persist across a redraw lives in `S` or a module
  variable (`VOICE`, `Q`, `RV`, `FC`).
- Voice runs on the device's own `tr-TR` speech synthesis. `stopPlay()` is
  called at the top of `go()` and `home()` — any new navigation path must too,
  or audio keeps playing over the next screen.

## Next task: Üretim (production mode)

The learner's stated gap is speaking, and the thing that worked for them was
Pimsleur — because it forces a sentence out of the mouth *before* the model is
heard. Build that, from the course's own 432 passage lines and 600 words:

1. **Prompt → gap → model.** Show/speak the English, a silent countdown of
   ~4s (a setting), then speak the Turkish and reveal it. Self-grade
   Doğru/Yanlış, feeding the same `STEPS` schedule as the word queue.
2. **Backward buildup** for long sentences: split on clause boundaries and drill
   from the end forward — `bilmiyorum → ne dediğini bilmiyorum → adamın ne
   dediğini bilmiyorum`. This is Turkish-specific: the verb lands last, and
   holding the shape until then is exactly what breaks fluency.
3. **Chunk bank** — ~50 conversational prefabs (`ne demek istiyorsun`,
   `bir dakika müsaade`, `ne yapacağımı bilmiyorum`) as their own drillable set.
4. **Say it three times** — a spaced retell of one unit's `speak:` task on
   day 1, 3 and 7.

No microphone: the learner asked for hear-and-shadow only, and self-grading
keeps it working offline with no permissions.

Then, in order: the verbatim **Kütüphane** (real public-domain texts with an
orijinal/sadeleştirilmiş toggle, sourced and checked) and the **Osmanlıca**
module (Arabic-script Turkish — the learner already reads the script fluently,
so it is orthography and vocabulary, not letters).
