# CLAUDE.md — Türkçe course app

A single-file offline Turkish course, A1→C2. `src/` is the truth; `dist/index.html`
is generated. Never hand-edit `dist/`.

## Workflow

```bash
./build.sh              # concatenate src/ → dist/index.html, parse-check it
node test/validate.js   # data integrity + 266 morphology forms + 827 number forms
node test/sim.js        # headless render of all 342 screens + every runtime path
node test/snap.js       # nothing drawn or generated changed (--write to re-record)
```

Run all four before every commit; they take a second each. `build.sh` already
runs the parse check.

`snap.js` is the one to reach for when moving code rather than changing it. It
hashes every screen and every generated form, so a refactor that preserves
behaviour passes untouched and one that does not names the screen it broke. A
deliberate change fails it too — read the diff, then `node test/snap.js --write`.
`test/dom.js` holds the DOM stub, fake clock and voice stub both tests run on.

They exist because the data files are fragments of one array literal — a stray
comma in `src/data/b2.js` takes down the entire app, and the browser shows a
blank page with the error only in the console.

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
src/data/core.js         const CORE=[…];     // everyday words by topic
src/data/diyalog.js      const DIYALOG=[…];  // branching service encounters
src/data/atasozu.js      const ATASOZU=[…]; const DEYIM=[…];  // sayings
src/app.core.js          state, helpers, voice, the SRS ladder, routing
src/app.lang.js          morphology and the drill generator (pure)
src/app.screens.js       home, level, unit, quiz, words, sözlük, about
src/app.uretim.js        production mode, chunk bank, retell
src/app.dinle.js         dictation and audio-first listening
src/app.tekrar.js        the repetition engine, grammar repetition, the daily plan
src/app.yolda.js         hands-free audio sessions
src/app.hata.js          the mistake book
src/app.benim.js         the learner's own words
src/app.sor.js           question production, wh- and yes/no
src/app.sayilar.js       numbers, times and prices against a clock
src/app.diyalog.js       branching conversation and the repair kit
src/app.atasozu.js       proverbs and idioms, against an exact judge
src/app.boot.js          render() dispatch and start-up
src/shell.foot.html      </script></body></html>
```

The app is fourteen files rather than one because it grew past the point
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

## The crest

`src/icon.svg` is the İznik rosette the app is named by, and the source of
truth for it. The same figure is drawn in two other places, because it has
to be:

- **The favicon** — `src/icon.svg` minified and base64'd into a `data:` URI
  in `shell.head.html`, so the published single file carries its own icon
  with nothing to fetch.
- **`crest(px)`** in `app.core.js` — the home screen mark, filled from
  `--crest-*` rather than baked hex. Those variables sit *outside* the light
  and dark palette blocks on purpose: a crest is a painted object, and
  inverting it in dark mode turns glazed tile into pastel. It looks the same
  in both themes.

Three copies of one drawing is two chances to change one and forget the
others, so `validate.js` checks the favicon byte for byte against the file,
and checks `crest()` on the numbers and colours that set its shape. Change
the icon and you will hear about it. `src/icon-192.png` and `src/icon-512.png`
are rendered from the SVG for `manifest.json`; re-render them if the drawing
changes.

The home hero also carries **تركجه**, Türkçe in the Ottoman script, written
as \u escapes in `app.screens.js` so a right-to-left run does not scramble
the line in an editor.

## Nothing reviews what has not been met

The rule a learner notices first when it is broken. Every review mode draws
**only** on material actually met, and the grain matters:

| helper | true when | governs |
|---|---|---|
| `metWords(id)` | the Kelimeler tab was opened, or the unit is done | the Tekrar word bank |
| `metLines(id)` | the Okuma tab was opened, or the unit is done | `sentenceBank()`, so Üretim and Dinleme — and which passages a cloze may use |
| `metGram(id)` | the Dilbilgisi tab was opened, or the unit is done | `gramBank()`, so Dilbilgisi tekrarı |
| `isMet(id)` | any tab was opened, or the unit is done | whether a plan step exists at all |

This was got wrong twice in one release, and both failures looked identical
from the outside — the app asking for material never seen:

1. **Tekrar had no scope.** It sorted all 600 words by how rarely the app
   mentions them, and the rarest live in the advanced units, so a fresh
   install opened by asking for `abartı`, `akıcı` and `anı` — C2 vocabulary
   — from English. Worst-served is the right ordering only *within* what has
   been met.
2. **The grain was too coarse.** With "met" meaning "opened at all", peeking
   at a B2 unit's word list offered its unread passage's sentences to
   produce, and allowed a cloze for an A1 word to be built from a C1
   passage.

`sentenceBank()` used to fall back to the first three units when nothing was
finished, which is the same bug in a different hat. It now falls back to
units read, and to nothing when nothing has been read. "Tümü" remains an
explicit user choice and still reaches everything.

Empty is a legitimate state, not a failure: a beginner should see one
instruction, not five modes reporting zero. `sim.js` pins all of this,
including the reported symptom, and each guard was confirmed to fail on a
deliberate breakage.

## Progress storage — do not break it

`localStorage["turkce-course-v1"]`, one object:

```js
{done:{unitId:{score,of,at,byTest}}, seen:{unitId:{v,g,r,d}},
 place:{u,s}, star:["tr|en"], srs:{"tr|en":{b:box,d:dueDay}},
 tested:{A1:true}, days:["YYYY-MM-DD"], theme, rate,
 prod:{"s:b1u3#4":{b,d}, "k:12":{b,d}}, retell:{unitId:{n,d}},
 dinle:{"d:b1u3#4":{b,d}, "a:b1u3#4":{b,d}},
 rep:{"kasagi":{b,d,n}}, gram:{"b1u3":{b,d,n}},
 err:{"q:a1u1#0":{m,q,c,a,w,to,at,n}}, mine:[{tr,en,note,at}],
 num:{"duy:3":{b,d}, "oku:saat":{b,d}}, dia:{"bilet":{b,d,n}},
 ata:{"a:damlaya":{b,d}, "d:kafapatlat":{b,d}},
 gap, prompten, pscope, drate, dreplay, ygap, yrate, nmax, ncap, tips}
```

Üretim and Dinleme keys are as permanent as unit ids and for the same
reason: `s:<unitId>#<lineIndex>` for a passage line and `k:<index>` for a
chunk in Üretim; `d:<unitId>#<lineIndex>` for dictation and
`a:<unitId>#<lineIndex>` for audio-first in Dinleme. The two Dinleme
prefixes are deliberately separate from each other and from `s:` — one
sentence can be easy to recognise, harder to transcribe and hardest to
produce, and collapsing those into one box would hide exactly that.
`rep` is keyed by `fold(word)` — "kaşağı" is stored as "kasagi" — and `n`
counts how many times the engine has drilled it, which is added to the
word's natural encounters. `gram` is keyed by unit id (`y:` is stripped
nowhere — the key is the whole string `y:b1u3`) and its `n` chooses which
of the point's worked examples comes next, so it is a rotation cursor
rather than a count. Editing a vocabulary entry's spelling re-points
its schedule, the same hazard as renumbering a unit.
Reordering a unit's `lines` silently re-points every schedule built on it,
so add lines at the end rather than inserting them. `gap`, `prompten`,
`pscope`, `drate`, `dreplay`, `ygap`, `yrate`, `nmax`, `ncap` and `tips` are
settings, not progress — `wipe()` keeps them, like `theme` and `rate`.
`num` is keyed by the *shape* a number has rather than by any number —
`duy:3` is three digits heard, `oku:saat` is a clock face read aloud —
because the numbers are generated and endless while the shapes are six.
`ata` is keyed by a saying's own slug — `a:<id>` for a proverb, `d:<id>`
for an idiom — and **not** by its position. `CHUNKS` keys `k:<index>`
and is therefore append-only for ever; paying for one extra field here
buys a bank that can be reordered, regrouped and interleaved without
re-pointing a single saved box. The slug is still permanent, for the
same reason a unit id is.
`dia` is keyed by scenario id, which is therefore as permanent as a unit
id, and `n` counts completions — it counts nothing else, deliberately; see
Diyalog below. Because `wipe()` keeps
`pscope`, a test that wipes still inherits whatever scope ran before it —
set it explicitly when the default is what is under test. `tips` is the
same hazard and has now bitten once: a step that wiped and expected the
orientation card inherited `tips:false` from an earlier step that had
retired it, and every assertion about the card failed at once.

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

