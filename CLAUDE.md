# CLAUDE.md — Türkçe course app

A single-file offline Turkish course, A1→C2. `src/` is the truth; `dist/index.html`
is generated. Never hand-edit `dist/`.

## Workflow

```bash
./build.sh              # concatenate src/ → dist/index.html, parse-check it
node test/validate.js   # data integrity + 266 hand-checked Turkish forms
node test/sim.js        # headless render of all 322 screens + quiz/voice/SRS/üretim paths
node test/snap.js       # nothing drawn or generated changed (--write to re-record)
```

Run all four before every commit; they take a second each. `build.sh` already
runs the parse check.

`snap.js` is the one to reach for when moving code rather than changing it. It
hashes every screen and every generated form, so a refactor that preserves
behaviour passes untouched and one that does not names the screen it broke. A
deliberate change fails it too — read the diff, then `node test/snap.js --write`.
`test/dom.js` holds the DOM stub, fake clock and voice stub both tests run on. They exist because the data files are fragments of
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
src/data/chunks.js       const CHUNKS=[…];   // üretim prefabs
src/data/lex.js          const LEX=[…];      // tagged drill stems
src/data/pos.js          const POS={…};      // word classes for the list
src/app.core.js          state, helpers, voice, the SRS ladder, routing
src/app.lang.js          morphology and the drill generator (pure)
src/app.screens.js       home, level, unit, quiz, words, sözlük, about
src/app.uretim.js        production mode, chunk bank, retell
src/app.boot.js          render() dispatch and start-up
src/shell.foot.html      </script></body></html>
```

The app is five files rather than one because it grew past the point
where one was navigable. Order still matters: `app.boot.js` runs code, so
it goes last, and everything it names must already be declared. Within a
file, sections are separated by `/* ===== name ===== */` banners —
`validate.js` slices the build on those banners to test the language
engine on its own, so renaming one means updating that test.

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
 tested:{A1:true}, days:["YYYY-MM-DD"], theme, rate,
 prod:{"s:b1u3#4":{b,d}, "k:12":{b,d}}, retell:{unitId:{n,d}},
 gap, prompten, pscope}
```

Üretim keys are as permanent as unit ids and for the same reason:
`s:<unitId>#<lineIndex>` for a passage line, `k:<index>` for a chunk.
Reordering a unit's `lines` silently re-points every schedule built on it,
so add lines at the end rather than inserting them. `gap`, `prompten` and
`pscope` are settings, not progress — `wipe()` keeps them, like `theme`
and `rate`.

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
2. **GitHub Pages** — automatic. `.github/workflows/pages.yml` builds `src/`,
   runs all three checks and publishes `dist/` on every push to `main`; the
   Pages source is set to "GitHub Actions", not a branch. `dist/` is
   generated and git-ignored, so there is nothing to commit and nothing to
   copy by hand. Still bump `APP_VERSION` in `src/app.js` **and** `CACHE` in
   `sw.js` together on every release, then open the app twice to clear the
   old worker — the workflow does not do this for you, and a stale worker is
   the one bug that makes a shipped change look like it never shipped.

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
  variable (`VOICE`, `Q`, `RV`, `FC`, `PR`).
- Voice runs on the device's own `tr-TR` speech synthesis. `stopPlay()` is
  called at the top of `go()` and `home()` — any new navigation path must too,
  or audio keeps playing over the next screen. `stopPlay()` also clears the
  Üretim countdown, so a timer started there dies with the screen; anything
  else that sets a timer belongs in `prodStop()` for the same reason.

## Üretim (production mode)

Built. The learner's gap is speaking, and what worked for them was Pimsleur —
because it forces a sentence out of the mouth *before* the model is heard.
`go('prod')` is the mode, drawn from the course's own 432 passage lines and
50 prefabs:

