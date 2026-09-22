# Türkçe · A1–C2

A self-paced Turkish course that runs as one offline HTML file: six CEFR levels,
ten units each, built around graded reading that climbs from invented dialogue to
Ottoman prose.

**60 units · 300 exercises · 892 words · 432 graded sentences · 482 speaking prompts**

## What's in it

- **Four parts per unit** — Kelimeler (10 words, tap to hear, star to review),
  Dilbilgisi (one grammar point, table, examples), Okuma (a graded passage — tap
  a line for English, dotted words carry a gloss), Alıştırma (five exercises:
  multiple choice, gap-fill, sentence building).
- **Listening and shadowing** — *Dinle* reads a passage aloud line by line;
  *Gölge* plays each line then waits the same length again for you to repeat it.
  Speeds 0.6×–1×, using the device's own Turkish voice.
- **Üretim · speaking** — the English prompt, a silent gap of a few seconds,
  then the Turkish: the sentence has to leave your mouth before you hear the
  model. Self-graded, so it needs no microphone. Long sentences can be built
  backwards from the verb, there is a bank of fifty conversational prefabs,
  and a unit's speaking task comes back on day 1, 3 and 7.
- **Kurma · sentence building** — drills assembled on the spot from a
  vetted lexicon, so the sentence cannot be recalled, only built, and
  *Dönüştürme*, which asks for one change to a sentence you are shown:
  past, negative, question, person.
- **Sözlük** — every word in the app in one list: the 576 the course
  teaches plus 316 everyday words grouped by topic (food, getting about,
  the body, feelings…), by class and searchable in either language, each
  one speakable and starrable.
- **Spaced review** — starred words and produced sentences return on a
  widening schedule (1, 2, 4, 8, 16… days) until they stick.
- **Test ahead** — a 12-question placement test, plus a ten-question exam on
  every level that marks the whole level complete at 8 correct.
- **Progress and bookmark** — automatic; the home screen resumes exactly where
  you stopped. Backup and restore from the About screen.

## Reading ladder

Invented dialogue (A1) → Nasreddin Hoca and folk tales (A2) → Keloğlan, Ömer
Seyfettin (B1) → idiom, Istanbul sketches, Turkish coffee, formal writing (B2) →
Yeni Lisan, Dede Korkut, Ziya Gökalp, Sabahattin Ali, Evliya Çelebi, Karagöz
(C1) → Ottoman petitions, dialects, translation, irony (C2).

Every passage declares its source: **özgün metin** (written for the course),
**sadeleştirilmiş** (anonymous folklore retold), or **uyarlama** (a public-domain
work retold in graded Turkish, with author and date). See `CLAUDE.md` for the
sourcing rules.

## Build

```bash
./build.sh              # src/ → dist/index.html
node test/validate.js   # data integrity, and the Turkish the app generates
node test/sim.js        # headless render of every screen
node test/snap.js       # nothing drawn or generated changed
```

No dependencies, no network, no build tooling — `cat` and `node`.

## Deploy

Pushing to `main` builds and publishes to GitHub Pages on its own
(`.github/workflows/pages.yml`). For any other static host, run `./build.sh`
and copy `dist/index.html`, `sw.js` and `manifest.json`.

Bump `APP_VERSION` in `src/app.js` and `CACHE` in `sw.js` together on every
release, then open the app twice so the old service worker is replaced.

Progress lives in `localStorage` on the device it was made on. Moving to a new
URL or a new phone means exporting the backup text from About and pasting it in
on the other side.
