/* Pull the interface Turkish out of the source: every tx(en, tr) and
   txt(en, tr) pair, the Turkish subtitle a bar() or navRow() carries, the
   bare labels in EN_UI and the "Türkçe · english" labels EN_INLINE lists.
   Used by tools/review.js; a static read of the source, so it finds a
   string whether or not any test happens to draw it. A piece of an
   argument that is not a literal (a count, a unit name) becomes "…". */
"use strict";
const fs = require("fs"), path = require("path");

function literal(s) {
  try { return Function('"use strict";return (' + s + ");")(); } catch (e) { return null; }
}
/* The arguments of every call to name, as raw source text. */
function calls(src, name) {
  const out = [], re = new RegExp("(?<![\\w$.])" + name + "\\(", "g");
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length, depth = 0, cur = "", args = [];
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === "'" || c === '"' || c === "`") {
        let j = i + 1;
        while (j < src.length && src[j] !== c) { if (src[j] === "\\") j++; j++; }
        cur += src.slice(i, j + 1); i = j; continue;
      }
      if (c === "(" || c === "[" || c === "{") depth++;
      if (c === ")" || c === "]" || c === "}") {
        if (depth === 0) { args.push(cur); break; }
        depth--;
      }
      if (c === "," && depth === 0) { args.push(cur); cur = ""; continue; }
      cur += c;
    }
    out.push({ args: args.map(a => a.trim()), at: m.index });
  }
  return out;
}
/* One argument as text: string literals joined, anything else "…". */
function text(arg) {
  if (!arg) return null;
  const parts = [];
  let depth = 0, cur = "";
  for (let i = 0; i < arg.length; i++) {
    const c = arg[i];
    if (c === "'" || c === '"' || c === "`") {
      let j = i + 1;
      while (j < arg.length && arg[j] !== c) { if (arg[j] === "\\") j++; j++; }
      cur += arg.slice(i, j + 1); i = j; continue;
    }
    if ("([{".includes(c)) depth++;
    if (")]}".includes(c)) depth--;
    if (c === "+" && depth === 0) { parts.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  parts.push(cur.trim());
  let lit = 0;
  const s = parts.map(p => {
    if (/^(['"`])[\s\S]*\1$/.test(p) && !/\$\{/.test(p)) { const v = literal(p); if (typeof v === "string") { lit++; return v; } }
    return "…";
  }).join("").replace(/(…\s*)+…/g, "…");
  return lit ? s : null;
}
function clean(s) {
  return s.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

function interfaceStrings(root) {
  const files = fs.readdirSync(path.join(root, "src")).filter(f => /^app\..*\.js$/.test(f)).sort();
  const seen = new Map(), add = (kind, en, tr, file) => {
    tr = clean(tr); en = clean(en || "");
    if (!/[a-zçğıöşü]/i.test(tr.replace(/…/g, ""))) return;
    const k = kind + "|" + tr + "|" + en;
    if (seen.has(k)) { seen.get(k).files.add(file); return; }
    seen.set(k, { kind, tr, en, files: new Set([file]) });
  };
  files.forEach(f => {
    const src = fs.readFileSync(path.join(root, "src", f), "utf8");
    ["tx", "txt"].forEach(fn => calls(src, fn).forEach(c => {
      if (c.args.length !== 2) return;
      const en = text(c.args[0]), tr = text(c.args[1]);
      if (tr && en) add("tx", en, tr, f);
    }));
    calls(src, "bar").forEach(c => {
      if (c.args.length < 4) return;
      const en = text(c.args[1]), tr = text(c.args[3]);
      if (tr && en) add("tx", en, tr, f);
    });
    calls(src, "navRow").forEach(c => {
      if (c.args.length < 5) return;
      const en = text(c.args[1]), tr = text(c.args[4]);
      if (tr && en) add("tx", en, tr, f);
    });
  });
  /* The labels: EN_UI's keys, and the Turkish written before " · " for
     every English half EN_INLINE lists. */
  const core = fs.readFileSync(path.join(root, "src", "app.core.js"), "utf8");
  const ui = literal(/const EN_UI=(\{[\s\S]*?\n\});/.exec(core)[1]);
  const inline = literal(/const EN_INLINE=(\[[\s\S]*?\n\]);/.exec(core)[1]);
  Object.keys(ui).forEach(k => add("ui", ui[k], k, "app.core.js"));
  const all = files.map(f => [f, fs.readFileSync(path.join(root, "src", f), "utf8")]);
  inline.forEach(en => {
    const re = new RegExp("([A-ZÇĞİÖŞÜa-zçğıöşüâîû][^'\"<>]{0,60}?) · " + en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=['\"<])", "g");
    all.forEach(([f, src]) => { let m; while ((m = re.exec(src))) add("ui", en, m[1], f); });
  });
  return [...seen.values()].map(x => ({ kind: x.kind, tr: x.tr, en: x.en, files: [...x.files].sort() }));
}
module.exports = { interfaceStrings };
if (require.main === module) {
  const r = interfaceStrings(path.join(__dirname, ".."));
  console.log(r.filter(x => x.kind === "tx").length + " instructions, " + r.filter(x => x.kind === "ui").length + " labels");
  r.slice(0, 8).concat(r.filter(x => x.kind === "ui").slice(-6)).forEach(x => console.log(x.kind, "|", x.tr, "|", x.en, "|", x.files.join(",")));
}
