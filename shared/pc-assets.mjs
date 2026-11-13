// NO PRICECHARTING PICTURES, 13 November 2026.
//
// PriceCharting requires a paid plan to show their data and the owner declined
// (see shared/no-pricecharting.mjs). Their card scans and packaging photos are
// their content too, and a page that hotlinks them sends every visitor's browser
// to their image servers. So no page prints one: the data files had their image
// urls stripped the same day, and every builder that used to print one asks this
// first, so a url that comes back in a re-synced file is still never drawn.
export function isPricechartingAsset(url) {
  let host = "";
  let path = "";
  try {
    const u = new URL(String(url || ""));
    host = u.hostname.toLowerCase();
    path = u.pathname.toLowerCase();
  } catch {
    return false;
  }
  if (host === "pricecharting.com" || host.endsWith(".pricecharting.com")) return true;
  return host === "storage.googleapis.com" && path.startsWith("/images.pricecharting.com/");
}

/** The url, or null where it is a PriceCharting picture. */
export const notPricecharting = (url) => (url && !isPricechartingAsset(url) ? url : null);