Every release ships to **two** targets, and they do not update together.
Pages republishes itself on push; the artifact only moves when someone
publishes it. Both are on the checklist because the artifact is the copy
holding the learner's real progress.

### Release checklist

1. Bump `APP_VERSION` in `src/app.core.js` **and** `CACHE` in `sw.js`
   together. A stale worker is the one bug that makes a shipped change look
   like it never shipped.
2. `./build.sh` and all four checks.
3. Merge to `main`. Pages deploys itself from there.
4. **Republish the artifact** — see below. Not optional, and not automatic.
5. Open the Pages app twice: the first load installs the new worker, the
   second serves from it.

### 1. GitHub Pages

Automatic. `.github/workflows/pages.yml` builds `src/`, runs all four
checks and publishes `dist/` on every push to `main`. The Pages source is
**"GitHub Actions"**, so this workflow is the only thing that publishes the
site.

It was "Deploy from a branch" until v2.31, and that meant a second builder —
GitHub's own — published the repository root on every push, found no
`index.html` and served a 404; both wrote to one site and the last deploy
won, which was a coin flip. The deploy job still checks for that builder
before publishing. Keep the check: it now costs one API call, and the
failure it catches is silent — a stale 404 served while every check here is
green.

`dist/` is generated and git-ignored, so there is nothing to commit and
nothing to copy by hand. `build.sh` also copies `sw.js`, `manifest.json`
and the three icon files into `dist/`.

### 2. The published artifact

**https://claude.ai/artifact/1md8QekEanvY4HQPsAc7eA** — publish
`dist/index.html` there with the Artifact tool, passing that URL as `url`.

**Always the same URL.** The artifact and Pages are different origins, so
`localStorage` does not travel between them, and this artifact is where the
learner's actual progress lives. Publishing without `url` creates a
*separate* artifact and silently orphans every unit ticked, every starred
word and every SRS box. There is no undo for that.

Publish the icon files alongside the page (`manifest.json`, `icon.svg`,
`icon-192.png`, `icon-512.png`) so the tab icon and "add to home screen"
work there too. Do **not** publish `sw.js`: the artifact has no worker by
design, the registration call is wrapped and fails silently, and a stale
worker there would be unfixable from here.

**To check whether it has drifted** — cheap, and the thing to do first.
Read the artifact with `path: "index.html"`. That saves the live page to a
file instead of loading it into the conversation, and `grep APP_VERSION`
on it says which version is live. Do this rather than reading the artifact
without `path`, which inlines all ~280KB.

**To publish, the full-read gate may apply.** In a conversation that has
not already published this artifact, the tool refuses to overwrite until
the live version has been read *without* `path` — about 2600 lines, in
chunks, because it guards against clobbering content saved from inside the
page. Publishing again later in the same conversation does not re-ask.

Before paying that read, check whether such content could exist at all:
build the source at the commit the artifact was published from and compare
it against the live copy. **The comparison needs the platform wrapper
subtracted first**, or it looks like the whole file changed — the served
page is the published file with

- a single minified `<!doctype html><html><head>…` line (about 536 bytes)
  prepended,
- `\n\n</body></html>` appended,
- and the file's own trailing newline stripped.

A raw `cmp` therefore reports almost every byte as differing, because one
inserted line shifts all of them. Strip the first line and that tail, drop
the trailing newline, and compare the remainder: if it matches the build,
the artifact is pure generated output, nothing needs merging, and the read
is a formality rather than a merge job. That has held at every release so
far — v2.00 → v2.31 → v2.40 → v2.50 → v2.51.

## House style

- Interface language is Turkish with English underneath (`Kelimeler · words`).
  Learner-facing prose is plain English, no exclamation marks, no cheerleading.
- Palette is İznik, at tile-glaze strength: cobalt `--cobalt` #173A6B,
  turquoise `--turk` #1F7D79, bole red `--bole` #9E3327, gold `--gold`
  #AF7F32, ivory paper #EFEADC. Red is for wrong answers only. Gold is for
  bookmarks, glosses, "test ahead" and the ornament.
- Ornament is Ottoman and restrained — illumination framed the text rather
  than crowding it. One gold hairline runs out of each section heading
  (`h2.sec::after`) and stops. Resist adding more.
- Type: Crimson Pro for Turkish text and display, Karla for interface.
- Everything is `innerHTML` + inline `onclick` calling globals — deliberate, it
  survives a full re-render with no framework. `render()` redraws the whole
  screen; anything that must persist across a redraw lives in `S` or a module
  variable (`VOICE`, `Q`, `RV`, `FC`, `PR`).
- Voice runs on the device's own `tr-TR` speech synthesis. `stopPlay()` is
  called at the top of `go()` and `home()` — any new navigation path must too,
  or audio keeps playing over the next screen. `stopPlay()` also clears the
  Üretim countdown, the Dinleme timer and a Yolda sitting, so a timer
  started in any of them dies with the screen; anything else that sets a
  timer needs its own stop called from `stopPlay()` for the same reason.
  Yolda matters most here: it holds the speaker for minutes, so a leak is
  louder there than anywhere else in the app.

## Üretim (production mode)

Built. The learner's gap is speaking, and what worked for them was Pimsleur —
because it forces a sentence out of the mouth *before* the model is heard.
`go('prod')` is the mode, drawn from the course's own 432 passage lines and
307 prefabs:

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
3. **Chunk bank.** `src/data/chunks.js`, 307 conversational prefabs, drilled
   by the same runner with `k:` keys, grouped by what the phrase *does* —
   agreeing, refusing, repairing a conversation that has come apart,
   buying the thing, holding the floor. `dueQueue` takes fresh items in
   array order, so the groups are also the order a learner walks them.

   **The bank is append-only.** `k:<index>` means a chunk's position *is*
   its identity in every saved schedule: insert one at the top and every
   box after it silently re-points to a different phrase, exactly as
   renumbering a unit would. `validate.js` pins the original fifty by
   index and fails by name if any of them moves.

   In Üretim the English *is* the prompt, so no two entries may share one
   — including with a passage line, which is prompted the same way from
   the same screen. `validate.js` enforces that too; it caught one while
   this bank was being written (`bence de` and `ben de öyle düşünüyorum`
   were both glossed "I think so too").

   Growing the bank to 300+ moved the Tekrar distribution barely at all —
   105 words reaching eight encounters became 111, and the median stayed
   at three. That is the honest result and it is not a disappointment:
   prefabs are built from high-frequency function words, while the words
   the course teaches are content words out of literary passages. Chunks
   buy fluency, which is what they are for; they do not raise the
   vocabulary floor, which is what Tekrar motoru is for.
