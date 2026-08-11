#!/usr/bin/env bash
# Download the site's own faces for compositing the link-preview image.
# Both are SIL Open Font License. Cached, gitignored, never deployed.
set -e
cd "$(dirname "$0")/.."
mkdir -p .cache/fonts
for pair in "TitanOne:Titan+One" "SpaceMono:Space+Mono"; do
  name=${pair%%:*}; fam=${pair#*:}
  url=$(curl -s -A "Mozilla/5.0" "https://fonts.googleapis.com/css2?family=${fam}" | grep -oE "https://[^)]*\.ttf" | head -1)
  curl -s -o ".cache/fonts/$name.ttf" "$url"
  echo "  $name.ttf"
done
