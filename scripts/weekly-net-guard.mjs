// A leash on what a hand-run sync may ask the network for when nobody is
// watching it. Loaded BEFORE the sync, never imported by it:
//
//   WEEKLY_FETCH_BUDGET=40 node --import ./scripts/weekly-net-guard.mjs scripts/sync-graded-top.mjs
//   WEEKLY_FETCH_HOSTS=www.pricecharting.com node --import ./scripts/weekly-net-guard.mjs scripts/sync-first-partner.mjs --refresh
//
// WHY THIS EXISTS. The weekly job (.github/workflows/weekly-prices.yml) puts
// syncs on a schedule that were written to be run by a person, and two of them
// have a failure mode a person would notice and a schedule would not:
//
//   - sync-graded-top.mjs reads its 1,160 console pages out of .cache/ and
//     FETCHES ANY IT DOES NOT FIND. On the runner the cache is the nightly's,
//     restored by actions/cache. If that restore ever comes back empty, the
//     script would quietly recrawl all of PriceCharting's Pokemon catalogue,
//     which is the load the owner ruled out ("a month is the design").
//     WEEKLY_FETCH_BUDGET caps the requests: past the cap fetch() throws, the
//     script dies, and scripts/nightly-step.sh puts its file back.
//   - sync-first-partner.mjs re-reads 32 PriceCharting pages and ALSO mirrors
//     30 images from pokemon.com when its own cache is empty, then re-encodes
//     them with whatever Pillow the runner has. The weekly job wants the prices
//     and must not touch the art. WEEKLY_FETCH_HOSTS is an allowlist: a request
//     to any other host is answered 403 without leaving the machine, which is
//     the answer that script already treats as "no image, keep going".
//
// It changes nothing about pacing, headers or parsing: an allowed request goes
// to the real fetch untouched. With neither variable set it does nothing.
const budget = Number(process.env.WEEKLY_FETCH_BUDGET || 0) || 0;
const hosts = (process.env.WEEKLY_FETCH_HOSTS || "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);

if (budget || hosts.length) {
  const real = globalThis.fetch;
  let made = 0;
  let refused = 0;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url || String(input);
    let host = "";
    try { host = new URL(url).hostname.toLowerCase(); } catch { /* a relative url throws in the real fetch, as it always did */ }
    if (hosts.length && host && !hosts.includes(host)) {
      refused += 1;
      if (refused <= 3) console.log(`  weekly-net-guard: not asking ${host} (only ${hosts.join(", ")} this run)`);
      return new Response("", { status: 403, statusText: "refused by weekly-net-guard" });
    }
    made += 1;
    if (budget && made > budget) {
      throw new Error(
        `weekly-net-guard: this run has made ${budget} network requests and was allowed ${budget}. ` +
          `The page cache it was meant to read from is missing or thin, so it is stopping instead of recrawling.`,
      );
    }
    return real(input, init);
  };
  process.on("exit", () => {
    if (made || refused) console.log(`  weekly-net-guard: ${made} request(s) made${budget ? ` of ${budget} allowed` : ""}${refused ? `, ${refused} to other hosts refused` : ""}`);
  });
}