4. **Say it three times.** A unit's `speak:` task retold on day 1, 3 and 7
   (`RETELL_NEXT`), started from the Konuşma card.

New sentences arrive in course order, not shuffled — the mode walks the
material. Reviews come first, oldest due first, and a sitting is `SESSION`
items. No microphone, by request: self-grading is what keeps it offline with
nothing to permit.

## Kurma ve Dönüştürme (generative drills)

Built. The course's own sentences can be memorised; these cannot, because
they are assembled at the moment they are shown. `src/data/lex.js` holds
the vetted drill stems and `LEX` drives the morphology engine in
`src/app.lang.js`.

- **Frames** — `FRAMES` renders a spec `{f, v, n, a, p, t, neg}` into both
  languages. A spec is who, which verb, which tense, which polarity; the
  frame decides the shape (bare verb, object, dative, locative, adjective,
  genitive compound, question).
- **Transformations** — `MOVES` takes a spec, changes one field and
  re-renders, so "put it in the past" always has a correct answer rather
  than an approximation.
- **Scheduling by pattern, not sentence.** The sentences are endless, so
  `S.prod` keys them `g:<frame>:<tense>` and `t:<move>`: what comes back
  is the pattern you were weak at. Sor adds `sor:<frame>` and
  `sor:mi:<tense>` to the same map, for the same reason.

The morphology engine derives what is derivable and the lexicon lists
what is not — see the flags at the top of `lex.js`. `validate.js` holds
266 hand-checked forms and will not let the engine disagree with them,
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

## Sor (question production)

Built. Every other mode in this app answers. Sixty units of reading, 432
sentences to produce, 307 prefabs — and almost none of it is a question. A
learner who can only answer is one a conversation stops dead with, because
the other person eventually runs out of things to ask.

`go('sor')` is the mode and it **adds no runner**: prompt → silence → model
→ self-grade is already the right shape, and `S.prod` is already keyed by
pattern, so Sor is two banks fed into `startProd`. Modes `q` and `e`.

- **Ne sordum** (`sor:<frame>`) — a statement arrives and the learner
  produces the question that would have drawn it out. `sorAsk()` maps each
  frame to its question word: `obj` → Ne / Kimi, `dat` → Nereye, `loc` →
  Nerede, `bare` → Kim, `adj` → nasıl, `gen` → Kimin.
- **Evet/hayır** (`sor:mi:<tense>`) — the same statement as a yes-no
  question. The particle is the whole difficulty: a separate word that
  takes the person onto itself (`geliyor musun`) except in the past, where
  the verb keeps it (`geldin mi`). Keyed by tense because that is the axis
  it varies on.

Four things it has to get right, and three of them were wrong first:

1. **The person moves.** `ASK_P` maps the statement's person to the
   question's: ben → sen, biz → siz, and the other three stand still.
   Nobody asks *Nereye gidiyorum?* to be told *Okula gidiyorum*. This was
   written as `[1,1,2,2,4,5]`, which asks a group *Nereye gidiyor?* to
   elicit *Okula gidiyoruz* — and it survived a hand-check of every frame
   because `SOR_P` only generated three persons, so the broken row was
   never reached. The test now asserts both the table and that every
   person in `SOR_P` actually turns up; without the second half the first
   is a table nobody walks.
2. **Not every dative is a place.** `bakmak` and `başlamak` take one that
   is not, so *Nereye bakıyorsun?* is simply wrong. `sorAskable()` admits
   the `dat` frame only for verbs whose `prep` is "to"; the rest are left
   to the other frames rather than guessed at.
3. **A subject question takes no do-support.** "Who came?", never "Who did
   come?" — the opposite of every other wh-question in English, and what
   an over-correcting learner writes. `whoEN()` is separate from `askEN()`
   for that one reason.
4. **A stranded preposition still has to land.** `beklemek` carries
   `oprep:"for"`, so the question is "Who are you waiting **for**?". The
   same flag fixes the statements: probing for this mode turned up 16 in
   400 generated prompts reading *"I am waiting the bus"*, which had been
   shipping since the generator was built.

Questions are assembled at the moment they are shown, so nothing here can
be memorised. In the mistake book `errPatterns()` reads `sor:` keys out of
`S.prod` alongside `g:`/`t:` and tags each with the mode that drills it —
`PAT_CARDS` renders one card per mode, because a Sor pattern offered to
Dönüştürme would drill something else entirely.

Sor is **not** in the daily plan, like Kurma ve Dönüştürme and for the same
reason: it needs no material met, so it would be available on day one and
push the plan past one instruction. Direct access is in Araçlar.

## Sayılar (numbers at speed)

Built. Turkish numbers are perfectly regular — there is no *quatre-vingt-dix*
here — so knowing them was never the problem. **Latency** is. Someone says a
price and you have a second or two; the conversion that arrives ten seconds
later is no use, and accuracy climbs long before speed does, which is exactly
why a drill that only marks accuracy reports success while the learner still
cannot shop.

So `go('sayilar')` puts a clock on it, and **the clock is part of the mark**:
right but slow does not advance a box. `S.ncap` is the bar, it can be turned
off, and turning it off is the learner's decision rather than the drill's.
That one rule is the whole mode; everything else follows from it.

Two directions, and the first of them matters most:

- **Duy** (`duy:<shape>`) — a number, time or price is said once and the
  learner types the digits. This is the app's **second objective judge**,
  after Dikte, and for the same reason: `altmış` and `yetmiş` sound alike at
  speed, and a learner who heard the wrong one is certain they were right.
  Self-grading cannot see that; a typed 342 either is or is not the answer.
- **Söyle** (`oku:<shape>`) — digits on screen, read aloud before the model
  plays. Self-graded, like everything else that leaves no typed evidence,
  but the clock still runs and still counts.

**Scheduled by shape, not by number.** `S.num` keys `duy:2`, `duy:3`,
`duy:4`, `duy:6`, `duy:saat`, `duy:fiyat` and the same six for `oku:`. The
numbers are generated and endless, so "342" is not a thing to be weak at;
"thousands" is. Same reasoning as the generated drills and Sor.

The engine is split where its purity ends. Everything up to
`/* --- what a sitting is made of --- */` is pure, so `validate.js` lifts it
out of the build exactly as it lifts the morphology engine and holds **827
hand-checked forms** against it — 99 of them written by hand, the rest the
sweep of all 720 hour/minute pairs the live clock made reachable; `sim.js` takes the half that needs `S` — the
judge, the clock, the screens, the book. Neither file holds a copy of the
other's table.

Four things it has to get right:

1. **The dropped bir.** A hundred is `yüz`, never *bir yüz*; a thousand is
   `bin`, never *bir bin* — but a million keeps it, `bir milyon`. Three
   rules, one of them an exception to the other two, and they are the
   commonest error in the whole system.
2. **The clock counts down to the next hour.** 3:35 is `dörde yirmi beş var`,
   twenty-five to *four*, and it wraps: 12:55 is `bire beş var`. The hour
   takes the accusative before `geçiyor` and the dative before `var`, and
   `dört` softens in both (`dördü`, `dörde`) — so the forms come from the
   morphology engine in `app.lang.js` rather than a second table that could
   drift from it.
