// Google Analytics and Google Search Console, both switched off until an id is
// pasted in below. Nothing is emitted while these are empty strings, so this
// file is safe to commit and safe to ship in the state it is in.
//
//   node scripts/build-all.mjs      after editing, to write the tags out
//
// WHY BOTH LIVE IN ONE FILE AND NOT IN shared/site.mjs. They are launch
// switches like LIVE is, but they are SECRETS OF A DIFFERENT KIND: LIVE changes
// what the site says about itself, and these two hand a third party a record of
// every visit. Keeping them apart means the diff that turns on tracking is a
// diff that is obviously about tracking, rather than one line inside a file
// twenty builders import for the domain name.
//
// ---------------------------------------------------------------------------
// GA4_ID -- Google Analytics 4, the "G-" measurement id
// ---------------------------------------------------------------------------
// Get it at analytics.google.com: Admin -> Data streams -> Web -> the stream
// for garbagerips.com. It looks like G-XXXXXXXXXX. It is NOT the "GT-" tag id
// and NOT the numeric property id; both of those are commonly pasted here by
// mistake and both silently collect nothing.
//
// WHAT IT COSTS, because this site measures things rather than assuming them
// and because the same objection has already removed a third-party request
// here once. CLAUDE.md records the ytimg preconnect being taken out on the
// grounds that "a tile served at page load is a request to a third party on
// every visit". gtag.js is a bigger version of exactly that: roughly 100KB
// over two requests, on all 1,491 pages, to a host we do not control, for
// every reader on every visit.
//
// IT IS STILL THE RIGHT CALL AND THE REASON IS THE SET GUIDES. This site's
// whole SEO argument is that the guides earn search traffic, and there is no
// way to tell whether that is working without a record of what people actually
// land on. Flying blind on launch costs more than 100KB does. But load it the
// cheap way, which is what the snippet below does:
//   - `async`, so it never blocks the parse
//   - AFTER the render-blocking stylesheet in the head, so it cannot compete
//     with ui.css for the connection (see the LCP note in CLAUDE.md: the paint
//     is gated by ui.css alone and it lands 1,226ms after the document)
//   - no `preconnect`, deliberately. A preconnect would buy a few ms of
//     analytics latency at the cost of an early connection to a third party on
//     a page whose first paint is already waiting on our own stylesheet.
//
// IF ANYBODY LATER WANTS THIS OFF THE CRITICAL PATH ENTIRELY, the honest
// alternative is a log-based or cookieless analytics service with a ~1KB
// script. That is a real option and it is not this one; do not half-migrate.
export const GA4_ID = "G-Q1D034VG72";

// ---------------------------------------------------------------------------
// SEARCH_CONSOLE -- the google-site-verification token
// ---------------------------------------------------------------------------
// ONLY NEEDED IF YOU VERIFY BY HTML TAG. There are two ways to prove the domain
// to Search Console and they are not equivalent:
//
//   DNS TXT record (recommended here)  verifies the WHOLE DOMAIN, including
//     www and any subdomain, and survives any change to the site. It is a TXT
//     record at GoDaddy, which is where the launch-day DNS work already is.
//     Leave this constant EMPTY if you use it.
//
//   HTML meta tag (this constant)      verifies ONE origin only. It works, and
//     it means the proof of ownership lives in the repo where a rebuild can
//     drop it. Use it only if the DNS route is blocked.
//
// Paste ONLY the token, not the whole tag. Google shows:
//     <meta name="google-site-verification" content="AbC123..." />
// and what goes here is AbC123...
export const SEARCH_CONSOLE = "";
