/* The AVIF <source> for a logo, built from the files that ACTUALLY EXIST.
 *
 * THIS IS A ONE-LINE HELPER BECAUSE THE SAME BUG SHIPPED IN THREE PLACES.
 * scripts/build-brand-logos.py deliberately DROPS a rendition whose AVIF encoded
 * larger than its WebP -- its own message is "so this one is served as webp
 * only", and it is right to: the page puts the AVIF first, so a bigger AVIF
 * means every modern browser takes the worse file. But three builders wrote the
 * srcset by hand and named both widths unconditionally:
 *
 *   build-locals.mjs   vendor and creator cards on /vendors.html, /creators.html
 *   build-shows.mjs    the confirmed-vendor row on /card-shows.html
 *   build-shops.mjs    shop cards on /shops.html
 *
 * For every logo held until 3 September 2026 both widths won, so all three were
 * correct by luck. Legends Card Shop is the first whose 200w AVIF lost, and two
 * of the three then pointed a <source> at a file that had deliberately never
 * been written. The browser picks the AVIF, gets a 404, and renders a BROKEN
 * IMAGE next to the name -- which is exactly what the owner saw on the show
 * page. The third, build-shops.mjs, is not broken today and is one dropped
 * rendition away from it.
 *
 * The lightbox halves of two of those files already guarded their own file with
 * existsSync and had done for weeks. It was only ever this half that assumed.
 *
 * A MISSING AVIF MUST COST A CANDIDATE, NEVER THE PICTURE. Returning "" leaves
 * the <img> and its WebP srcset to do the job, which is what the Python builder
 * intended when it dropped the file.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { esc } from "./format.mjs";

/**
 * @param root  the repo root, so this can stat the built tree
 * @param dir   the directory under public/assets: "creators" or "shops"
 * @param stem  the logo stem from the data file, e.g. "legends-card-shop"
 * @param sizes the sizes attribute, which differs per call site and is theirs
 */
export const avifSource = (root, dir, stem, sizes, widths = [200, 400]) => {
  const have = widths.filter((w) =>
    existsSync(join(root, "public", "assets", dir, `${stem}-${w}.avif`)));
  if (!have.length) return "";
  const srcset = have.map((w) => `/assets/${esc(dir)}/${esc(stem)}-${w}.avif ${w}w`).join(", ");
  return `<source type="image/avif" srcset="${srcset}" sizes="${esc(sizes)}">`;
};