3. **Each kind reaches its own parser.** A price read by the plain parser
   scores `42,50` as 4250 and fails a right answer. Separators are forgiven
   because a Turkish keyboard writes `1.234` and an English one `1,234` — but
   `1.342` is one thousand three hundred and forty-two and must not read as
   342. A clock face has no am and pm and neither does the spoken Turkish, so
   `15:15` and `3:15` are one answer, while `27:15` is not a time.
4. **The stopwatch starts when the prompt ends.** In the hearing direction
   the clock starts when the voice stops, not when the screen paints, or a
   long number is penalised for its own length. It is armed twice, like a
   Yolda step — the voice's `onend` and an estimate — because a browser that
   drops `onend` would otherwise leave the clock unstarted and every answer
   instant.

### The live clock

By request, and the cheapest thing in the app: `clockHero()` puts the time
now, in words, under the title on the home screen and at the top of the
Sayılar hub — `üçü çeyrek geçiyor`, with `15:15` beneath it. It is read a
few times a day by someone who never decided to practise, which is exactly
the exposure the geçiyor/var construction wants. The digits are the gloss;
no English is needed, because 15:15 says it in every language, and the
12-hour words against the 24-hour digits is the whole lesson.

Three things about it:

- **`render()` arms it, not the screens.** `clockTick()` re-arms where
  `#hclock` exists and stops where it does not, so one call at the end of
  `render()` covers everything. Arming it from the two screens that draw it
  was the first version and left a timeout pending after navigating away —
  harmless in a browser, but `sim.js` drains one timer at a time to count a
  countdown's ticks, and a stray timer made a 3-second gap take four drains.
- **It is deliberately NOT hooked into `stopPlay()`**, which is the standing
  rule for timers and wrong here: `stopPlay()` runs on every speaker tap, so
  the hook would freeze the clock the moment a learner played a word from
  the home screen. Nothing here holds the speaker or paints a screen, so
  there is nothing to reclaim.
- **It pokes the text rather than re-rendering**, like the Üretim countdown,
  because a clock that redrew the home screen every minute would throw away
  whatever was under it. `sim.js` counts paints to prove it — the DOM stub's
  `textContent` does not write back into `innerHTML`, so comparing the paint
  is not enough to tell the difference.

A live clock also means `timeText()` now runs on **all 60 minutes**, where
the generated drills only ever asked for multiples of five. `validate.js`
hand-checks the odd ones and sweeps all 720 hour/minute pairs for shape.
`snap.js` scrubs the two clock elements by id, for the same reason it
scrubs the elapsed-time readings: a run that straddled a minute would
otherwise disagree with itself.

Sayılar is **not** in the daily plan, like Kurma ve Dönüştürme and Sor and
for the same reason: it needs no material met, so it would be available on
day one and push a beginner's plan past one instruction. Araçlar has it.

One test trap worth not repeating: `sim.js` runs *unseeded* on purpose, and
the first version of its assertion searched the raw paint for the generated
answer. The input's own placeholder is a number and the bar carries `3 / 12`,
so a drawn 342 or 12 failed on correct code — an assertion that only usually
holds is worse than none. It reads the visible text now, with the counter
stripped. `snap.js` has the mirror problem: these are the only screens that
print a wall-clock reading, which no seed can reproduce, so `grabx()` blanks
that one reading and fingerprints everything else on the screen.

## Diyalog (branching conversation)

Built. Every other mode here is **one exchange with a known answer**. A
conversation is not: what comes back depends on what you said, and
sometimes you simply do not catch it. `go('diyalog')` is a short errand —
a ticket counter, a market stall, a pharmacy — with someone who talks at
normal speed and does not know you are learning.

**The thesis, and everything follows from it: a repair is not a mistake.**
Every other mode marks you wrong for not knowing. This one marks you wrong
only for *stopping*. Asking someone to repeat themselves is what a
competent speaker does all day, and a mode that penalised it would train
exactly the freeze it exists to cure — because what ends a conversation is
almost never the missing word, it is the pause after it.

So the score is **completion, not correctness**, and `S.dia[id]` counts
completions and nothing else. The first version also kept the fewest
repairs ever taken, as a record to beat. That quietly inverted the mode: a
learner who guessed at a price and got it wrong finished with nought
repairs and a *better* record than one who asked twice and got it right.
The run reports its own repair count as information; nothing keeps score
of it between runs, and `sim.js` asserts the key is absent.

Three more decisions:

- **The other person is heard, never read.** Read them and this is a
  reading exercise with extra steps. There is also deliberately **no free
  replay button** — if hearing it again were one tap away the repair kit
  would be decoration and the reflex would never be built. The only way to
  hear it again is to ask.
- **The kit is three prefabs, and each does something different.** `bir
  daha söyler misiniz` and `daha yavaş lütfen` re-say the beat's `slow`
  line at 0.85× and 0.65×; `affedersiniz, anlamadım` reaches its `easy`
  rephrase. They are chunk-bank phrases, not new material — `validate.js`
  fails if one stops matching `CHUNKS`, because a reworded chunk would
  silently strand the phrase the learner actually drilled.
- **Slots are generated per run.** The skeleton repeats, so without them
  the fourth sitting is recitation — but the price is a different price
  every time and there is no way to answer but to parse it. The numbers
  are the one thing in a conversation a machine can honestly mark, by
  Sayılar's own parsers, and a miss is booked under **Sayılar's own key**:
  a price missed at a counter and one missed at a desk are one weakness,
  which is the mistake book's standing rule. Getting one wrong does not
  end the conversation — in a shop you would hand over the wrong note and
  be corrected, not walk out.

Proper names carry their own inflected forms in the data (`{t:"Bursa",
dat:"Bursa'ya"}`) rather than being derived. The engine could do the vowel
harmony, but a proper name is the last place to let a generated ending
loose in public, so the data lists what is not derivable — the same rule
`lex.js` follows. `validate.js` checks every `{slot.form}` exists on
**every** option of that pick, which is the way that goes wrong.

`validate.js` walks every branch of every scenario: an option pointing
nowhere, a beat nothing reaches, a path with no end. A dead end in a
dialogue tree is not a wrong answer on a screen — it is a learner stuck in
a mode whose whole thesis is that you never get stuck.

### Two flaky assertions, found here and worth not repeating

`sim.js` is unseeded by design, so an assertion that only *usually* holds
fails on correct code now and then — which is worse than not checking at
all, because it teaches you to re-run instead of read. Breaking Diyalog on
purpose shook out two of them, both in tests written earlier in the same
session:

- **Sor**: the check that all seven question words are reachable was a
  count over 400 random draws, and `kimi` needs the `obj` frame *and* a
  person as the object — 400 draws miss it about **one run in fifty**. It
  is checked by construction now, one built spec per question word. Same
  lesson as `ASK_P`: when a table has to be covered, walk it, do not hope
  to land on it.
- **Sayılar**: the check that the heard number is not on screen was a
  substring search, and the number 10 is `on` while the button underneath
  says **K*on*trol et** — so it failed about one run in three hundred.
  It matches whole words now, with the boundary spelled out, because
  Turkish letters are not `\w`.

Both had passed hundreds of runs before anything exposed them. If a test
has to be *lucky* to pass, it will eventually be unlucky in front of
someone who has no idea the code is fine.

