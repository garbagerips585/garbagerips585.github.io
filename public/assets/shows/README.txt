Flyers for the card show calendar (/card-shows.html).

Drop the image in this folder, then put the FILENAME ONLY into the matching
event's "flyer" field in data/shows.json:

    "flyer": "pokekon-august.jpg"

Then run:  node scripts/build-shows.mjs

Any size or shape works. Portrait phone photos of a flyer on a shop counter are
fine, the page fits them without cropping the text off.

If the filename does not match a real file the build says so and simply leaves
the flyer out, rather than publishing a broken image.
