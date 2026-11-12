/* THE TWO JSON-LD SHAPES THAT WERE BEING RETYPED PER BUILDER. 11 November 2026.
 *
 * ORG_REF. An audit of the built tree found `author` (and `creator`, the same
 * claim on a Dataset) written three ways across 52 nodes:
 *
 *   30   { "@type": "Organization", "@id": ".../#org", name, url }
 *   13   { "@type": "Organization", name, url }
 *    9   { "@type": "Organization", name }
 *
 * Only the first says WHICH organization: "@id" is what ties the node to the
 * one Organization the home page and /about.html define at <site>/#org. The
 * other two describe a second and a third organization that happen to share a
 * name, which is the opposite of what a small brand trying to be one entity
 * wants. This is the first shape, in one place, for the builders that import
 * it. It is a reference, so it carries no logo or sameAs: those live on the
 * node it points at.
 *
 * breadcrumbLd. Seven indexable hubs had no BreadcrumbList at all. The shape is
 * the one the playlist, about and set builders already write by hand: every
 * step but the last carries `item`, and the last is the page itself, named and
 * not linked. Pass [name, path] pairs from the home page down.
 */
import { SITE } from "./site.mjs";

export const ORG_ID = `${SITE}/#org`;
export const ORG_REF = { "@type": "Organization", "@id": ORG_ID, name: "Garbage Rips 585", url: `${SITE}/` };

/** breadcrumbLd([["Home", "/"], ["Rarity guide"]]) -> a BreadcrumbList object. */
export const breadcrumbLd = (steps) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: steps.map(([name, path], i) => ({
    "@type": "ListItem",
    position: i + 1,
    name,
    ...(path && i < steps.length - 1 ? { item: `${SITE}${path}` } : {}),
  })),
});

/** The same, already wrapped in its <script> tag, for a builder that writes its head as a string. */
export const breadcrumbScript = (steps) =>
  `<script type="application/ld+json">${JSON.stringify(breadcrumbLd(steps))}</script>`;