Diyalog is **not** in the daily plan, like the other generated modes and
for the same reason. Araçlar has it.

## Atasözleri ve deyimler (the fixed layer)

Built, and built *because* of what blocked Kütüphane. 40 proverbs, 49 idioms. Proverbs and idioms
belong to nobody: there is no author to attribute, no edition to check a
line against and no copyright to clear, so this is the one shelf of
inherited Turkish that could be stocked while the library of named
authors is still waiting on a network policy.

It earns its place in a speaking course on its own merits, though, and
for two reasons:

1. **Fixed means fast.** Everything else the learner produces has to be
   assembled — person, tense, case, the verb last — and assembly is slow
   while the grammar is new. A proverb is one stored object. It is the
   highest fluency per unit of memory in the language, which is exactly
   what a slow speaker needs.
2. **An idiom is non-compositional, and nothing else here tests that.**
   `kafa patlatmak` is not "to burst a head". A learner who knows every
   word in it still fails, and no amount of the course's own vocabulary
   drilling would ever surface the problem.

**The prompt is the situation, not the gloss.** For a proverb, knowing
the words is not the skill — knowing the *moment* is, because one
produced at the wrong moment is worse than silence. So the learner is
given the moment (`s:`) and produces the saying. Reversed, it would drill
recognition, which this app already has plenty of. For an idiom the
prompt is the meaning and the *literal* sense is withheld until after the
answer: shown first it gives the answer away, shown after it is the hook
that makes the phrase stick.

**The judge is exact, and that is the whole mode.** This is the app's
third objective judge, after Dikte and Sayılar's Duy, and it has the
strictest bar of any of the three — stricter than Dilbilgisi's, because
order counts too:

| judge | bar | why |
|---|---|---|
| `dictPass` | 80% of the words, nothing invented | a sentence heard once |
| `gramJudge` | every word, any order | Turkish order is freer than the English prompt |
| `ataJudge` | every word, **in order** | a fixed saying is a fixed string |

`Damlaya damlaya göl olur` with one word wrong is not a proverb slightly
misremembered, it is a sentence nobody says, and a self-graded "close
enough" would wave through precisely what the mode exists to prevent. The
verdict is `dictScore`'s own `clean`. Diacritics are still forgiven, as
everywhere else.

Two things keep that from being unfair. **Variants are listed, not chosen
between** — `işleyen demir pas tutmaz` and `işleyen demir ışıldar` are
both real, `alt:` carries them, the judge scores against whichever the
learner was aiming at, and a right answer names the other. And **the
learner overrules**, exactly as in Dilbilgisi: the variant list is only
as good as whoever wrote it down, and a wording met in the street is not
wrong for being missing here. The overrule restores the box the saying
was on *before* the miss, not box 1.

Not in the daily plan, like Sor, Sayılar and Diyalog and for the same
reason: it needs no material met, so it would be available on day one and
push a beginner's plan past one instruction. Araçlar has it.

### What the checks caught, on their first run

Three of these were found by a guard written minutes earlier, which is
the argument for writing them first.

- **Eight idioms the course already taught.** `göz atmak`, `burnu büyük`,
  `eli açık` and five more are in `POS` and the units already. The bank
  is additive by the same rule `CORE` is — which failed eleven times when
  *that* was written — and the check failed eight times here before a
  word of the runner existed.
- **An example that drifted off the form being drilled.** `dile düşmek`
  was illustrated with *bütün mahallenin diline düştüler*: correct
  Turkish, and the wrong sentence, because the learner is typing `dile`
  and the example shows `diline`. `validate.js` matches each example
  against its idiom by prefix, the way `repSpan()` matches a phrase, and
  named it immediately.
- **An assertion of mine that could not fail.** The hub check was
  `lastPaint.includes("Atasözleri")` — which the page *title* already
  satisfies, so it held no matter what the cards did. The breakage run is
  what exposed it. It asserts the way *in* now (`startAta('a')` and
  `startAta('d')` both present), which is the claim that actually
  matters. Same family as the two flaky assertions under Diyalog: a test
  that cannot fail is worse than no test, because it reports safety.
- **A test that could not distinguish the bug it existed to catch.** The
  overrule check used a never-asked saying — and for `pre === -1`,
  "restore the box it was on and advance" and "reset to box 1" give the
  same answer. It puts the saying on box 3 first now and expects 4.

Twenty-seven guards, each confirmed to fail on a deliberate breakage.

## Dinleme (harder listening)

Built. Dinle and Gölge leave the passage on screen, so they train reading
with a soundtrack; `go('dinle')` takes the text away.

- **Dikte** — a line plays, the learner types it, and `dictScore()` marks it
  word by word. This is the **only judge in the app that is not the
  learner**: everything in Üretim is self-graded, and self-grading cannot
  see a word you never heard. Alignment is a longest common subsequence over
  `fold()`ed tokens, so word order counts, a dropped word shifts nothing
  after it, and a learner without a Turkish keyboard is not punished.
  `DICT_PASS` is 80% with nothing invented — one word forgiven in five.
  `validate.js` holds 14 hand-checked scores plus every one of the 432 lines
  scored against itself, which is what catches the tokeniser dropping
  something a learner would be marked down for.
- **Ses önce** — the same lines with nothing on screen: listen, decide
  whether it landed, then reveal. Self-graded, because comprehension leaves
  no typed evidence, but the decision comes before the reveal. `sim.js`
  asserts the Turkish is absent from the paint until then.

Speeds now pass 1×: `SPEEDS` in `app.core.js` is two rows, the study pace
and the training pace, up to 1.75× on a passage, and `S.drate` runs Dinleme
up to 1.5×. 1× is where a TTS voice sits naturally, so everything below it
is a crutch. `sim.js` reads the rate off the utterance rather than the
setting — the stub records `u.rate` for exactly that.

Replays are capped (`S.dreplay`, one to unlimited) because a sentence is
said to you once. Replaying must **not** re-render: the input box holds what
has been typed, so `dinlePlay()` pokes the counter directly and captures the
text *before* the limit check, or a refused replay would silently empty the
box.

One honest limit, and it is in the About text too: this is the device's TTS,
not a person. No reduction, no accent, no overlapping turns. A clean 1.5×
here is a floor, not a finish.

## Tekrar motoru (the repetition engine)

Built. Measured across every Turkish string the app can show, the median
taught word is met **three** times, 182 of the 600 exactly once, and only
105 reach eight — the rough floor for durable retention. Most of the
course's own vocabulary was decoration.

`go('tekrar')` adds no material. It counts what the app already exposes
and drills whatever the app will not bring back by itself, worst served
first **among the words the learner has met** — see the rule above; without
that scope it opens on C2 vocabulary. The hub shows the distribution, which
is the one number the engine exists to move.

Two question shapes, both retrieval rather than recognition:

- **cloze**, where the word appears in a passage line: the line returns with
  it blanked and the answer is the form the sentence uses, so `aile` is
  asked as `ailem`. 341 words get one.
- **recall**, where it does not: English prompt, type the Turkish. The
  once-only words land here, having no sentence to blank.

Four things the counting has to get right, each of which was wrong first:

1. **Alternatives are not phrases.** `ad / isim` is two words for one
   thing and `ağabey (abi)` a word and its colloquial form. Folded naively
   they become "ad isim" and "agabey abi", which occur nowhere — so those
   entries scored zero and got no context. `vocabForms()` splits them; the
   entry takes the best-served alternative, and `tkCheck()` accepts any.
