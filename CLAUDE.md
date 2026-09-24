# CLAUDE.md — Türkçe course app

A single-file offline Turkish course, A1→C2. `src/` is the truth; `dist/index.html`
is generated. Never hand-edit `dist/`.

## Workflow

```bash
./build.sh              # concatenate src/ → dist/index.html, parse-check it
node test/validate.js   # data integrity + 266 morphology forms + 872 number forms + 46 contrast pairs + mistake naming
node test/sim.js        # headless render of all 346 screens + every runtime path
node test/snap.js       # nothing drawn or generated changed (--write to re-record)
node kids/test/validate.js   # the children's app: data and contrast
node kids/test/sim.js        # the children's app, every lesson played through
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
src/data/sik.js          const SIK=[…];      // commonest words the units never teach
src/data/diyalog.js      const DIYALOG=[…];  // branching service encounters
src/data/atasozu.js      const ATASOZU=[…]; const DEYIM=[…];  // sayings
src/data/konusma.js      const SPOKEN={…};   // how a unit's Turkish is said
src/data/baslarken.js    const BASLA=[…];    // six lessons before unit one
src/data/resim.js        const RESIM={…};    // a picture for A1 words, for the guided lesson
src/shared/text.js       esc(), fold()                 — shared with kids/
src/shared/voice.js      VOICE, ttsOK, voiceState, say — shared with kids/
src/shared/srs.js        STEPS, bump, dueItems …       — shared with kids/
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
src/app.sik.js           the frequency layer: ten common words a day
src/app.baslarken.js     the lessons before unit one
src/app.uyku.js          before sleep: today's material, quietly
src/app.adim.js          Derse başla: a unit taught one screen at a time
src/app.ilerleme.js      İlerleme: the state of every mode, on one page
src/app.boot.js          render() dispatch and start-up
src/shell.foot.html      </script></body></html>
```

The app is eighteen files rather than one because it grew past the point
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
- `{t:"order", q, w:[tiles], c:"full sentence", why}` — `w.join(" ")` must
  fold-equal `c`. This is the check that breaks most often when editing.

**Every drill carries a `why`, and it explains.** It is the only
explanation the learner gets, shown after a wrong answer and a right one
alike, and the mistake book keeps it. It used to be a median of 33
characters — often just the answer again ("Evler.") — and the sixty order
drills had none at all, so a learner who built a sentence wrong was shown
the right one and nothing about why. All 300 were rewritten to name the
rule and then apply it to the item: *"The plural is -lar or -ler by
two-way harmony. The last vowel of pencere is e, a front vowel, so it
takes -ler: pencereler."* `validate.js` requires one on all five types, at
least 50 characters, and no exclamation mark. Rewriting them turned up a
wrong answer key — c1u8's *Kar kapıda* headline was marked with the
second option when the first is right — which is the argument for
reading every item rather than bulk-editing them.

Gloss keys are dictionary headwords. `glossify()` wraps the first literal match
(and tries a capitalised sentence-initial form); unmatched keys still appear in
the Sözlük list under the passage. That's intended — don't "fix" it by changing
headwords to inflected forms.

**a1u1's Dilbilgisi tab used to open with two named rules back to back** —
two-way harmony, then four-way harmony, both stated abstractly before a
single worked example — because the instinct behind it was reasonable:
vowel harmony really is foundational and really does want teaching early.
Foundational is not the same as first, though, and unit one's own vocab,
reading and drill never once called on two-way harmony; only a1u2's
plural does. So it now leads with the rule the unit's own copula table
actually needs (concrete example first — *öğrenci* + "I am" is
*öğrenciyim* — the abstract statement after), and the rule the unit does
not need yet is named, defined and explicitly deferred rather than cut:
`two-way harmony` still has to mean something the moment a1u2 says
"by two-way harmony" with no re-introduction, so the term stays, just not
demanding mastery in the same breath as the one lesson one actually
requires. The general rule for any unit's `gram.body`: worked example
before the named rule, and nothing stated as urgent that the unit's own
`tbl`/`eg`/`drill` never asks the learner to use.

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

The hero is the crest, the wordmark and the live clock — three things.
It used to carry two more: the Ottoman spelling of the app's own name
(`.osm`) under the wordmark, and a tagline (`.tag`) under that. Five
stacked elements before anything actionable was the thing the landing
page was being simplified away from, and a hero is the one place this
app had stopped applying its own rule about ornament being restrained.

Both styles were deleted along with their markup rather than left as
dead CSS, so re-adding either line alone would paint unstyled, and
`sim.js` asserts the hero positively — crest, wordmark, clock — and
fails on an Arabic run or a `.tag` in the home paint.

Nothing was lost that is said nowhere else: the bar above still reads
`Türkçe · A1 → C2`, and on day one the orientation card sits open
directly below saying what the app is in plain English. The Ottoman
script is not gone from the plan either — **Osmanlıca** is still on the
roadmap as a mode, where it is the subject rather than an ornament.

## Türkçe Macera (the children's app)

Built, by request: a version for **11–13 year olds starting Turkish from
English**, in `kids/`, built by `kids/build.sh` (which `./build.sh` runs)
into `dist/kids/index.html`, so Pages serves it at `/kids/`. The
published artifact is **https://claude.ai/artifact/MxVvyJxDVpsf1Hkxm4Z4vy**
— a separate link from the course's, and it must stay the same link for
the same reason: a child's progress lives there.

**It is a sibling, not a copy.** The course is built round adult reading
passages, long English explanations and typed answers; none of that suits
a twelve-year-old, so the content, screens and games are its own. What is
shared is what should never differ between the two: `src/shared/` holds
`fold()` and `esc()`, the voice (`say`, `voiceState`) and the review
ladder (`STEPS`, `bump`, `dueItems`). They were moved out of
`app.core.js` for this, a pure move that `snap.js` passed unchanged, and
both builds concatenate them, so a fix there reaches both apps.

- **Content** — `kids/src/data/units.js`: twelve units (greetings,
  numbers, colours, animals, family, food, school, body, clothes,
  weather, hobbies, town), each ten words with an emoji as the picture,
  four phrases, one grammar tip in plain English and a short comic with a
  recurring cast (Ece, Can, and Pamuk, an Istanbul street cat). Unit ids
  `k1`–`k12` are permanent and word positions are append-only: review
  keys are `<unitId>#<index>`.
- **Games** — three lessons a unit (Tanış: meet the words, hear and pick;
  Oyna: match pairs, spell with letter tiles whose decoys are the letters
  beginners confuse, ı/i ş/s ç/c; Konuş: the comic read aloud, build a
  sentence, say it out loud, type a word), then **Kupa**, a ten-question
  trophy, first try only, typing and spelling included. A lesson sends a
  missed round back at the end until it is right and scores only first
  tries (1–3 stars); the trophy does not, because it is a test.
- **The path opens in order**, as the course's does: the next unit when
  this one's trophy is won, and the trophy can be tried straight away,
  which is the test-out. Nothing reached is locked again.
- **Review** — lesson one seeds its words onto the shared ladder (right
  first time: tomorrow; missed: today); a unit won by trophy alone counts
  its words as met. The daily review draws on met words at `KNEW_DAY` (10)
  new a day, the same rule as the course's `NEW_DAY`.
