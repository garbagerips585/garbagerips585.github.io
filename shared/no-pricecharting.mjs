// NO REQUESTS TO PRICECHARTING, FROM ANY SCRIPT, IN ANY JOB.
//
// 13 November 2026. PriceCharting (JJ Hendricks, sales@vgpc.com) answered the
// permission request: anyone who shows their price data on a site like this
// must pay for a plan. The owner will not pay for a fan site that makes no
// money, and replied the same day that we are taking their prices off the site.
// So from this date the site asks pricecharting.com for nothing.
//
// Loaded before every script through NODE_OPTIONS in the workflows:
//   NODE_OPTIONS: --import ./shared/no-pricecharting.mjs
// Any fetch to pricecharting.com (or a subdomain) gets a 403 without leaving
// the machine. The scripts already treat a refused page as "keep the last good
// read", so nothing crashes; the numbers just stop moving until the pages stop
// showing them. Linking TO pricecharting.com from a page is fine and is not a
// request, so this does not touch links.
//
// Do not remove this unless the owner has a paid plan AND written permission
// to show the data publicly (their terms make API data internal use only).
const real = globalThis.fetch;
if (typeof real === "function" && !globalThis.__noPricecharting) {
  globalThis.__noPricecharting = true;
  let refused = 0;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url || String(input);
    let host = "";
    try { host = new URL(url).hostname.toLowerCase(); } catch { /* relative url: the real fetch throws as before */ }
    if (host === "pricecharting.com" || host.endsWith(".pricecharting.com")) {
      refused += 1;
      if (refused === 1) console.log("  no-pricecharting: refusing requests to pricecharting.com (see shared/no-pricecharting.mjs)");
      return new Response("", { status: 403, statusText: "refused by no-pricecharting" });
    }
    return real(input, init);
  };
  process.on("exit", () => { if (refused) console.log(`  no-pricecharting: ${refused} request(s) to pricecharting.com refused`); });
}