2. **Short stems must not prefix-match.** `ad` prefixes `adam` and `ada`.
   `REP_PREFIX_MIN` is 4: below that, only exact matches count. Verbs
   undercount regardless, since `gitmek` is not a prefix of `gidiyorum`.
   Both errors run the same way — fewer encounters claimed than met — which
   is the safe direction for a floor.
3. **Index whole written words, not `fold()` fragments.** `fold()` turns
   `Kapadokya'ya` into "kapadokya ya", and indexing those halves made a
   dative suffix on a place name look like the particle `ya`, a taught
   word. `repTokens()` keeps each written word whole, so the index and
   `repSpan()` tokenise identically and cannot disagree about where a word
   occurs.
4. **A phrase inflects on its last word.** `karşı kıyı` appears as
   `Karşı kıyının`, so `repSpan()` matches a run by prefix exactly as the
   counter does. Matching them differently is what recorded contexts the
   cloze builder could not then blank.

A line that uses the word twice is rejected as a context: blanking one
occurrence would leave the answer in the prompt. `sim.js` asserts all of
the above, and every one was confirmed to fail on a deliberate breakage.

## Dilbilgisi tekrarı (grammar repetition)

Built. The vocabulary problem one level up. Each unit carries one grammar
point, and `u.gram` renders in exactly one place — the unit's Dilbilgisi
tab. Sixty points, read once each, and the course never asks again.

`go('gram')` brings the point back on `STEPS` and tests it by
**production**: English in, Turkish typed. Recognising what `-DIK` does is
not the skill.

- **The point is scheduled, not the sentence.** `S.gram` is keyed `y:<unitId>`
  and `n` counts sittings, so the point's three or four worked `eg`
  examples rotate. Keyed by sentence, 181 sentences would be memorised in a
  fortnight; keyed by pattern, "the passive" keeps coming back with a
  different sentence carrying it. `metGram(id)` is the `g` tab or the unit
  done — the same grain as `metWords`/`metLines`, and for the same reason.
- **The judge is order-free.** `gramJudge()` marks with `dictScore()` — so
  the line shows *which* word's ending went wrong, and diacritics are
  forgiven — but the verdict is the bag of folded tokens. Turkish word
  order is freer than these English prompts pin down: *"I had him write the
  letter"* is as truly `Ona mektubu yazdırdım` as `Mektubu ona yazdırdım`,
  and **162 of the 181 targets** would be failed by an order-sensitive
  judge for a single swap.
- **Every word, though.** Not Dikte's four in five. The targets are four
  words at the median and the form is the whole question, so forgiving one
  word forgives the point — measured: an 80% bar passes **46 of the 181**
  with a word missing. `sim.js` pins all three invariants across every
  target: a dropped word never passes, an invented word never passes, a
  reordering always does.
- **The learner overrules.** A word-level judge can mark words; it cannot
  mark Turkish. Where the English leaves the choice open — a synonym, a
  tense English does not distinguish — `grAccept()` takes the answer as
  right. It restores the box the point was on *before* the miss (`GR.pre`),
  not box 1, and must not advance `n` a second time or the rotation skips
  an example. Everything in Üretim is self-graded for the same reason; this
  is deliberately one tap rather than the default.

In the plan it sits **second**, with the reviews: it decays the way the
words do, and unlike Dinle and Söyle it asks for a form rather than a
sentence already met. `avail` withholds it until a grammar point has been
read, so day one is still one instruction.

## Yolda (hands-free sessions)

Built, by request: something that can be practised while driving or
working, with nothing to touch.

Üretim already prompts, waits and plays the model, so the obvious move
was a setting on it. That does not work. Every Üretim item ends in a
Doğru/Yanlış tap, and a tap is the one thing a driver has not got — so
`go('yolda')` is a separate mode rather than a switch, and the difference
is not the audio but what happens to the grading.

Three things make it Pimsleur rather than a playlist:

1. **The English is always spoken.** In Üretim voicing the prompt is an
   option (`prompten`); here it is the only input channel, so the setting
   is ignored and the English always plays — in the device's English
   voice, never the `tr-TR` one.
2. **The graduated interval is inside the sitting.** The part of Pimsleur
   that does the work is not the pause, it is that an item returns while
   it is still half remembered. `YOL_SPACING` is `[3,8,20]` slots, and a
   five-minute sitting therefore covers about a dozen phrases four times
   each rather than rushing past fifty once.
3. **Grading is deferred, not dropped.** Self-grading is what keeps this
   app offline and microphone-free, and it cannot happen at sixty miles
   an hour. The sitting runs untouched; the marking happens once at the
   end, with everything taken as right and the ones that got away tapped.
   **Nothing is written while it runs**, so abandoning a sitting costs
   nothing rather than pushing a sentence you fumbled out to sixteen
   days. The back arrow mid-sitting ends it and offers the marking — it
   does not bin the work — while `home()` leaves and writes nothing.

It adds **no new progress keys**. Items are the same `s:` and `k:`
prefixes Üretim uses and grade onto the same ladder, which is right: a
sentence produced in the car and one produced at a desk are the same
sentence. `ygap` and `yrate` are settings, so `wipe()` keeps them.

**Nothing is touched, so nothing can be rescued by touching.** Every step
is armed twice — the voice's own `onend` and a watchdog — and a token
makes sure exactly one of them wins. Both halves are pinned by `sim.js`:
a browser that never fires `onend` still walks the sitting (fewer items,
never a hang), and one that fires it twice covers exactly as many as one
that fires it once. Getting that wrong skips items silently, which is
invisible from the driver's seat.

Two things went wrong first and are worth not repeating:

- **`yolClear()` cleared the deadline as well as the step timer**, so the
  first step cancelled the clock that ends the sitting and 5 and 10
  minutes both ran the whole playlist. The deadline is not a step and
  lives in `cid`, cleared only by `yolStop`/`yolFinish`.
- **`YOL_SLOTS` was too small.** A slot is five to nine seconds depending
  on the gap setting, so ten minutes at the shortest gap needs about 128
  of them; at 90 the sitting ended early and quietly. It is 140, and
  `sim.js` fails if a sitting ends on the playlist rather than the clock.

Sentences are scoped to units read, as everywhere else. The prefabs are
not, deliberately: they belong to no unit, Üretim has always offered them
from day one, and they are the right thing to be saying in a car before
any passage has been opened. So a fresh install gets a sitting of
prefabs, the hub says so, and sentences join in as passages are read.

One honest limit, in the About text too: **a phone stops speaking when
its screen locks**, on every platform this runs on. `yolWake()` asks for a
screen wake lock, which is all the app can do about it; the learner still
needs the phone unlocked and in a cradle rather than in a pocket.

## Hata defteri (the mistake book)

Built. Seven places in this app can tell a learner they were wrong, and
until now every one of them threw the finding away the moment the screen
changed. The quiz kept `{score,of,at}`; Üretim, Dinleme, Tekrar,
Dilbilgisi and Yolda kept a box number. So the `why` written for all 300
drills was shown once and discarded, and a learner could fail the same
passive construction eleven times with nothing anywhere noticing.

**It is not another queue, and that is the main design decision.** Every
mode already brings a wrong answer back the same day — that is what box
0 means — so a "drill your mistakes" runner would re-ask what is already
coming, and would have been the obvious thing to build. The gap is not
repetition. It is **the record**: what was asked, what you said, what was
right, why, and what is catching you *repeatedly*. Nothing in the app
could answer the last one.

