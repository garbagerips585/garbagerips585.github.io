#!/usr/bin/env node
// Strip the comments out of the stylesheet on the way to public/.
//
//   node scripts/build-css.mjs
//
//   assets-source/ui.css   the file a human edits, comments and all
//   public/assets/ui.css   what ships: same rules, same order, no prose
//
// RUN FIRST, before any page builder. shared/chrome.mjs hashes
// public/assets/ui.css at import time to build the cache-busting ?v=, so every
// builder that imports it reads this script's output. Running it afterwards
// stamps the pages with the hash of the previous stylesheet.
//
// WHY. ui.css was 147.8KB, render blocking, on all 425 pages, and 40% of it
// (60.5KB) was comments. Measured over the wire, where the host gzips:
//
//   with comments     147.8KB raw   42.4KB gzipped
//   without           88.3KB raw    17.4KB gzipped
//
// That is 58% off the transfer of the one asset that blocks first paint
// everywhere, for no change to a single rule.
//
// WHY NOT JUST DELETE THE COMMENTS. They are the reason the file is
// maintainable: half of them record a measurement or a bug that a "cleanup"
// would otherwise reintroduce (the pack keyframes, the 2:3 tile ratio, the
// two stacked filter rails). They are worth more in the repo than the bytes
// cost on the wire, so they stay in assets-source/ and never leave the machine.
//
// WHY THE SOURCE MOVED INSTEAD OF THE OUTPUT. The obvious shape is to emit
// ui.min.css and link that, but 425 pages link /assets/ui.css, index.html is
// hand maintained, and several builders write their own <head>. Changing the
// URL means regenerating the whole site to change a filename. Keeping the URL
// and moving the source is the same result with no HTML churn.
//
// WHAT THIS DOES NOT DO. It does not reorder, merge, shorten or drop any rule.
// Cascade order is the one thing this stylesheet is most sensitive to and this
// pass cannot affect it: the output is the input with the comments and the
// redundant whitespace removed, byte for byte otherwise. Coverage says only
// 6-15% of the file is used on any one page, but the unused part is full of
// :hover, :focus, print, media query and JS-toggled-class rules that no
// coverage run can see, so nothing is removed on that basis.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SRC = join(ROOT, "assets-source", "ui.css");
export const OUT = join(ROOT, "public", "assets", "ui.css");

/**
 * Remove comments and collapse whitespace runs, without touching anything
 * inside a string or an unquoted url().
 *
 * The naive version of this is one regex, and it is wrong: a `/*` inside a
 * quoted value (`content:"/*"`) opens a comment that swallows CSS until the
 * next `*` + `/` anywhere in the file. There is no such string in ui.css
 * today, which is exactly why a regex would look correct right up until
 * someone adds one. So this walks the file instead.
 *
 * Whitespace: a run outside a string is one token separator no matter how long
 * it is, so collapsing it is safe, INCLUDING where it is a descendant
 * combinator (`.a .b`) - one space still separates. A run that spanned a line
 * becomes one newline rather than one space purely so the output still diffs
 * per rule instead of as a single line.
 */
export function strip(css) {
  let out = "";
  let i = 0;
  const n = css.length;

  while (i < n) {
    const c = css[i];

    // Comment. /*! is the license convention; keep those.
    if (c === "/" && css[i + 1] === "*") {
      const keep = css[i + 2] === "!";
      const end = css.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      if (keep) out += css.slice(i, stop);
      // An unterminated comment means the author lost the rest of the file
      // already; say so rather than silently emitting a truncated stylesheet.
      else if (end === -1) throw new Error("unterminated /* comment in " + SRC);
      // A comment can sit mid-selector as a token separator, so leave one
      // space behind if the neighbours would otherwise fuse.
      else if (/\S$/.test(out) && /^\S/.test(css.slice(stop))) out += " ";
      i = stop;
      continue;
    }

    // String. Copy verbatim, honouring backslash escapes.
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n) {
        if (css[j] === "\\") j += 2;
        else if (css[j] === c) { j += 1; break; }
        else j += 1;
      }
      out += css.slice(i, j);
      i = j;
      continue;
    }

    // Unquoted url(...). The tokenizer takes it raw, so /* inside it is URL,
    // not a comment.
    if ((c === "u" || c === "U") && /^url\(/i.test(css.slice(i, i + 4))) {
      const close = css.indexOf(")", i);
      const body = css.slice(i + 4, close === -1 ? n : close);
      if (close !== -1 && !/^\s*["']/.test(body)) {
        out += css.slice(i, close + 1);
        i = close + 1;
        continue;
      }
    }

    // Whitespace run.
    if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f") {
      let j = i;
      let nl = false;
      while (j < n && /\s/.test(css[j])) { if (css[j] === "\n") nl = true; j += 1; }
      out += nl ? "\n" : " ";
      i = j;
      continue;
    }

    out += c;
    i += 1;
  }

  // Tidy the seams: no space hugging a brace or a semicolon, no blank lines.
  out = out
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \n]*\{[ \n]*/g, "{")
    .replace(/[ \n]*;[ \n]*/g, ";")
    .replace(/[ \n]*\}[ \n]*/g, "}\n")
    .trim();

  return out + "\n";
}

const BANNER =
  "/*! Garbage Rips 585 - generated by scripts/build-css.mjs.\n" +
  "    EDIT assets-source/ui.css, NOT THIS FILE. Same rules in the same order,\n" +
  "    with the comments stripped; the commented original is the source. */\n";

if (import.meta.url === `file://${process.argv[1]}`) {
  const src = await readFile(SRC, "utf8");
  const out = BANNER + strip(src);
  await writeFile(OUT, out);
  const before = Buffer.byteLength(src);
  const after = Buffer.byteLength(out);
  console.log(
    `ui.css ${(before / 1024).toFixed(1)}KB -> ${(after / 1024).toFixed(1)}KB ` +
    `(${(100 - (after / before) * 100).toFixed(1)}% off)`
  );
}