1. **Prompt → gap → model.** The English shows (and is spoken if `prompten`
   is on, in the device's English voice — never the `tr-TR` one). A silent
   countdown of `gap` seconds runs on `#pcount`, then the Turkish is spoken
   and revealed. Self-graded Doğru/Yanlış onto `STEPS`, the word queue's own
   ladder: right moves a box out, wrong comes back today.
2. **Backward buildup.** `clauseSplit()` cuts a sentence into tails that grow
   leftwards — `bilmiyorum → ne dediğini bilmiyorum → adamın ne dediğini
   bilmiyorum`. Boundaries are commas, clause-opening words, and the converb
   and participle endings that close a subordinate clause; the suffix test
   runs on `fold()`ed text, so `CONVERB` is written in folded spelling.
   Postpositions (`için`, `sonra`, `gibi`) break *after*, never before, and
   nothing may open on a clitic (`de`, `da`, `mi`) — both would produce a
   piece that cannot stand on its own. A sentence marked wrong is offered
   this way automatically. `sim.js` checks every one of the 432 lines: each
   piece must be a true tail, each step longer than the last.
3. **Chunk bank.** `src/data/chunks.js`, 50 conversational prefabs, drilled
   by the same runner with `k:` keys.
4. **Say it three times.** A unit's `speak:` task retold on day 1, 3 and 7
   (`RETELL_NEXT`), started from the Konuşma card.

New sentences arrive in course order, not shuffled — the mode walks the
material. Reviews come first, oldest due first, and a sitting is `SESSION`
items. No microphone, by request: self-grading is what keeps it offline with
nothing to permit.

## Kurma ve Dönüştürme (generative drills)

Built. The course's own sentences can be memorised; these cannot, because
they are assembled at the moment they are shown. `src/data/lex.js` holds
the vetted drill stems and `LEX` drives a morphology engine in `app.js`.

- **Frames** — `FRAMES` renders a spec `{f, v, n, a, p, t, neg}` into both
  languages. A spec is who, which verb, which tense, which polarity; the
  frame decides the shape (bare verb, object, dative, locative, adjective,
  genitive compound, question).
- **Transformations** — `MOVES` takes a spec, changes one field and
  re-renders, so "put it in the past" always has a correct answer rather
  than an approximation.
- **Scheduling by pattern, not sentence.** The sentences are endless, so
  `S.prod` keys them `g:<frame>:<tense>` and `t:<move>`: what comes back
  is the pattern you were weak at.

The morphology engine derives what is derivable and the lexicon lists
what is not — see the flags at the top of `lex.js`. `validate.js` holds
250 hand-checked forms and will not let the engine disagree with them,
checks that every collocation names a noun that exists, and fails when a
word is added without the flags its forms need. `sim.js` sweeps 600
generated prompts for empty output, leaked `undefined`, double spaces,
English that Turkish grammar does not license (*"I am liking"*), and the
Turkish capital İ.

Three things the lexicon must carry or the drills go wrong in ways tests
cannot catch: `e` (English forms — no more derivable than the Turkish),
`obj`/`dat`/`loc`/`n` (collocations, or the generator writes *"I am
drinking the school"*), and `needsObj`/`stative` (English cannot say
*"Did we give?"* or *"I am liking"*).

## Sözlük (the word list)

`go('dict')` shows all 576 distinct words the units teach, filterable by
class, searchable on either language (diacritic-folded, like the drills),
sorted A→Z in Turkish collation or by level. A row hears the word, stars
it into the review queue, or opens the unit it came from.

Classification: anything ending `-mak`/`-mek` is a verb, `src/data/pos.js`
carries the rest, and what is left defaults to noun for a single word and
expression for a multiword entry. Multiword entries need listing more than
single ones — `hafta sonu` is a noun, `burnu büyük` an adjective and
`ara sıra` an adverb, and the space says none of that. `validate.js` fails
on a POS key the course does not teach, so a typo cannot quietly file a
word under the wrong heading for ever.

## Next, in order

The verbatim **Kütüphane** (real public-domain texts with an
orijinal/sadeleştirilmiş toggle, sourced and checked), then the **Osmanlıca**
module (Arabic-script Turkish — the learner already reads the script fluently,
so it is orthography and vocabulary, not letters).