- **Motivation** — XP (10 a first-try answer, 5 a second), animal ranks
  (kitten, fox, eagle, lion, dragon), a day streak, stars and trophies,
  and a small chime made with Web Audio, no files. Praise is in Turkish
  (Harika, Aferin, Süper), which teaches it. The course's house rule
  against exclamation marks does not apply here; everything else does.
- **Separate storage** — `localStorage["turkce-kids-v1"]`
  `{name,u:{kN:{l:[s,s,s],cup:{at,score}}},srs,xp,days,theme,snd}`. It
  never reads or writes the course's key, and `sim.js` checks that.
  Backup and restore live on the grown-ups page.

`kids/test/validate.js` holds the data (ids pinned, ten words, unique
emoji, English and Turkish per unit, lower-case Turkish letters only, at
least four spellable words and two multi-word phrases per unit, a known
speaker on every comic line) and WCAG AA on every text pair in both
themes. `kids/test/sim.js` runs on the course's `test/dom.js` and plays
every lesson and trophy of all twelve units through the real engine,
right and wrong. Fourteen deliberate breakages each turned it red; three
did not at first and all three were the test's fault — a daily-cap check
on a bank too small to reach the cap, a breakage that removed one of the
comic's two guards, and no check that leaving mid-comic silences it. The
comic check also found a real crash, `talkPlay()` on a round that was not
a comic, now guarded.

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
{done:{unitId:{score,of,at,byTest,first}}, seen:{unitId:{v,g,r,d,at}},
 place:{u,s}, star:["tr|en"], srs:{"tr|en":{b:box,d:dueDay}},
 tested:{A1:true}, days:["YYYY-MM-DD"], theme, rate,
 prod:{"s:b1u3#4":{b,d}, "k:12":{b,d}}, retell:{unitId:{n,d}},
 dinle:{"d:b1u3#4":{b,d}, "a:b1u3#4":{b,d}},
 rep:{"kasagi":{b,d,n}}, gram:{"b1u3":{b,d,n}},
 err:{"q:a1u1#0":{m,q,c,a,w,to,at,n}}, mine:[{tr,en,note,at}],
 num:{"duy:3":{b,d}, "oku:saat":{b,d}}, dia:{"bilet":{b,d,n}},
 ata:{"a:damlaya":{b,d}, "d:kafapatlat":{b,d}},
 sik:{"zaten":{d}, "ve":{d,k:1}}, basla:{"alfabe":{at,byTest}},
 gap, prompten, pscope, drate, dreplay, ygap, yrate, nmax, ncap, tips, en}
```

`done[id].first` is the day a unit was first passed by its own quiz, set
once and kept on every later pass; a level test writes none, and records
from before v3.67 have none. It is what the one-new-unit-a-day pace counts
(see Bugün).

Every schedule record `bump()` creates — `rep`, `prod`, `dinle`, `gram`,
`num`, `ata`, `dia` — carries `f`, the day it was first practised, which
is what the daily allowance of new items counts (see Bugün). Records from
before v3.63 have none and count as old.

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
`pscope`, `drate`, `dreplay`, `ygap`, `yrate`, `nmax`, `ncap`, `tips` and `en`
(`{st,on}` since v3.64, or a legacy boolean; see İngilizcesi) are settings, not progress — `wipe()` keeps them, like `theme` and `rate`.
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

**A save that fails is said, on every screen, until one works.** `save()`
used to swallow every error, so a browser refusing storage (blocked site
data, some private windows) let a learner work for weeks toward nothing.
Now it sets `SAVEFAIL`, and `saveWarn()` puts a strip *inside* the sticky
top bar — both `bar()` and home's own — because a warning that scrolls
away or sits on one screen would be missed, and every tap under it is
being lost. Its button goes to the backup, which reads `S` from memory,
so the session's work can still be rescued. A later save that goes
through clears it. A browser that accepts the write and discards it at
the end of a private session cannot be told apart from one that keeps
it, so the strip claims only what it can see.

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
  turquoise `--turk` #1C716E, bole red `--bole` #9E3327, gold `--gold`
  #AF7F32, ivory paper #EFEADC. Red is for wrong answers only. Gold is for
  bookmarks, glosses, "test ahead", help, and the ornament.
- **Every text colour is held to WCAG AA in both themes**, and `validate.js`
  enforces it: it parses the tokens out of the build and checks every pair
  the stylesheet actually paints text in (the `PAIRS` table — add a row
  when a rule paints a new colour on a new ground). Eleven pairs failed
  when this was written, and none were subtle once measured: the clock
  digits at 2.6:1, every dark-mode primary button white-on-pale-blue at
  2.3:1, and the glossed word in the dark-mode reading tooltip at 1.6:1.
  So: `--faint` is darker than it looks like it should be (#606977), and
  `--turk` was nudged from #1F7D79 to #1C716E (the crest keeps the old
  glaze through `--crest-petal`). `--gold` stays the glaze because it is
  ornament; gold that must be *read* is `--gold-ink`, gold on the inverse
  tooltip is `--gold-inv`, and text on a filled accent is `--on-accent`,
  which flips to dark in dark mode because the accents there are pale.
  Literal white text fails the check. The dark palette is written twice
  (media query and toggle); the check fails if the copies drift.
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
  Üretim countdown, the Dinleme timer, a Yolda sitting and an Uyumadan
  önce sitting, so a timer
  started in any of them dies with the screen; anything else that sets a
  timer needs its own stop called from `stopPlay()` for the same reason.
  Yolda matters most here: it holds the speaker for minutes, so a leak is
  louder there than anywhere else in the app.
- **The voice has three states, and the middle one is the dangerous one.**
  `voiceState()` is `ok`, `none` (no speech engine), `notr` (speech but no
  Turkish voice) or `unknown` (list not loaded yet). `notr` does not fall
  silent — the browser reads Turkish in its default voice, so a beginner
  hears *Merhaba* in an English accent from lesson one. It is common:
  Windows without the Turkish speech pack, desktop Chrome's own voices.
  `voiceNote()` says so on the Kelimeler and Okuma tabs and on the five
  audio hubs, and About names the voice in use and how to add one on each
  platform. It still speaks in `notr` — a rough guide, and the learner has
  been told. `unknown` says nothing rather than warn a device that is
  fine; the note sits in `#vnote` so a late `voiceschanged` fills it in
  place, never re-renders (that would empty a half-typed dictation). About
  used to claim a missing Turkish voice meant silence; it means the wrong
  accent, which is worse, and is why this exists.

## İngilizcesi (English under the Turkish)

Built, by request: until A2 is complete every instruction carries its
English underneath, small and faint — *Başla* over *start*, *Kontrol et*
over *check* — and an **EN** button in the top bar of every screen turns
it off or back on. The interface was already Turkish-first with English
beside some labels, but not all: *Başla*, *Devam*, *Kontrol et*, the tab
names and every section heading were Turkish only, which is exactly
what a learner on day one cannot read.

