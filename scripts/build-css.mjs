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
 * Remove the comments. That is the whole transform: every other byte survives.
 *
 * The naive version of this is one regex, and it is wrong: a `/*` inside a
 * quoted value (`content:"/*"`) opens a comment that swallows CSS until the
 * next `*` + `/` anywhere in the file. There is no such string in ui.css
 * today, which is exactly why a regex would look correct right up until
 * someone adds one. So this walks the file instead.
 *
 * WHY IT DOES NOT ALSO CRUSH THE WHITESPACE, which is the obvious next step.
 * Whitespace inside a custom property value is part of the value's literal
 * text, and getComputedStyle hands that text back verbatim. Collapsing the
 * newline in --lift's four-line shadow changes what every element on the page
 * REPORTS for --lift, because custom properties inherit. Measured, it changes
 * nothing that renders: across the 8 page types at 375 and 1440, all 11,638
 * elements kept byte-identical boxes and byte-identical resolved values, and
 * the only diff was that literal string. But it buys 647 bytes gzipped out of
 * a 25KB saving, and "the built file is the source minus its comments" is a
 * claim worth more than 647 bytes. Nothing here reads a custom property from
 * JS today; this way it stays true if something starts.
 */
/**
 * Refuse a source file whose comments do not close cleanly.
 *
 * THIS EXISTS BECAUSE THE FAILURE IT CATCHES IS COMPLETELY SILENT AND SHIPPED
 * TWICE IN ONE HOUR on 16 August 2026. Editing a comment left a close-comment
 * marker in the middle of it. The comment ended there, the prose after it
 * parsed as declarations, and the browser threw away the rule that followed.
 * This script printed "205.9KB -> 97.3KB (52.7% off)", which is exactly what a
 * healthy run looks like, and check-build.py said all checks pass, because
 * neither script parses CSS. It reached all 481 pages. The only thing that
 * caught it was driving the page and noticing a control had stopped working.
 * It then happened a SECOND time, inside the comment written to document the
 * first one, because that comment quoted the marker.
 *
 * THE TELL IS ALWAYS THE SAME and it is worth stating, because it is what
 * makes a cheap check sufficient here. A comment that ends early leaves its
 * real closing marker stranded in CSS text, so the file ends up with a close
 * marker outside any comment. There is no valid CSS in which that appears: not
 * in a selector, not in a value, not in an at-rule. Strings and unquoted url()
 * bodies can hold one, so this walks the file with the same tokenizer rules as
 * strip() rather than reaching for a regex, for the reason strip() gives.
 *
 * Brace depth is counted on the way past. It is not this bug (the swallowed
 * rule keeps its braces, so the count does not move) but it is the same class
 * of silent damage, it is free while we are already walking, and it catches a
 * comment that hid an opening brace.
 *
 * Throws with the source line, the column and the offending line.
 */
export function lintComments(css) {
  const lines = css.split("\n");
  const fail = (i, msg, hint) => {
    const upto = css.slice(0, i);
    const line = upto.split("\n").length;
    const col = i - upto.lastIndexOf("\n");
    const text = (lines[line - 1] || "").trim();
    throw new Error(
      `${SRC}:${line}:${col}\n\n  ${msg}\n\n` +
        `  ${line} | ${text.length > 96 ? text.slice(0, 96) + "..." : text}\n\n  ${hint}`
    );
  };

  let i = 0;
  let depth = 0;
  let opened = [];
  const n = css.length;

  while (i < n) {
    const c = css[i];

    if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      if (end === -1) {
        fail(
          i,
          "unterminated comment: this /* is never closed, so it swallows the rest of the file.",
          "Close it, or delete it."
        );
      }
      i = end + 2;
      continue;
    }

    // The whole point of this function.
    if (c === "*" && css[i + 1] === "/") {
      fail(
        i,
        "close-comment marker outside any comment. The comment above it ended early, " +
          "so the prose in between is being parsed as CSS and the next rule is being discarded.",
        "A comment cannot contain the close marker, in quotes or backticks or anywhere else. " +
          "Write it in words instead, the way the note at the top of ui.css does."
      );
    }

    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n) {
        if (css[j] === "\\") j += 2;
        else if (css[j] === c) { j += 1; break; }
        else j += 1;
      }
      i = j;
      continue;
    }

    if ((c === "u" || c === "U") && /^url\(/i.test(css.slice(i, i + 4))) {
      const close = css.indexOf(")", i);
      const body = css.slice(i + 4, close === -1 ? n : close);
      if (close !== -1 && !/^\s*["']/.test(body)) {
        i = close + 1;
        continue;
      }
    }

    if (c === "{") { opened.push(i); depth += 1; }
    else if (c === "}") {
      depth -= 1;
      opened.pop();
      if (depth < 0) {
        fail(i, "unbalanced }: this closes a block that was never opened.", "Check the comment above it.");
      }
    }

    i += 1;
  }

  if (depth !== 0) {
    fail(
      opened[opened.length - 1] ?? n - 1,
      `unbalanced {: ${depth} block(s) opened here and never closed.`,
      "A comment that ate a closing brace looks exactly like this."
    );
  }
}

export function strip(css) {
  // Before anything is emitted, so a malformed comment stops the build with a
  // line number rather than producing a healthy-looking byte count.
  lintComments(css);

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

    out += c;
    i += 1;
  }

  // The only tidy-up: drop the lines the comments used to occupy, which are
  // now blank, and any trailing spaces they left. A CSS string cannot contain
  // a raw newline, so a whitespace-only LINE is never inside one and dropping
  // it cannot touch a value.
  out = out
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n");

  return out.trim() + "\n";
}

const BANNER =
  "/*! Garbage Rips 585 - generated by scripts/build-css.mjs.\n" +
  "    EDIT assets-source/ui.css, NOT THIS FILE. Same rules in the same order,\n" +
  "    with the comments stripped; the commented original is the source. */\n";

if (import.meta.url === `file://${process.argv[1]}`) {
  const src = await readFile(SRC, "utf8");
  let out;
  try {
    out = BANNER + strip(src);
  } catch (err) {
    // A stack trace here is noise: the fault is in the stylesheet, not in this
    // file, and the line number is the whole answer. Exit non-zero so
    // build-all.mjs stops rather than carrying on with 50 more builders that
    // would all stamp a broken stylesheet's hash onto their pages.
    process.stderr.write("\nui.css did not build.\n\n" + err.message + "\n\n");
    process.exit(1);
  }
  await writeFile(OUT, out);
  const before = Buffer.byteLength(src);
  const after = Buffer.byteLength(out);
  console.log(
    `ui.css ${(before / 1024).toFixed(1)}KB -> ${(after / 1024).toFixed(1)}KB ` +
    `(${(100 - (after / before) * 100).toFixed(1)}% off)`
  );
}