`S.err` is therefore keyed by the item rather than appended as a log. A
log grows and says nothing; a map says "four times". Keys reuse each
mode's own, so one item missed in two modes is one entry — a sentence
fumbled in the car and at a desk is one weakness:

```
q:<unitId>#<i>   a unit drill        p:<i>        a placement question
s:<unitId>#<i>   a passage line      k:<index>    a prefab
d: / a:          dictation, audio-first — deliberately NOT merged
r:<fold(word)>   a vocabulary item   y:<unitId>   a grammar point
```

`d:` and `a:` stay apart for the same reason they are apart in `S.dinle`:
a sentence can be easy to recognise and hard to transcribe, and merging
them would hide exactly that. `sim.js` pins it.

Three things it has to get right:

1. **Eviction ranks on the count, not the date.** `ERR_MAX` is 400, and
   ranking by age was written first and is exactly backwards: it drops
   the nine-time mistake to keep four hundred one-off slips from this
   morning, throwing away the only question the feature exists to
   answer. Least-repeated goes first; age breaks a tie.
2. **An overruled mark is not a mistake.** `grAccept()` withdraws the
   entry `grCheck()` just wrote, or the book records something the
   learner did not get wrong. It uses `errForget2()`, which saves without
   re-rendering — the button version re-renders, and a grading path must
   not.
3. **Yolda writes nothing until the marking is confirmed**, like its own
   schedule, and records only what was actually marked missed.

The weak-spot read is mostly the book counting itself by mode, plus one
thing that needs no new bookkeeping: `S.prod` already keys the generated
drills by *pattern* (`g:<frame>:<tense>`, `t:<move>`), so a pattern
sitting on box 0 is one currently being got wrong. `errPatterns()` reads
it straight out and names it by frame and tense rather than by the
storage key — both branches are exercised, since a transformation and a
built sentence are read back by different code.

Clearing an entry or the whole book changes no schedule, which the
screen says and `sim.js` checks. `S.err` is progress, not a setting:
`wipe()` clears it and a backup carries it.

## Kendi kelimelerim (your own words)

Built. The only way into the review queue used to be a star beside a word
the course had already chosen, so a word met on a shop sign or in a
subtitle could not get in and the app was a closed box.

**It adds no queue.** `S.star` and `S.srs` already are the spaced queue,
`dueList()` already feeds Sözlüğüm's review and the flashcards, and the
daily plan's Tekrar step already counts them — so a word added here is
starred like any other and turns up in Bugün the next day with no
machinery at all. `S.mine` exists only because `S.star` holds bare
`"tr|en"` strings: unstar a word and it would otherwise vanish, and the
dictionary would have nothing to list.

**It deliberately does not feed Tekrar motoru.** That engine ranks words
by how often the app's own corpus mentions them and drills the worst
served; a word the learner brought has zero mentions by definition, so
every one would sit permanently at the top and bury the course
vocabulary the engine exists to rescue. The screen and About both say so.

Four things it has to get right:

1. **Clean pasted text at the door.** User input arrives by paste, and a
   soft hyphen or zero-width space inside a word looks perfect on screen
   while breaking every match it touches — `validate.js` checks the
   course data for exactly this, and `cleanWord()` is the same rule
   applied where the learner types.
2. **A word the course already teaches gets starred, not copied.** A
   second entry with the learner's own gloss would be worse than the
   unit's, and would sit beside it in Sözlük for ever.
3. **An edit carries the schedule.** The star key is built from the
   spelling, so re-keying a typo fix would quietly drop a word to box 0
   after a month of reviews — `mineRekey()` moves the box across and
   keeps `star` and `srs` in step, which is the standing rule for those
   two.
4. **A message must survive the render that follows it.** Every path that
   sets one ends in `render()`, which replaces the element it was just
   poked into, so the first version showed the learner nothing at all.
   `MMSG` is rendered rather than poked. But a *rejection* must still not
   re-render, or it wipes what is in the input boxes — the same trap the
   Dinleme replay had.

In Sözlük they are a third source, badged **Benim**. A course row opens
its unit and a core row filters to its topic; one of the learner's own
has neither, so it opens the list it lives in — without that branch the
row rendered `dictTopic('undefined')`, which `sim.js` caught.

## Bugün (the daily plan)

The app had six ways in and no opinion about which to use. `planCard()` is
the opinion, first thing on the home screen, above the progress road —
action before orientation.

Order is everything perishable first, new material last: reviews decay on a
schedule and a unit does not. Tekrar, Dilbilgisi, Dinle, Söyle, then Devam
or Yeni, with Anlat inserted before the last step when a retell is due.

**The list folds; the instruction does not.** The card opens collapsed to
one line — `5 adım · steps left · ~24 dk` — with the start button still
outside the fold, so the first step is one tap whether or not the list is
open. What folds away is five rows of detail answering a question the
button already answers. Two rules keep it honest:

- **One instruction is not a list**, so a single-step plan does not fold
  at all. Day one still shows its one row and the sentence explaining why
  the review steps are not there yet — the whole point of `avail`.
- **`PLANOPEN` is a module variable, not part of `S`.** Same rule as the
  rest of the plan: a fold that survived a restart would be a preference
  the learner never set. It opens closed every time.

**Nothing is stored.** A step is done when its own queue is empty, which is
self-correcting — finish the work and the tick appears, come back tomorrow
and it clears itself. A per-day completion flag would need its own state and
could disagree with the queues.
A zero count means one of two different things, and a completion tick for
both is a lie: either the queue is cleared, or the queue does not exist yet
because nothing has been met. Steps carry `avail`, and unavailable ones are
left out of the card entirely — a beginner sees one instruction rather than
three ticked rows for work never done.

Two "N waiting" cards used to sit lower on the home screen. They duplicated
the plan's own Tekrar and Söyle steps, and one counted the standalone
chunks as due, so on day one it advertised work while the plan correctly
said there was none. One place answers "what now", and it is the plan;
direct access stays in Araçlar.

**Nasıl çalışır** is the plain-English orientation card — above the plan
while nothing has been met, below it afterwards. It retires itself once A2
is complete, `Gizle` ends it early, and About offers it back. It exists
because the interface is Turkish-labelled and a beginner has no way to know
that an empty Tekrar is by design rather than broken.

It folds on the same rule that decides where it sits: **open while it is
instruction, folded once it is reference.** On day one it is the only
thing telling a learner what any of this is, so it is open; once a single
unit has been opened they have been told, and it collapses to its own
line. `TIPSOPEN` starts `null` meaning "whatever that rule says" and only
pins a value once the learner has actually tapped it — and like the
plan's fold it is a module variable, never stored. `Gizle` is different
and *is* stored: retiring the card is a setting, folding it is not.

The card also lost its "start the first unit" button. The plan sits
directly below it pointing at the same unit, and two identical primary
actions on one screen is the wall in miniature.


The last step absorbed the old resume card: mid-unit it returns to the exact
section, and it falls back to the first unfinished unit otherwise. It must
check `isDone` — a bookmark survives completion, and following it blindly
pinned the plan to a unit already ticked.

## Ana ekran (the landing page, and the two doors)

