// THE SET GUIDES THAT DO NOT LIVE UNDER /sets/, counted wherever the site says
// how many set guides it has. Added 14 October 2026.
//
// Three pages said "42 set guides" (search, wanted) and "29 English guides"
// (start) while /sets/ itself lists 44, because each counted sets.json plus
// intl-guides.json and nothing else. Two English guides are built by their own
// builders at the site root rather than at /sets/<id>.html, so no data file
// that the counters read ever held them:
//
//   /30th-celebration.html  build-30th.mjs. TCGdex and api.pokemontcg.io had no
//                           checklist for the set, so it could not join sets.json
//   /base-set.html          build-base-set.mjs, the 1999 print-run guide
//
// Add to this list when another guide is built outside /sets/, and every count
// that imports it moves with it.
export const GUIDES_OUTSIDE_SETS = ["/30th-celebration.html", "/base-set.html"];
