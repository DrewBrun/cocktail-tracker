#!/usr/bin/env bash
set -euo pipefail

BUCKET="bluetap.com"
PREFIX="cocktails"
DIST_DIR="dist"
DATA_JSON="public/data/drinks.json"
OG_IMAGE="public/og-image.png"

echo "Building app…"
npm run build

echo "Uploading fingerprinted assets with long cache…"
aws s3 sync "$DIST_DIR/" "s3://$BUCKET/$PREFIX/" \
  --delete \
  --exclude "index.html" \
  --cache-control "public, max-age=31536000, immutable"

# --- Force correct content-types for assets (sync doesn't set them) ---
echo "Correcting content-types for JS/CSS…"
aws s3 cp "$DIST_DIR/assets/" "s3://$BUCKET/$PREFIX/assets/" \
  --recursive \
  --exclude "*" --include "*.js" \
  --content-type "application/javascript" \
  --cache-control "public, max-age=31536000, immutable" \
  --metadata-directive REPLACE

aws s3 cp "$DIST_DIR/assets/" "s3://$BUCKET/$PREFIX/assets/" \
  --recursive \
  --exclude "*" --include "*.css" \
  --content-type "text/css" \
  --cache-control "public, max-age=31536000, immutable" \
  --metadata-directive REPLACE
# (Optional) source maps
# aws s3 cp "$DIST_DIR/assets/" "s3://$BUCKET/$PREFIX/assets/" --recursive --exclude "*" --include "*.map" \
#   --content-type "application/octet-stream" --cache-control "public, max-age=31536000, immutable" --metadata-directive REPLACE

echo "Uploading index.html with no-store cache…"
aws s3 cp "$DIST_DIR/index.html" "s3://$BUCKET/$PREFIX/index.html" \
  --content-type "text/html" \
  --cache-control "no-store"

# Optional: data JSON (files-only backend)
if [[ -f "$DATA_JSON" ]]; then
  echo "Uploading data JSON…"
  aws s3 cp "$DATA_JSON" "s3://$BUCKET/$PREFIX/data/drinks.json" \
    --content-type "application/json" \
    --cache-control "no-cache"
fi

# Optional: Open Graph image for link previews
if [[ -f "$OG_IMAGE" ]]; then
  echo "Uploading OG image…"
  aws s3 cp "$OG_IMAGE" "s3://$BUCKET/$PREFIX/og-image.png" \
    --content-type "image/png" \
    --cache-control "public, max-age=3600"
fi

echo
echo "✅ Deployed to: http://$BUCKET/$PREFIX/"
echo "    Data URL:   http://$BUCKET/$PREFIX/data/drinks.json"
