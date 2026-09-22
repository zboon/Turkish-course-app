# CLAUDE.md — Türkçe course app

A single-file offline Turkish course, A1→C2. `src/` is the truth; `dist/index.html`
is generated. Never hand-edit `dist/`.

## Workflow

```bash
./build.sh              # concatenate src/ → dist/index.html, parse-check it
node test/validate.js   # data integrity + 266 hand-checked forms + 446 dictation scores
node test/sim.js        # headless render of all 326 screens + every runtime path
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
src/app.core.js          state, helpers, voice, the SRS ladder, routing
src/app.lang.js          morphology and the drill generator (pure)
src/app.screens.js       home, level, unit, quiz, words, sözlük, about
src/app.uretim.js        production mode, chunk bank, retell
src/app.dinle.js         dictation and audio-first listening
src/app.tekrar.js        the repetition engine, and the daily plan
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

## Progress storage — do not break it

`localStorage["turkce-course-v1"]`, one object:

```js
{done:{unitId:{score,of,at,byTest}}, seen:{unitId:{v,g,r,d}},
 place:{u,s}, star:["tr|en"], srs:{"tr|en":{b:box,d:dueDay}},
 tested:{A1:true}, days:["YYYY-MM-DD"], theme, rate,
 prod:{"s:b1u3#4":{b,d}, "k:12":{b,d}}, retell:{unitId:{n,d}},
 dinle:{"d:b1u3#4":{b,d}, "a:b1u3#4":{b,d}},
 rep:{"kasagi":{b,d,n}},
 gap, prompten, pscope, drate, dreplay}
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
word's natural encounters. Editing a vocabulary entry's spelling re-points
its schedule, the same hazard as renumbering a unit.
Reordering a unit's `lines` silently re-points every schedule built on it,
so add lines at the end rather than inserting them. `gap`, `prompten`,
`pscope`, `drate` and `dreplay` are settings, not progress — `wipe()`
keeps them, like `theme` and `rate`.

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
far — v2.00 → v2.31 → v2.40.

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
  Üretim countdown and the Dinleme timer, so a timer started in either dies
  with the screen; anything else that sets a timer needs its own stop called
  from `stopPlay()` for the same reason.

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
  is the pattern you were weak at.

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
first, so the floor rises rather than the ceiling. The hub shows the
distribution, which is the one number the engine exists to move.

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

## Bugün (the daily plan)

The app had six ways in and no opinion about which to use. `planCard()` is
the opinion, first thing on the home screen, above the progress road —
action before orientation.

Order is everything perishable first, new material last: reviews decay on a
schedule and a unit does not. Tekrar, Dinle, Söyle, then Devam or Yeni, with
Anlat inserted when a retell is due.

**Nothing is stored.** A step is done when its own queue is empty, which is
self-correcting — finish the work and the tick appears, come back tomorrow
and it clears itself. A per-day completion flag would need its own state and
could disagree with the queues.

The last step absorbed the old resume card: mid-unit it returns to the exact
section, and it falls back to the first unfinished unit otherwise. It must
check `isDone` — a bookmark survives completion, and following it blindly
pinned the plan to a unit already ticked.

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

1. **Chunks, 50 → 300+.** `src/data/chunks.js`. Pure data, no new
   mechanics, and formulaic language is a large share of fluent speech — the
   cheapest fluency per hour left.
2. **Branching dialogue and a repair kit.** The nearest an offline app gets
   to unpredictability, and it trains the thing that actually ends
   conversations: not missing a word, but having to continue anyway.
3. **Kütüphane** — verbatim public-domain texts with an
   orijinal/sadeleştirilmiş toggle. **Blocked in this environment**: the
   sourcing rule above requires checking against a real source, and
   Wikisource, Gutenberg and Wikipedia are all unreachable from the sandbox.
   It needs the texts supplied, or a session with network access. Do not
   type them from memory.
4. **Osmanlıca** — Arabic-script Turkish. The learner already reads the
   script, so it is orthography and vocabulary rather than letters.
   Interesting, and orthogonal to speaking.

No app on its own reliably produces a conversational speaker; every
programme that does has a human in the loop. The work above makes tutor
hours efficient rather than replacing them.
