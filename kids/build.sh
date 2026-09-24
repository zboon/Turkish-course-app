#!/usr/bin/env bash
# Build Türkçe Macera, the children's app, into dist/kids/index.html.
# Same rule as the course: concatenation is the build, order is
# load-bearing, and src/shared/ is the code the two apps have in common.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=dist/kids/index.html
mkdir -p dist/kids

cat \
  kids/src/shell.head.html \
  src/shared/text.js \
  src/shared/voice.js \
  src/shared/srs.js \
  kids/src/data/units.js \
  kids/src/app.core.js \
  kids/src/app.games.js \
  kids/src/app.screens.js \
  kids/src/app.boot.js \
  kids/src/shell.foot.html \
  > "$OUT"

node test/parse.js "$OUT"
echo "built $OUT ($(wc -c < "$OUT") bytes)"
