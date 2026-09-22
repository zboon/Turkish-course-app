#!/usr/bin/env node
/* Smoke test: does the inlined script of a built file parse at all?
   The data files are fragments of one array literal, so a stray comma in
   src/data/b2.js takes down the whole app and the browser says nothing —
   it just shows a blank page with the error in the console. This is the
   check that catches it before the browser does.

   Usage: node test/parse.js dist/index.html            */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const file = process.argv[2] || path.join(root, "dist", "index.html");

/* The order build.sh concatenates in, so an error line in the built file
   can be named as a line in the source fragment it came from. */
const PARTS = [
  "src/shell.head.html",
  "src/data/levels.js",
  "src/data/a1.js", "src/data/a2.js",
  "src/data/b1.js", "src/data/b2.js",
  "src/data/c1.js", "src/data/c2.js",
  "src/data/_close.js",
  "src/data/placement.js",
  "src/data/chunks.js",
  "src/data/lex.js",
  "src/data/pos.js",
  "src/data/core.js",
  "src/app.core.js",
  "src/app.lang.js",
  "src/app.screens.js",
  "src/app.uretim.js",
  "src/app.dinle.js",
  "src/app.tekrar.js",
  "src/app.boot.js",
  "src/shell.foot.html"
];

function die(msg) { console.error("parse: " + msg); process.exit(1); }

let html;
try { html = fs.readFileSync(file, "utf8"); }
catch (e) { die("cannot read " + file + " — " + e.message); }

const open = html.indexOf("<script>");
const close = html.lastIndexOf("</script>");
if (open < 0 || close < 0) die("no <script> block in " + file);

const before = html.slice(0, open + "<script>".length);
const code = html.slice(open + "<script>".length, close);
/* Line of the built file that holds the script's own line 1. */
const scriptStart = before.split("\n").length;

/* Map a line of the built file back to (source file, line in that file). */
function locate(htmlLine) {
  let seen = 0;
  for (const p of PARTS) {
    let n;
    try { n = fs.readFileSync(path.join(root, p), "utf8").split("\n").length - 1; }
    catch (e) { return null; }          // no src/ next to this file — skip the map
    if (htmlLine <= seen + n) return p + ":" + (htmlLine - seen);
    seen += n;
  }
  return null;
}

try {
  new vm.Script(code, { filename: file });
} catch (e) {
  const m = /<anonymous>:(\d+)|:(\d+)\n/.exec(e.stack || "");
  const rel = m ? Number(m[1] || m[2]) : null;
  console.error("parse: " + file + " does not parse");
  console.error("  " + e.message);
  if (rel) {
    const htmlLine = scriptStart + rel - 1;
    const where = locate(htmlLine);
    console.error("  at " + file + ":" + htmlLine + (where ? "  ←  " + where : ""));
    const src = code.split("\n");
    for (let i = Math.max(0, rel - 3); i < Math.min(src.length, rel + 2); i++) {
      console.error("  " + String(scriptStart + i).padStart(5) + (i === rel - 1 ? " > " : "   ") + src[i]);
    }
  }
  process.exit(1);
}

console.log("parse ok · " + code.split("\n").length + " lines of script");