It is **one table and one pass**, not markup at every call site.
Every full paint goes through `paint(h)` in `app.core.js`, which runs
`enUnder()` — so a new screen must paint with `paint(h)`, never
`app().innerHTML=` directly (eight end-of-session screens did, and were
the ones left in Turkish only). The pass touches only the first run of
text inside an interface element (a button, `h2.sec`, `.lead`, `.qn`,
`.sub`, a pill, `.tiny`, `.empty`, `.big`) and only when that text is a
key: `EN_UI` for bare Turkish labels, `EN_RULES` for ones with a number
in them, and `EN_INLINE` for labels already written `Türkçe · english`,
whose English half is moved underneath. Course content never matches
because it is never looked up, and `EN_SKIP` names the content classes
(`opt`, `tile`, `vtr`, `gw`, …) the pass must never enter: a glossed
answer option would give the answer away with the toggle on.

Three decisions:

- **The English half has to be listed, not guessed.** After a `·` the
  text is sometimes Turkish (*bu oturum*), a count, or content (a
  vocabulary gloss), and guessing "looks English" is how a vocabulary
  answer would vanish when the toggle is off. `sim.js` scans every paint
  and fails on an interface label with an English half `EN_INLINE` does
  not list, so each new one is decided. The scan covers only elements
  that never hold content — a sub line or a word pill can carry a
  generated word, and a check that depends on what a run drew is the
  flaky kind this file has been bitten by twice.
- **The toggle is a class, not a redraw.** The English always goes into
  the page and `.noen` on `<html>` hides it, so switching redraws
  nothing and cannot empty a half-typed answer. A poke that fills an
  element outside `paint()` (the late voice note) runs `enUnder()`
  itself.
- **The default follows the level; a choice wins.** `S.en` is unset
  until the learner taps EN; unset means on until A2 is complete —
  `lvPct("A2")`, the line `tipsOn()` already uses, and which the A2
  level test fills. It is a setting, so `wipe()` keeps it.

An element that already carries its English — a tab's `<i>`, a title's
`<small>` — is left alone rather than given a second copy; the unit
tabs' `<i>` English now sits in a `.gl` span so the toggle reaches it
too. Nine deliberate breakages — the level default, the content skip,
a redraw on toggle, `wipe()` dropping the setting, the second copy,
`paint()` skipping the pass, the late voice note, an unlisted English
half, and the pass escaping the interface elements — each turned
`sim.js` red.

### Less English as you go (the stages)

By request, the way a school moves its classroom language over: labels
first, then instructions, then (still to come) the explanations. The
stage is the level being worked in, `curLv()`: the level of the unit
after the furthest one passed. So passing the A2 test puts a learner in
B1 at once, and dipping back into an old unit changes nothing.

| stage | when | labels | instructions |
|---|---|---|---|
| 0 | A1–A2 | Turkish, English under | English |
| 1 | B1 | Turkish only | Turkish, English under |
| 2 | B2 and up | Turkish only | Turkish only |

Grammar explanations, every drill's `why`, the feedback notes (spoken
form, sen/siz, the pronoun, Neden?), About and Nasıl çalışır stay
English at every stage for now. Explanations in Turkish at C1–C2 are the
planned next step, and want a native speaker's pass first.

- **Instructions are written twice, at the call site.** `tx(en, tr)`
  puts both into the page as `.t-en` and `.t-tr` spans, and three
  classes on `<html>` decide which show (`ins-en`, `ins-both`,
  `ins-tr`). It is a call-site helper, not a pass like `enUnder()`,
  because instruction prose carries counts and markup a lookup table
  cannot key. Plain text (a `confirm()`, a message poked in with
  `textContent`, a placeholder) cannot hold two spans, so `txt(en, tr)`
  picks one string by stage. `navRow()` takes the Turkish as a fifth
  argument, and `bar()` takes a Turkish subtitle as a fourth. The bar
  has room for one line, so it shows English at stage 0 and Turkish
  after.
- **The EN button is "show me the English now"**, and a choice is
  stored with its stage: `S.en = {st, on}`. It lapses when the stage
  changes, so turning the English on at A2 does not hold it on through
  C2. A choice saved before the stages existed is a plain boolean and
  counts as a stage-0 choice. Off is Turkish only everywhere, stage 0
  included.
- **The Turkish is short and repeated on purpose.** Classroom language
  is learnable because the same few instructions come back every day
  (*Dinle*, *Yaz*, *Boşluğu doldur*, *Bundan sonra gittikçe daha geç
  gelecek*), so reuse a sentence that already exists before writing a
  new one. The instructions use *sen*, as the labels already did.
- **English inside a feedback box is `--ink2`, not `--faint`.**
  `validate.js` measured `--faint` at 4.0–4.5:1 on the right- and
  wrong-answer grounds, so it failed AA there. The pairs are in `PAIRS`.

`sim.js` scans every paint for a `tx()` pair whose Turkish half is
empty, identical to the English, or still English (the half a copy and
paste leaves behind). It found one on its first run: the plan's
next-unit step, whose halves were the same unit name. It also checks
the stage rule, including passing the A2 test straight into B1, a
choice lapsing at a stage change and the legacy boolean. About 300
instruction strings were translated. All the Turkish here is the
author's, so it is on the native-speaker list with Başlarken.

## Üretim (production mode)

Built. The learner's gap is speaking, and what worked for them was Pimsleur —
because it forces a sentence out of the mouth *before* the model is heard.
`go('prod')` is the mode, drawn from the course's own 432 passage lines and
331 prefabs:

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
3. **Chunk bank.** `src/data/chunks.js`, 331 conversational prefabs, drilled
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
sentences to produce, 331 prefabs — and almost none of it is a question. A
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
out of the build exactly as it lifts the morphology engine and holds **872
hand-checked forms** against it (17 of them `timeAt()`, the *at*-a-time
form Diyalog needed — see there) — 99 of the time-and-price ones written by
hand, the rest the sweep of all 720 hour/minute pairs the live clock made
reachable, plus 28 for the date line under it: 19 sweeping every month and
every weekday at least once, and 9 hand-typed pinning word order and the
digit form's zero-padding. `sim.js` takes the half that needs `S` — the
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

