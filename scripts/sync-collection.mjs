#!/usr/bin/env node
// Pull the card collection from Collectr's public showcase.
//
//   node scripts/sync-collection.mjs
//   node scripts/sync-collection.mjs --force
//
// Writes public/data/collection.json, which build-collection.mjs renders.
//
// HOW THIS WORKS AND WHAT IT DEPENDS ON
// Collectr has a "showcase" feature that makes a portfolio public. The Flutter
// web app behind it reads one unauthenticated endpoint, and that is what this
// calls. It needs no key and no login, but it is UNDOCUMENTED: it is the public
// backend of a feature Collectr deliberately made public, not a sanctioned API,
// and it can change without notice.
//
// So this never fails the build. If the endpoint moves or the showcase toggle
// gets turned off, the last good copy of collection.json stays committed and
// the page keeps rendering yesterday's numbers with the date it last succeeded
// printed on it. A page that quietly goes stale AND SAYS SO is much better than
// a nightly job that starts failing.
//
// Collectr's API terms ask for a "Powered by Collectr" credit and prohibit
// redistributing the data commercially. The credit is on the page.
//
// The showcase returns every portfolio merged, with no per-collection field on
// the products. Today there is only one ("Modern Hits") so it does not matter;
// if a second is ever added, everything will appear here together.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/data/collection.json");

// The showcase id from the profile URL:
// https://app.getcollectr.com/showcase/profile/<this>
const SHOWCASE_ID = process.env.COLLECTR_ID || "563e3401-e88d-48fe-b42f-8f9816dd7f5a";
const ENDPOINT = `https://djk9wkkysj.execute-api.us-east-1.amazonaws.com/data/showcase/${SHOWCASE_ID}?limit=1000`;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Keep the last good file rather than writing a broken one. */
async function keepExisting(why) {
  if (existsSync(OUT)) {
    const old = JSON.parse(await readFile(OUT, "utf8"));
    console.log(`  ${why}`);
    console.log(`  Kept the copy from ${old.checked}: ${old.totalCards} cards, $${old.totalValue}.`);
    console.log(`  The page will say it was last updated then.`);
    return true;
  }
  console.error(`  ${why}\n  No previous copy to fall back on, so nothing was written.`);
  return false;
}

let raw;
try {
  const res = await fetch(ENDPOINT, { headers: { accept: "application/json" } });
  if (!res.ok) {
    process.exit((await keepExisting(`Collectr answered ${res.status}.`)) ? 0 : 1);
  }
  raw = await res.json();
} catch (e) {
  process.exit((await keepExisting(`Could not reach Collectr: ${e.message}`)) ? 0 : 1);
}

if (!raw || raw.showcaseEnabled === false || !(raw.products || []).length) {
  process.exit(
    (await keepExisting(
      raw?.showcaseEnabled === false
        ? "The showcase is switched off in Collectr, so it returned nothing."
        : "Collectr returned no products."
    ))
      ? 0
      : 1
  );
}

const cards = (raw.products || [])
  .filter((p) => p.is_card !== false)
  .map((p) => ({
    id: p.product_id ?? null,
    name: p.product_name || "",
    set: p.catalog_group || null,
    number: p.card_number || null,
    rarity: p.rarity || null,
    qty: Number(p.quantity) || 1,
    price: num(p.market_price),
    // Yesterday's move. The one thing a static page cannot work out for itself
    // and the reason a collection page is worth revisiting.
    diff: num(p.market_price_diff),
    diffPct: num(p.market_price_percentage_diff),
    grade: p.grade_company ? `${p.grade_company} ${p.grade_id ?? ""}`.trim() : null,
    // Their CDN resizes on request, so ask for the size actually rendered
    // rather than pulling a full-size jpeg per card.
    image: p.image_url || null,
    ebay: p.ebay_buy_link || null,
  }))
  .sort((a, b) => (b.price || 0) * (b.qty || 1) - (a.price || 0) * (a.qty || 1));

// Their own total, not one computed here. Mine came out $1.07 higher because of
// price overrides and rounding, and the number on the site should match the
// number in his app.
const reported = num((raw.portfolio_value || []).at(-1)?.price);

const doc = {
  checked: new Date().toISOString().slice(0, 10),
  source: "Collectr",
  profileUrl: `https://app.getcollectr.com/showcase/profile/${SHOWCASE_ID}`,
  handle: raw.handle || null,
  totalCards: Number(raw.total_cards) || cards.reduce((n, c) => n + c.qty, 0),
  totalSealed: Number(raw.total_sealed) || 0,
  totalGraded: Number(raw.total_graded) || 0,
  totalValue: reported != null ? Math.round(reported * 100) / 100 : null,
  collections: (raw.collections || []).map((c) => c.name).filter(Boolean),
  cards,
};

await writeFile(OUT, JSON.stringify(doc, null, 2) + "\n");

const withPrice = cards.filter((c) => c.price);
console.log(`Wrote public/data/collection.json
  ${doc.totalCards} cards, ${cards.length} unique, $${doc.totalValue?.toLocaleString("en-US")}
  ${withPrice.length} priced, top: ${withPrice[0]?.name} (${withPrice[0]?.set}) $${withPrice[0]?.price}
  portfolios: ${doc.collections.join(", ") || "none named"}`);
