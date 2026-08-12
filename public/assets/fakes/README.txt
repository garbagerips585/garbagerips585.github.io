Photos for the real vs fake guide (/fake-cards.html).

Everything on that page is currently a DIAGRAM, drawn from the physical property
each test describes, and labelled as a diagram. That is deliberate: we do not
own a confirmed counterfeit, and a photo of a fake whose provenance you cannot
verify is worth nothing on a page about verifying things.

If you photograph a real card next to a confirmed fake, drop the image here and
name it in data/fakes.json on the matching test:

    "photo": {
      "file": "back-real-vs-fake.jpg",
      "caption": "Real on the left. The fake runs purple and the swirl is soft.",
      "alt": "Two card backs side by side"
    }

Then run:  node scripts/build-fakes.mjs

Shoot both cards in the SAME frame, same light, no flash. A photo of a fake on
its own proves nothing, because the eye has nothing to calibrate against, which
is the same reason the page opens by telling people to compare.

A file named here but missing from disk is reported by the build and left out,
so a typo never ships a broken image.
