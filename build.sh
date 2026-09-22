#!/usr/bin/env bash
# Build dist/index.html from src/. Order matters: the data files are
# fragments of one array literal, so concatenation IS the build.
set -euo pipefail
cd "$(dirname "$0")"

OUT=dist/index.html
mkdir -p dist

cat \
  src/shell.head.html \
  src/data/levels.js \
  src/data/a1.js src/data/a2.js \
  src/data/b1.js src/data/b2.js \
  src/data/c1.js src/data/c2.js \
  src/data/_close.js \
  src/data/placement.js \
  src/data/chunks.js \
  src/data/lex.js \
  src/data/pos.js \
  src/data/core.js \
  src/app.core.js \
  src/app.lang.js \
  src/app.screens.js \
  src/app.uretim.js \
  src/app.boot.js \
  src/shell.foot.html \
  > "$OUT"

cp -f sw.js manifest.json dist/ 2>/dev/null || true

# Smoke test: does the inlined script parse at all?
node test/parse.js "$OUT"
echo "built $OUT ($(wc -c < "$OUT") bytes)"