A second line under that does the same thing for the calendar: `yirmi üç
Eylül Çarşamba`, with `23.09.2026` beneath. It exists because no unit
teaches the months — a1u6 drills weekdays in passing, but Ocak through
Aralık appear nowhere else in the course — so passive exposure on a screen
opened several times a day is the only teaching they get. `MONTHS` is
indexed as `Date.getMonth()` returns it and `WEEKDAYS` as `Date.getDay()`
returns it (0 = Pazar, not the Turkish week's Pazartesi), which keeps both
arrays boring: no `+1`/`-7` arithmetic sits near a wall-clock read, which
is exactly the kind of arithmetic that is easy to get backwards and hard
to notice once it is. The day itself is read as a cardinal number — `23
Eylül` is `yirmi üç Eylül`, never an ordinal — so `dateWords()` reuses
`numText()` rather than a table of its own.

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

The date line rides the same `clockTick()` rather than a second timer — a
date changes on the day, not the minute, but arming a whole second timeout
for one extra element would be the wrong kind of caution, and `sim.js`
pins that arming the clock never leaves more than one timer behind however
many times it fires.

A live clock also means `timeText()` now runs on **all 60 minutes**, where
the generated drills only ever asked for multiples of five. `validate.js`
hand-checks the odd ones and sweeps all 720 hour/minute pairs for shape.
The date gets the equivalent, proportioned to where its risk actually is:
`dateWords()`/`dateDigits()` do nothing but concatenate two array lookups
and a number, so `validate.js` sweeps every entry of `MONTHS` and every
entry of `WEEKDAYS` at least once rather than hand-checking hundreds of
combinations that would only be re-testing `numText()`. `sim.js` cross-
checks the digits against a fresh `new Date()` built independently of
`nowYMD()`, the same reason the time check reads `new Date().getHours()`
directly rather than trusting `nowHM()` to grade itself.
`snap.js` scrubs all four clock elements by id, for the same reason it
scrubs the elapsed-time readings: a run that straddled a minute, or a day,
would otherwise disagree with itself.

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

**The other person can surprise you, and the data is held to it.** The
first six scenarios were thinner than "branching" claimed once measured:
of fifteen choices, eleven led to the same next line, three scenarios had
exactly one route, and every reply was fixed by the learner's own choice —
so once the tree was known nothing could go off-script, which is the one
thing the mode exists to practise. Now a destination may be a **list**,
resolved at random by `diaTo()` when the conversation gets there: the
card machine is down, the tomatoes ran out, the bigger size is out of
stock, the notary stamp is missing. `validate.js` fails any scenario with
fewer than three routes or no list, and `sim.js` plays **every route** of
every scenario through the real runner — 132 of them across ten scenarios,
A1 to C1 — forcing each random branch by pinning `Math.random` rather than
hoping to land on it. An end reached politely ("no thanks, I'll look
elsewhere") is a completion; only walking out is not.

Measuring the routes turned up two content bugs that had shipped:
`pazar` billed one kilo as two (every route reached `Hepsi {hepsi}`, the
doubled price), and `randevu` proposed meetings in the telling-the-time
form — *Üçü çeyrek geçiyor, uygun mu?* is "it is quarter past three,
suitable?". Proposing a time needs *geçe*/*kala* and the locative, so
`timeAt()` now sits beside `timeText()` in the number engine, hand-checked
in `validate.js`, and a time slot offers both as `{t}` and `{t.at}`. Slots
also gained an hour range (breakfast is not at three), a `step` for round
prices (a rent is *yirmi üç bin*), and `later` for a time an hour or two
after another, because two independent draws answered "could we make it
later?" with an earlier time half the time.

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
  reordering always does. One exception, made in `grCheck()` rather than
  the judge: a subject pronoun the ending already carries may come or go
  (`pronounSlack()`, see Başka türlü below).
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

## Uyumadan önce (before sleep)

Built, by request, after the learner asked whether sleep-learning videos
work. They do not, in the way they claim: nothing new is learned while
asleep, and audio playing all night can fragment the sleep that
consolidates what was studied. What holds up is narrower: sleep keeps
what was studied in the hours before it, and replaying that material
quietly helps a little. `go('uyku')` is built to that and no further.

- **Only today's material.** `uyBank()` takes units opened or passed in
  the last `UY_HOURS` (16) hours — a window rather than a calendar day, so
  studying at eleven and listening at half past twelve is still "today"
  — at the grain the reviews use: words once the list was opened, lines
  once the passage was read, examples once the grammar was. Plus the
  common words added today and an intro lesson *passed* today (not one
  only tested out of). With nothing today it falls back to the last
  unit opened and says so. Nothing new is ever introduced.
  `markSeen()` now stamps `S.seen[id].at` for this; nothing else reads it.
- **Turkish only, each item twice, slow (`UY_RATE`), getting quieter**
  from `UY_VOL[0]` to `UY_VOL[1]` across the sitting, through a volume
  argument `say()` gained for it.
- **It stops by itself, in silence**, after five or ten minutes. Yolda
  announces its end because a driver is not looking; this one must not,
  because the listener is falling asleep. The running screen is a
  full-screen dim overlay in both themes.
- **It writes nothing and has no settings.** No progress key, no box,
  nothing marked. The hub says plainly what it can and cannot do.

The engine is Yolda's shape: every step armed twice (onend and a
watchdog) with a token, the deadline only raising a flag, a wake lock
for the sitting, and `uyStop()` called from `stopPlay()` so leaving the
screen silences it. `sim.js` plays a whole sitting on the fake clock and
checks every item is said exactly twice, in order, in Turkish at the
set rate, cycling round, ending on the material rather than on an
announcement, and leaving `S` byte-for-byte unchanged. The fade is
tested by winding `UY.t0` back, because the fake clock drives timers
but not `Date.now()`. Fourteen deliberate breakages each turned it red;
two did not at first, and both were the test's fault: a breakage that
did not match the source, and a de-duplication check on a bank with
nothing duplicated in it, which now includes a lesson that shares
*merhaba* with unit one.

Not in the daily plan: it is optional and only makes sense at night.
Araçlar has it under Dinleme, drawn faded (Şimdilik boş) when there is nothing to play.

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

## Teşhis (naming a mistake)

Built. A typed answer marked wrong used to show only the right answer,
so a learner who wrote *okulde* for *okulda* saw the correct form and had
to work out for themselves which of Turkish's handful of rules they had
broken. `diagnose(typed, correct)` in `app.lang.js` names it, under
**Neden? · why** in the feedback card, in Tekrar motoru (`diagAny`, which
tries each listed alternative) and in Dilbilgisi tekrarı
(`diagnoseLine`, which pairs each missed word with the typed word
sharing its start, up to two). The mistake book keeps the sentence.

It names six things, each only when that one rule turns what was typed
into what was right:

| `k` | rule | e.g. |
|---|---|---|
| `uyum` | vowel harmony, two- or four-way | okulde → okulda |
| `dt` | d/t after a voiceless consonant (fıstıkçı şahap) | gitdim → gittim |
| `yumusama` | p ç t k softening before a vowel, and its absence before a consonant | kitapı → kitabı |
| `kaynastirma` | the buffer y/n/s between two vowels, and one where none belongs | arabaı → arabayı |
| `hal` | dative, locative and ablative confused, or the case left off | okulda → okula |
| `ek` | the word right and its ending missing | aile → ailem |

**Silence is the default, and the conservatism is the design.** A wrong
diagnosis looks exactly like a right one to a learner, and is worse than
none: it teaches a rule where there was no rule. So every branch has to
account for *all* the difference, not some of it. Harmony is named only
when harmony predicts the correct vowel — *saat → saatte* breaks the rule,
so *saatta* gets nothing rather than a rule it does not obey. Two
mistakes in one word get nothing. And the accusative and the possessive
are **never** named: *evi* is both "the house" and "his house", so a
missing *-i* cannot honestly be called either.

Diacritic-only slips never reach it — `fold()` has already accepted them.
It is pure and lives in the language engine, so `validate.js` lifts it
out with the rest and holds a hand-checked table of both halves: every
rule firing where it should, and the misses it must leave alone (an
unrelated word, a missed accusative, a loanword, a negation). It also runs
every written word of every passage against itself, which must name
nothing. `sim.js` checks the box appears on a rule-explainable miss in
both modes, never on a right answer or an unrelated miss, disappears when
the learner overrules the mark, and reaches the book. Thirteen guards
across the explanations and this, each confirmed to fail on a deliberate
breakage.

## Konuşma dili (how Turkish is said)

Built, because the units teach written Turkish and people do not talk
the way they write. The spoken forms were taught once, as a reading
point, in C1 unit 9, forty-eight units in, while a learner hears
*gidicem* for *gideceğim* in their first week. Four pieces, one rule:
**the spoken form is added beside the written one, never instead of
it**, because the written form is the one the learner will read.

1. **Konuşurken cards.** `src/data/konusma.js` keys notes by unit id,
   and `spokenCard()` draws them under the unit's grammar, dashed like a
   passage note. Twenty-one notes across fourteen A1–A2 units: the
   reductions (*bi, bişey, burda, dakka, buyrun, gidicem, geliyom,
   napıyorsun, di mi*), the short answer (*Nereye gidiyorsun? — Eve.*),
   the dropped pronoun, *yok* for no, and how strangers are addressed.
   Each carries `r`, **herkes** (with anyone) or **samimi** (between
   friends), because a learner who says *napcan* to a clerk has learned
   the form and not the language.
2. **The judge accepts a spoken spelling.** `spokenToward(typed, answer)`
   in `app.lang.js` turns spoken words back into the answer's written
   words, and Tekrar motoru and Dilbilgisi tekrarı take the result as
   right when it equals the answer, then say so under **Konuşma dili ·
   spoken form** and show the written spelling. Dikte does not: the
   voice said the written form, and transcribing it is the exercise. The
   Atasözleri judge does not either: a fixed saying is a fixed string.
   It is a short word list (`SP_WORDS`) plus two rules regular enough to
   trust: the future (*-AcAğIm → -IcAm*, and *-mAyAcAğIm → -mIcAm*); and
   the dropped r of
   *-Iyor*, which must follow a vowel so *yorgun* is left alone. Nothing
   in it can make a wrong word right: a spoken form only ever becomes a
   word the answer already has, and the callers require equality.
   Vowel stems were left out at first, because *okuyacağım* is said
   several ways and a guess is worse than a miss; the native speaker's
   pass supplied the forms (*okuycam*, *bekliycem* / *beklicem*,
   *söyliycem* / *söylicem*, *yiycem*), and they are accepted when typed
   but never offered, since even he wrote them as approximations.
3. **A casual group in the chunk bank**, appended as the append-only
   rule requires: *naber, aynen, hadi ya, ne alaka, hayırdır, eyvallah,
   bi dakka, abi bakar mısın*, twenty-three in all, each English prompt
   naming who it is for.
4. **Diyalog talks casually first.** In the A1 and A2 errands the other
   person says *Buyrun, ne verelim?*, *Başka bişey?*, *Yürüyerek beş
   dakka*, and the first repair, `slow`, is now the careful standard
   line, so asking again is also where the written form is heard. B1
   and up keep their register: a hotel desk and a residence office are
   formal, and that is part of what they teach.

The forms are the ones said all over Turkey and in ordinary Istanbul
speech; regional ones stay in C2 unit 7, where they are the subject.
`validate.js` checks every note (a real unit, a register, a note that
explains, no exclamation marks) and runs every note marked `re` through
the judge, so the card can never show a form the marking then refuses.
It holds a hand-checked table of forms that must be accepted and near
misses that must not (another tense, another person, *okuyucam*,
*kaçak*). `sim.js` checks the card on a unit with notes and its absence
on one without, and the acceptance and its message in both modes.
Nineteen guards, each confirmed to fail on a deliberate breakage.

This is the part of the app where the author's Turkish is least safe
to trust unchecked, so it had a native speaker's pass (v3.61): all 95
items were sent as one review page, and 90 came back natural as written.
The changes were two glosses (*abi, bakar mısın* is "excuse me,
brother", not "mate"), a subtler note on *abi / abla / hocam / efendim*,
*pardon* before *bakar mısınız* — which is less usual alone — and the
vowel-stem futures above. New spoken material should go the same way
before it ships.

### Sen ya da siz (the other you)

Reported by the learner: a Tekrar gap-fill built from *Memnun oldum.
Nasılsın?* — "Pleased to meet you. How are you?" — refused *Nasılsınız*,
which is at least as likely to be said to someone just met. English
cannot say which you, so where the sentence does not decide it the other
one is right. `sizToward()` in `app.lang.js` turns a typed *-sInIz* into
the answer's *-sIn* or the reverse, only toward a word the answer has,
in Tekrar motoru, Dilbilgisi tekrarı and a unit's gap-fill, and the
feedback says why under **Sen · siz**.

It is narrow on purpose. The same ending on a bare verb is the
third-person command — *Kolay gelsin*, *Geçmiş olsun* — where *gelsiniz*
is wrong, so the swap applies only after what makes *-sIn* certainly
"you": *-yor*, the future, *-mAlI*, *-mIş*, the question particle and a
short list of words said of a person (`SIZ_BASE`, `SIZ_WORDS`). The
aorist is left out because *gelirsin* and *otursun* cannot be told apart
in folded text. Nothing moves when the sentence has a *sen* or *siz* word
or the English names the register ("informal"). `validate.js` holds both
halves, including every command it must refuse, and checks that every
*-sIn* word the course writes swaps back to itself; `sim.js` replays the
reported case in all three places. Ten deliberate breakages each turned
a test red.

### Başka türlü (the other ways to say it)

By request: whatever form a learner types, short or long, spoken or
written, the others are shown under **Başka türlü** in Tekrar motoru and
Dilbilgisi tekrarı, right answer or wrong, and never the form they typed.

- **Spoken ↔ written.** `spokenOf()` renders a sentence as said, using
  only the forms that are safe with anyone (the future, *bi*, *bişey*,
  *burda*, *nerde*, *dakka*, *buyrun*, *napıyorsun*, *n'oldu*). The
  between-friends ones (*geliyom*, *di mi*, *napcan*) are accepted when
  typed but never offered. The second person keeps its *-sIn* when offered
  (*kalıcaksın*, not *kalıcan*) for the same reason. Offered up to B2 only:
  C1 and C2 teach the written register on purpose.
- **Short ↔ long.** A subject pronoun the ending already carries is
  optional, so *Adım Deniz* and *Benim adım Deniz* are both right, and
  Dilbilgisi used to fail the first. `pronounSlack()` allows exactly one
  pronoun more or fewer than the model and nothing else different;
  `pronAgrees()` is the one gate on which pronouns may move: *ben* only
  when the verb ends in *-m*, *benim* only when a later word carries the
  *-m*, and so on. It rejects *o* and *onlar*, which are also "that" and
  "those"; a pronoun before *de* or *ki* (*Ben de iyiyim*); a genitive
  before a postposition (*senin için*); the last word; and a pronoun whose
  person is not the verb's (*Ben çıkarken o giriyordu*). The line
  draws the optional word in italic ink as `dw may` — not `opt`, which is
  the answer-button class and drew it as a bordered box.
- **Listed alternatives.** *ad / isim* and *ağabey (abi)*: the other one.

`validate.js` holds hand-checked tables for all three, and then the sweep
that matters: every spoken form the app could offer for any A1–B2
example, passage line or vocabulary item, and every short form it could
offer for any grammar example, is run back through the judge. An
alternative the app offered and then marked wrong would be worse than
none. Fifteen guards, each confirmed to fail on a deliberate breakage.
Two did not at first, and both were real: the pronoun list duplicated the
agreement gate, so one was removed, and "never the last word" was
untested until an answer that is only a pronoun (*Sen.*) was added, which
would otherwise be accepted as an empty string.

## Başlarken (the lessons before unit one)

Built, by request: a complete beginner met unit one's copula table with no
idea how the letters sound or why the verb comes last. `go('baslarken')`
is six short lessons, in `src/data/baslarken.js`: the alphabet (29
letters, each with a word to hear), spelling as sound, stress, words built
from pieces with a first look at vowel harmony, sentence order against
English, and sen/siz with a first handful of phrases. Each ends in four to
seven ordinary quiz questions, run by the quiz engine as `Q.mode:"intro"`.

- **It is not a unit.** Unit ids are permanent and every schedule is keyed
  to one, so the intro has its own list and its own record: `S.basla` is
  keyed by lesson id (`alfabe`, `yazim`, `vurgu`, `ekler`, `cumle`,
  `nezaket`), which is as permanent as a unit id, and `validate.js` fails
  by name if one goes missing. It is progress: `wipe()` clears it and a
  backup carries it.
- **It feeds nothing.** No star, no box, no mistake book: it is
  orientation, not material, and nothing reviews what has not been met.
  `quizNote()` finds no key on an intro item and writes nothing. `sim.js`
  checks every schedule is untouched after a run, wrong answers included.
- **Offered first only to someone who has opened nothing.** `baslaPlan()`
  is the next unfinished lesson while `metUnits()` is empty, and Bugün's
  last step points at it, still one instruction on day one. Since the
  path locks (below), a new learner cannot open a unit before the intro
  is passed, so this now means the intro comes first; a learner whose
  units predate the lock is followed by the plan through the units.
  Dersler shows Başlarken above the levels on the same rule, and below
  them afterwards.
- **A question can be heard.** An item with `say:` plays its word once on
  arrival (`Q.heard` stops a redraw playing it again), with a button to
  hear it again, and prints neither the word nor its spelling outside the
  options. With no speech engine at all those items are left out rather
  than turned into a guess. A typed answer is still diacritic-folded, the
  house rule: the c/ç kind of contrast is tested by choosing between
  spellings, not by punishing a keyboard.

`validate.js` holds the alphabet whole, in order, each letter once, each
capital the Turkish one (`i → İ`, `ı → I`) and each example word carrying
its letter, and every heard question's key pointing at the word played.
Twenty-two guards across the two tests, each confirmed to fail on a
deliberate breakage.

The pronunciation notes are approximations for an English speaker and the
stress patterns are the standard ones. This is another place a native
speaker's pass would be worth having.

### The path opens in order

By request, after the intro shipped: nothing moves on until the thing
before it is passed. Each intro lesson opens when the one before it is
passed (`baslaOpen()`), unit one when all six are, and every unit when
the unit before it is passed (`unitOpen()`, in `app.core.js`). It is the
model of the courses that lock a path — Duolingo's above all — including
their escape hatch: **a level's test ahead is the way to skip**, and it
already existed. Eight out of ten marks every unit in that level done,
which opens it and the unit after it. The intro has its own:
`startBaslaTest()`, ten questions with at least one from every lesson,
eight to pass, and all six marked passed (`byTest`, as a level test marks
its units) — so someone who already reads Turkish is not made to sit
through the alphabet, and is not pushed into the A1 test to skip it.
It is offered on the intro list and on unit one's lock card until the
intro is passed. The A1 test still skips the lessons and A1 together.

Three decisions:

- **Nothing already reached is locked again.** `unitOpen()` is true for
  any unit `isMet()` — opened or passed — before it asks about the one
  before. A learner with progress from before the lock keeps every unit
  they had opened, and the plan keeps following them. Taking away a unit
  someone was halfway through would be the lock punishing the learner
  for the app changing.
- **A locked row still opens.** Tapping one shows `lockCard()`: what
  opens it, where to go instead (`startBtn()`, the first open unit not
  passed, or the next intro lesson) and the level test. A dead row that
  did nothing would leave the learner guessing why. The locked unit
  screen is drawn *before* `markSeen()`, or looking at a locked unit
  would count as meeting it and unlock it.
- **The guard is in `renderUnit()`, not only in the level list.** Units
  are reached from Sözlük, the mistake book, the grammar hub and the plan
  as well, so the list is not the only door.

The tests lift the lock. Almost every step in `sim.js` and every grab in
`snap.js` is about what an open unit does, on a fresh state, so both
reassign `unitOpen`/`baslaOpen` to always-true at the top and keep the
real ones as `__unitOpen`/`__baslaOpen`. One `sim.js` step, **the path
opens in order**, puts them back and tests the rule; `snap.js` grabs the
locked views at the end the same way. Sixteen deliberate breakages,
ten on the lock and six on the intro test, each turned `sim.js` red. A new test that is about the lock has to restore
the real functions first, or it is testing the stub.

## Derse başla (the guided lesson)

Built, by request, after the children's app. Asked whether its shape
suited adults too, the honest answer was *partly*. The drills in a kids'
game are the wrong thing to copy, since an adult course needs recall and
explanation. What transfers is the **pacing**. A unit is four tabs a
learner moves between freely. That suits someone who knows what they
want, and it is easy to drift through for anyone else: the word list gets
skimmed, the grammar tab never gets opened, and there is no clear moment
when the unit is done.

It shipped first as "Adım adım", A1 only, beside the tabs. The learner
did not like the name, and it was not a feature anyway: it is how a unit
is taught. So it has **no name**. It is the main button at the top of
every unit, **Derse başla** (**Dersi tekrarla** once the unit is
passed), with the tabs underneath under *Ya da üniteye kendin göz at*.

`startAdim(id)` walks the unit's own material in order and hands over to
`startUnitQuiz`, the five exercises, which are what tick the unit. The
order is the same at every level; the checks grow with the learner,
because what teaches at A1 is too easy to teach anything at B1:

| level | words | checks | grammar | passage |
|---|---|---|---|---|
| A1 | pictured (`RESIM`), heard | hear and pick ×4, spell from tiles ×3 | read | line by line, shown |
| A2 | heard | type the Turkish from the English ×4 | read, then type one example | line by line, shown |
| B1+ | heard | the word typed back into its own sentence ×4, after the passage | read, then type one example | heard first, then shown |

From B1 the checks come after the passage, because a word blanked in a
sentence not yet read is a guess. `adimCloze()` is Tekrar's cloze builder
restricted to the unit's own lines (the form the line uses, never a line
that uses the word twice). A word with no sentence is asked from the
English instead, so there are always four: 38 of the 40 B1+ units ask
127 of 160 in their sentences.

Five decisions:

- **It adds no material and no storage.** Each part calls `markSeen()`
  for its own tab as it is shown: `v` for the words, `g` for the grammar,
  `r` for the passage. So the reviews open at exactly the grain they
  would if the tabs had been read. Walking the words does not count as
  reading the passage (see "Nothing reviews what has not been met").
- **The checks are practice, not marks.** Nothing is scheduled, starred
  or written to the mistake book. A missed check comes back once more
  (`ADIM_RETRY`, 2): before the grammar at A1 and A2, so the words are
  settled before the unit moves on from them, and before the end from
  B1, where the checks come last.
- **Typed answers use the course's own judges.** `wordOk()` and
  `sentOk()` were factored out of `tkCheck()` and `grCheck()` for this
  (a pure move that `snap.js` passed unchanged), so a spoken spelling,
  the other *you* and a dropped pronoun count here exactly as they do in
  Tekrar and Dilbilgisi. An empty answer is not marked.
- **The lock applies.** `startAdim` refuses a unit `unitOpen()` refuses.
  The lesson is a second door to the same room, not a way round the path.
- **`RESIM` is A1 only.** It is keyed by the exact vocab entry (`"ad /
  isim"`, not a fold of it). Abstract words are left out rather than
  given a picture that misleads, and from A2 most words are abstract.

`validate.js` fails on a `RESIM` key that is not an A1 entry, which is
how a spelling edit would strand one, and requires at least three
spellable words in every A1 unit. `sim.js` walks all sixty units and
checks each level's shape: the checks it asks for, their count, the
passage before the checks at B1+, and every blank filling back to its
line without the answer left in it. It also checks the autoplay happens
once and a redraw does not repeat it, the seen-flag grain, a missed
check coming back exactly once and where, the B1 line hidden until
shown, the English hidden until asked for, the judges (the other you, a
spoken form without its pronoun, a wrong example marked word by word, an
empty answer ignored), that `S` is untouched apart from `seen`, the quiz
handoff, `back()` and the lock.

A related fix that shipped with it: `button.card` set `display:block`
and outranked `.row`, so every navigation row in the app had its
chevron wrapped under the text instead of beside it. Fixed with
`button.card.row{display:flex}`.

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
or Yeni, with Anlat inserted before the last step when a retell is due, and
Kelime — the day's ten common words — after that, once a unit is finished.
Before any unit has been opened, the last step is **Giriş**, the next of
the lessons before unit one (see Başlarken below); it is still the only
step on day one.

**New items come in at a daily rate.** `NEW_DAY` caps how many
never-practised items each review queue lets in per day — Tekrar 10,
Dilbilgisi 3, Dinle 8, Söyle 12, prefabs and passage lines counted
separately — while reviews of what has been practised come due without
limit, the way Anki's new-cards-per-day works. `dueItems()` in
`app.core.js` is the one place it happens, and `repDue`, `gramDue`,
`dinleDue`, `prodDue` all go through it, so the runner, the hub, the
end-of-sitting count and the plan read the same number.

It exists because a learner reported it: after passing the A1 test,
every A1 unit counted as met, a hundred words were "due" in Tekrar, and
the plan — which puts reviews before new material — asked for ten after
ten and never reached A2. Nothing was wrong with any one sitting; the
backlog simply had no bottom. `sim.js` replays exactly that: pass the A1
test, run one sitting, and the Tekrar step must tick and the plan must
lead on to a2u1.

**One new unit a day.** Reported by the learner: two A2 units took an
afternoon, so the whole level could be ticked in a day, and a unit
passed on a five-question quiz minutes after the lesson has been
followed, not kept. The review queues already let in `NEW_DAY` new items
a day; new units had no pace at all. So the plan offers `UNIT_DAY` (1)
new unit a day: once `unitsToday()` — units whose `done.first` is today —
reaches it, the unit step stays in the plan ticked as **Yarın**, naming
tomorrow's unit, and `planToday().tomorrow` carries it to the landing
page (*Bugünlük bitti · Yarın: A2 · …*) and to the end screens. The unit
quiz's pass screen leads on to the rest of today's plan rather than to
**Sonraki ünite**. It is the plan's pace, not a lock: a unit opened by
hand from Dersler, or from the landing page's *Yine de devam et*, is
resumed as normal, and a level test is still the way to skip. A unit
passed again, or by a level test, is not a new one. `sim.js` checks all
of it; ten deliberate breakages each turned it red, and an eleventh
showed a `byTest` guard in `unitsToday()` was dead code, since a level
test never writes `first`, so it was removed and the test now breaks the
real path instead.

**On the landing page the plan is one button.** Reported by the learner:
the paragraph above Başla was too busy, and the children's app, big and
plain, was more appealing even to an adult. It had grown to a heading, a
folded summary (`5 adım · steps left · ~24 dk`), a sentence on why the
steps come in this order (or, on day one, why the reviews were absent),
the step list when unfolded, and then the button. Now `planCard()` is
**Bugün** and a large **Başla** that names the step it opens (*Tekrar ·
the words the course forgets*). Nothing else is needed to start, and
each sitting ends on the next step (see below), so the plan is walked
without being read. The whole list, ticked, is `planRows()` on İlerleme.
`PLANOPEN` and the fold went with it; `sim.js` fails on the list, the
summary, the paragraph or a second copy of the first step coming back.

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

**Nasıl çalışır** is the plain-English orientation, on its own screen.
On the landing page it is one link, *Nasıl çalışır?*, while `tipsOn()`:
until A2 is complete, or until the learner taps Gizle on that screen,
which is stored because retiring it is a setting. It used to be a card on
the landing page, open on day one and folded after (`TIPSOPEN`); it is
reading rather than a control, and the landing page is controls only.


The last step absorbed the old resume card: mid-unit it returns to the exact
section, and it falls back to the first unfinished unit otherwise. It must
check `isDone` — a bookmark survives completion, and following it blindly
pinned the plan to a unit already ticked.

### The end of a sitting, and the way on

Reported by the learner: finishing Tekrar from Bugün landed on the mode's
whole state (how many words were still under eight encounters, how many
lines were left in the set) and two buttons, one restarting Tekrar and one
opening its hub. The next step of the plan was a trip home away, and the
paragraph was the same one every day.

So a sitting ends on `endScreen()` in `app.tekrar.js`: the score, one
**Devam** that runs the plan's next step (`planToday().left[0]`, read
after the sitting's grades are saved, so it is the same step again only
while that step still has work), and a line under it naming the step.
With the plan done it says **Bugünlük bitti** and goes home. `plan:true`
is for the modes Bugün sends a learner to: Tekrar (both runners),
Dilbilgisi, Dikte, Söyle, Anlat. The Araçlar-only modes that share those
runners (Ses önce, Kalıplar, Kurma, Dönüştürme, Sor) end on **Bir daha** and
their hub instead. **Bir oturum daha** appears in a plan mode only when
it has more due *and* is not already the plan's next step, or the screen
would offer one thing twice. Sık kelimeler ends on the same `planNext()`,
and the Anlat step opens the retelling itself rather than the Üretim hub
(`retelldone` is its end view). Sayılar, Atasözleri, Diyalog, Yolda and
Uyumadan önce keep their own ends: they are not plan steps, and
Diyalog's transcript is the reward for finishing.

The state that used to sit on those screens is on **İlerleme**
(`app.ilerleme.js`, reached from under the two doors): units by level,
words met and at eight encounters, the encounter chart that used to be on
the Tekrar motoru hub, grammar points read and holding, sentences,
prefabs, retellings, dialogues, sayings, dictation, numbers and the
mistake book, and under the level rows the words actually held (a
review box a week or more out, in Tekrar motoru or the starred queue,
counted once each) against a rough vocabulary for the level being worked
in (`VOCAB_TARGET`: 500, 1,000, 2,000, 3,500, 5,000, 8,000). That row
exists because "A2 · 10 / 10" means A2's grammar has been followed, not
that A2 has been reached; the page says the targets are rough and that
they measure words, not grammar. Every number is counted from the schedules as the page is
drawn and nothing is stored; `sim.js` checks drawing it leaves `S`
unchanged. Dersler's stat row moved there too. Twelve deliberate
breakages each turned `sim.js` red; three did not at first, and all
three were the test: a home-button check satisfied by the bar's own home
icon, a duplicate-offer check whose fixture never produced the
duplicate, and a breakage that only renamed a class.

## Ana ekran (the landing page, and the two doors)

The home screen used to carry, in one column: the hero, a five-paragraph
orientation card, the plan, the progress road, three stats, **six level
cards** and **fifteen tool rows**, each under its own heading. Every one
of those was reachable. Reachable is not the same as findable — past a
certain length a list stops reading as choices and starts reading as
texture, and the plan, the one thing that answers "what now", sat at the
top of a wall the eye slides off.

So the landing page is now the hero with the live clock, **Bugün** (one
button), the progress road, and three tiles side by side, with a small
*Nasıl çalışır?* link under them while it is useful. No paragraph, no
section heading over the tiles, no footer.

| tile | behind it |
|---|---|
| **Dersler** | the six levels and their sixty units, the placement test |
| **Araçlar** | everything else, as tiles in four groups: Konuşma · Dinleme · Tekrar · Kelimeler |
| **İlerleme** | where the learner stands, and today's plan step by step |

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

The scale is the children's app's, not its colours: `.today` is a filled
cobalt button with a 2rem Crimson Pro *Başla*, and `.door` is a tile with
a line icon (`DOOR_IC`, stroked in cobalt), one word and its English, a
thumb-sized target in a row of three. A word on a big target reads as a
choice; a paragraph reads as something to get past. The tiles replaced
three stacked `.block` rows whose capital-letter English and live
subtitle lines were more text than choice.

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

### Araçlar as tiles, and "Şimdilik boş"

By request, after the landing page: Araçlar was sixteen rows of text under
two explanatory paragraphs, and is now fifteen tiles in a two-column grid
under the same four headings (Konuşma, Dinleme, Tekrar, Kelimeler), each
an icon (`TOOL_IC`), a name and a few words of English, built by
`toolTile()`. The two paragraphs and the footer are gone; Nasıl çalışır
and Bu kurs hakkında are two links at the foot rather than a fifth group.

Readiness is shown on the exception. It used to be a green **hazır** pill
on every row with something to do, which needed a paragraph to explain
it, and nine of the fourteen tools are full from day one anyway. Now a
tool whose bank is empty is drawn faded (`.tool.idle`) and says
**Şimdilik boş** (empty for now); the rest carry no mark. The flags are
the same live booleans as before, computed at the render from the banks
the modes check themselves (`listenBank()`, `uyBank()`, `repBank()`,
`gramBank()`, `S.star`, `S.err`, `sikBatch()`), never a hand-typed list.
"For now" rather than "yet" because Sık kelimeler empties once the day's
ten are in, as well as before anything has been met.

`sim.js` checks the four headings, fifteen tiles and no text row or
paragraph; the nine tools ready on a fresh install and the five that are
not; each of those five turning ready when exactly the tab that feeds it
is met; that a tile's fade and its label never disagree; and the two
reference pages being links. Nine deliberate breakages each turned it
red; one did not at first (the fade dropped while the label stayed),
because the test read only the label, which is why the fade-and-label
check exists.

`navRow()` is now only Dersler's; its readiness slot is unused.

## Sözlük (the word list)

`go('dict')` shows every word in the app — the 576 the units teach, the
316 everyday ones in `src/data/core.js` and the 1,473 commonest ones in
`src/data/sik.js` (listed under Çekirdek as the topic *sık*) — filterable by source and class,
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

## Sık kelimeler (the frequency layer)

Built, because the vocabulary did not back up the level labels once it
was measured. Against `tr_50k` — the 50,000 commonest word forms of
Turkish film subtitles (FrequencyWords, Hermit Dave, CC BY-SA 4.0) —
the words the app taught covered roughly **59–77%** of running speech,
strict to generous matching, where comprehension research puts adequate
understanding at 95%. The units spend their slots on their passages
(*kaşağı, telve, şefaat*), which is right for a reading course and left
the everyday core full of holes: *çünkü, lazım, zaten, aslında, kendi,
bütün, diğer, veya* were never taught as vocabulary at all.

`SIK` is **1,473** words in the order a learner should meet them. With it
the same measure reads **77–90%**, and everything the app shows **85–93%**.
The last stretch to 95% is reading, not lists — which is why Kütüphane is
still first below. The C1 and C2 level blurbs used to promise "real novels"
and "you read anything"; they now say what the units give (grammar and
register) and where the rest comes from.

**How the list was made**, so it can be extended the same way: forms
lemmatised with `zeyrek` (a Python port of Zemberek, from PyPI; it needs
NLTK's punkt data, fetched with `NLTK_ALLOW_PROXIED_URLOPEN=1` in this
sandbox) and summed per lemma; everything the app already teaches as a
headword removed; then **curated by hand**. The analyser is a candidate
generator, not a source: it returns inflected forms as lemmas (*verdi*),
wrong lemmas (*bilemek* for *bilmek*, *işemek*), suffix fragments (*nin*),
and the corpus is film dialogue, so it over-weights *silah, cinayet,
ajan*. Genre and vulgar words were dropped, numbers left to Sayılar, every
gloss written for the course. Ordering is by exact-spelling lemma count —
folding first let *kül* borrow *kul*'s count and *ön* borrow *on*'s — and a
phrase ranks by its **rarest** content word, or *iyi şanslar* inherits
*iyi*. Subtitles under-count daily life, so the meal and condolence
phrases, the weekdays and the months are lifted to fixed ranks.

One measurement error worth not repeating: the first coverage pass claimed
*istemek* was never taught. It is. A stem-prefix matcher turns *istemek*
into *iste-*, which does not prefix *istiyor* — Turkish narrows the vowel
before *-yor* (*iste- → isti-*, *söyle- → söylü-*). Any future count of
"forms the app covers" needs the narrowed stems too.

The delivery adds **no queue**, the same rule Kendi kelimelerim follows.
Introducing a word stars it with its first review **tomorrow** — due
today, it would un-tick the plan's own Tekrar step the moment Kelime was
done. `S.sik` records only which words have been met, keyed by the word
itself (`{d}` added, `{d,k:1}` already known), never by position, so the
list can be reordered or grown freely; a spelling change re-points a
record, like a renamed unit. *biliyorum* skips a word without spending the
day's ten. "Bir on daha" is a module variable reset at midnight, never
stored. It does **not** feed Tekrar motoru: that engine drills what the
corpus mentions least, and these are by construction words it barely
mentions. In Sözlük they sit under Çekirdek as the topic *sık*, so the
source filter stays four segments wide. The plan offers Kelime only once
a unit is finished, keeping day one to one instruction; Araçlar has it
from the start.

`validate.js` holds the list additive (nothing the course, CORE or POS
has), unique, lower case, free of numbers and invisible characters, verbs
unclassed, and fails by name if one of the gap-words that justified it
goes missing. Twenty guards across the two tests, each confirmed to fail
on a deliberate breakage.

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
