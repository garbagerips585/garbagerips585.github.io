/* THE CHANNEL PITCH: ONE LINE OF REASON, THEN THE SUBSCRIBE BUTTON.
 * 11 November 2026, approved by the owner.
 *
 * WHAT WAS MEASURED. The red Subscribe pill is in the sticky bar of every
 * page, and the only sentence on the site saying WHY anybody would press it
 * ("A new rip every day. 365, no days off.") is in the footer, 93 to 99% of
 * the way down the page. A rip page had a Subscribe under the player with no
 * reason beside it, and a set guide had none in the body at all.
 *
 * THE CLAIM IS THE FOOTER'S AND NOTHING NEW. footer() in shared/chrome.mjs
 * records how "a new rip every day" was counted off videos.json before it was
 * allowed onto every page. Every line a builder passes in here repeats that
 * claim or says something the builder can check from its own data (a set
 * guide only says "we are still opening" a set whose newest rip is recent).
 * No number, no subscriber count, no pull rate.
 *
 * IT IS NOT A FIFTH SUBSCRIBE CONTROL ON A RIP PAGE. The button that used to
 * sit first in .rip-nav moved into this block; nothing was added there. On a
 * set guide it is the first Subscribe in the body, under the list of that
 * set's rips, and only where the set has a rip to show.
 *
 * .btn-sub, AND ONLY .btn-sub. The red is fenced in assets-source/ui.css (the
 * --yt-red block) to the Subscribe controls that point at SUBSCRIBE; this is
 * one of them, wearing the same class the footer button and the old rip page
 * button wear. Do not restyle it here.
 *
 * `line` is markup the caller has already escaped. The layout is `.pitch` in
 * assets-source/ui.css, beside .rip-nav: one row, wrapping to two on a phone.
 */
import { SUBSCRIBE, SUB_LABEL } from "./chrome.mjs";

export const PITCH_DAILY = "A new pack gets ripped on the channel every day, hit or no hit.";

export const channelPitch = (line = PITCH_DAILY) =>
  `<div class="pitch"><p class="pitch-t">${line}</p>` +
  `<a class="btn btn-sub btn-sm" href="${SUBSCRIBE}" rel="noopener" target="_blank" aria-label="${SUB_LABEL}">Subscribe</a></div>`;