The home screen used to carry, in one column: the hero, a five-paragraph
orientation card, the plan, the progress road, three stats, **six level
cards** and **fifteen tool rows**, each under its own heading. Every one
of those was reachable. Reachable is not the same as findable — past a
certain length a list stops reading as choices and starts reading as
texture, and the plan, the one thing that answers "what now", sat at the
top of a wall the eye slides off.

So the landing page is now four things: the hero with the live clock,
**Bugün**, the progress road, and two doors.

| door | behind it |
|---|---|
| **Dersler** | the six levels and their sixty units, the placement test, the stats |
| **Araçlar** | everything else, grouped: Konuşma · Dinleme · Tekrar · Kelimeler · Kurs |

Four decisions worth keeping:

- **Two doors rather than four.** Grouping the tools by skill was the
  obvious move and it was the wrong one: it puts a second decision in
  front of a learner who has not made the first. The course is one thing
  and everything else is optional, which is exactly two categories, and
  the Araçlar page carries the finer grouping as headed sections where
  it costs nothing.
- **The line under a door is not a count of work waiting.** Two "N
  waiting" cards lived on this screen once and were removed because they
  duplicated the plan's own steps and one advertised work on day one
  that the plan correctly said did not exist. The plan owns "what now";
  a door only says what is behind it. `Dersler` shows progress, which is
  orientation rather than a claim about work.
- **The long orientation moved to its own screen.** `Nasıl çalışır` is
  the right text and a beginner needs it — nothing else explains that an
  empty Tekrar is correct rather than broken — but it is reading, not a
  control, and it was the largest block of prose on the first screen a
  learner sees. The card on the landing page is two sentences and a way
  through to the rest.
- **`back()` retraces the menu.** Every screen used to fall through to
  `home()`, which was right when home *was* the menu. A level now
  returns to Dersler, a tool to Araçlar, and the flashcards to Sözlüğüm,
  or the doors would feel like a detour rather than a place. `HUBV` is
  the list; a new tool screen needs adding to it.

`.block` is the style, and it is drawn from the same palette as
everything else: a large target, a Crimson Pro title with the English
underneath in Karla, and one gold hairline down the leading edge — the
same single stroke that runs out of `h2.sec`, turned ninety degrees.
Resist adding a second.

### Assertions that could not fail

Found by the breakage runs rather than by reading, and all the same
mistake as the one recorded under Atasözleri. Three in two sessions is a
pattern, so: **when a guard is written, break it on purpose before
believing it.**

- `store["turkce-course-v1"]` to read what was saved — but `store` is a
  **`Map`**, so bracket access is always `undefined` and every assertion
  built on it passed whatever the code did. `store.get()` is the
  accessor, and the pre-existing storage test had it right all along.
  The check also asserts the key exists now, so an empty read cannot
  pass quietly.
- `!lastPaint.includes("go('sayilar')")` as "no tool rows on the landing
  page" — but the **live clock is a button to Sayılar** and is meant to
  be, so the assertion failed on correct code. It checks for the row's
  own class now, which is the actual claim.
- `lastPaint.includes("Tekrar")` as "Araçlar is grouped" — satisfied by
  the row *Tekrar motoru*, so renaming every heading left it green. It
  asserts the heading markup and the heading count now.

Twenty-one guards on the navigation, each confirmed to fail on a
deliberate breakage.

## Sözlük (the word list)

`go('dict')` shows every word in the app — the 576 the units teach and the
316 everyday ones in `src/data/core.js` — filterable by source and class,
searchable on either language (diacritic-folded, like the drills), sorted
A→Z in Turkish collation or by level and topic. A row hears the word and
stars it into the review queue; a course row opens its unit, a core row
filters to its topic.

`CORE` is grouped by topic rather than ranked by frequency, and each
topic keeps its own verbs: `binmek` sits beside `otobüs`, not in a list
of verbs. It is **additive by definition** — `validate.js` fails on a core
word the course already teaches, which it did eleven times while this was
being written, and on invisible characters, because a soft hyphen inside
`kiralamak` looks perfect on screen and breaks every match it touches.

Classification: anything ending `-mak`/`-mek` is a verb, `src/data/pos.js`
carries the rest, and what is left defaults to noun for a single word and
expression for a multiword entry. Multiword entries need listing more than
single ones — `hafta sonu` is a noun, `burnu büyük` an adjective and
`ara sıra` an adverb, and the space says none of that. `validate.js` fails
on a POS key the course does not teach, so a typo cannot quietly file a
word under the wrong heading for ever.

## Next, in order

Ordered by what moves the learner toward conversation, which is not the same
as what is most interesting to build.

1. **Kütüphane** — verbatim public-domain texts with an
   orijinal/sadeleştirilmiş toggle. **Needs network access**, which is an
   environment setting rather than anything in this repo. The sandbox's
   egress proxy answers `CONNECT tunnel failed, 403` for
   `tr.wikisource.org` and the WebFetch tool returns `EGRESS_BLOCKED` for
   the same host — it is not specially banned, it is simply not on the
   allowlist, which exempts npm, PyPI, crates.io, the Go proxy and GitHub
   and tunnels everything else. Allow `tr.wikisource.org` (its API is on
   the same host, so that covers both reading pages and pulling clean
   wikitext), and `tr.wikipedia.org` for author death dates, since the
   whole public-domain question is life + 70. The proxy config is baked at
   container start, so a policy change does not reach a session already
   running: it needs a **fresh** one. First thing to do in that session is
   re-run the curl and confirm a 200 rather than assuming.

   **Typing the texts from memory was considered and rejected, and the
   reason is worth keeping.** The test case was the opening of Sabahattin
   Ali's *Kürk Mantolu Madonna* — d.1948, so safely public domain, and the
   most quoted sentence in modern Turkish prose, which makes it the best
   case there is. It has three forks in it: `üzerimde` or `bende`, a comma
   before `belki` or not, and how the edition prints `tesiri`. A page of
   *Kaşağı* would have forty. The whole point of the toggle is that the
   learner believes the left-hand column is the real object, and 97% right
   is not 97% of a sentence — it is a wrong sentence with a named author
   on it, and the learner cannot see which 3% to distrust. Even the
   proverbs drift: `işleyen demir pas tutmaz` against `ışıldar`.

   **Survey before building.** Turkish Wikisource is much thinner than the
   English one and may hold three usable transcriptions or thirty. List
   what is actually there first, then decide what the shelf is. Record the
   page and its **revision id** in `src:` for every passage, so "checked
   against a real source" still means something in a year. The no-verse
   rule is a house rule rather than a copyright one and holds whatever
   Wikisource turns out to have.

   The shelf that was proposed as the fallback — **atasözleri ve
   deyimler** — has since been **built** on its own merits rather than as
   a consolation; see its section above. It does not replace this item.
   Kütüphane is verbatim authored prose with an orijinal toggle, which is
   a different thing and still wants the network.
2. **Osmanlıca** — Arabic-script Turkish. The learner already reads the
   script, so it is orthography and vocabulary rather than letters.
   Interesting, and orthogonal to speaking.

Marginal, and recorded so they are not proposed again as if new: a strict
spelling mode with a Turkish character bar (`fold()` forgives ı ş ğ ç ö ü
everywhere, which is deliberate — a keyboard the learner does not have is
not a language failure), and a progress-over-time chart (`S.days` already
has the data; it measures attendance, not Turkish).

No app on its own reliably produces a conversational speaker; every
programme that does has a human in the loop. The work above makes tutor
hours efficient rather than replacing them.
