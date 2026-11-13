#!/usr/bin/env node
// /top-graded.html, RETIRED 13 November 2026, now a redirect to
// /most-valuable-cards.html.
//
// It ranked the 100 highest PSA 10 values in PriceCharting's price guide.
// PriceCharting requires a paid plan to show their prices and the owner
// declined (shared/no-pricecharting.mjs), and there is no free source of graded
// prices to rank on, so the page is gone. The address still answers, because
// search engines and old links know it: a noindex page that sends the reader to
// the raw list, the same stub shape scripts/build-30th.mjs writes for the old
// set guide address (one h1, no canonical, no description, a visible link).
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TO = "/most-valuable-cards.html";
await writeFile(
  join(ROOT, "public/top-graded.html"),
  `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,follow">
<meta http-equiv="refresh" content="0; url=${TO}">
<title>Top graded cards list has been retired</title>
</head>
<body>
<h1>Top graded cards</h1>
<p>This list has been retired. The most valuable raw cards are at <a href="${TO}">${SITE}${TO}</a>. Taking you there now.</p>
</body>
</html>
`
);
console.log(`Wrote public/top-graded.html  redirect -> ${TO}`);
