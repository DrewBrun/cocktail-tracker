
#!/usr/bin/env bash
set -euo pipefail

# =============================
# Config (overridable via env)
# =============================
BUCKET="${BUCKET:-bluetap.com}"
PREFIX="${PREFIX:-cocktails}"         # e.g. cocktails or cocktails2
DIST_DIR="${DIST_DIR:-dist}"

# Optional local files for convenience (uploaded if present)
DATA_JSON="${DATA_JSON:-public/data/drinks.json}"
DATA_PARTIES="${DATA_PARTIES:-public/data/parties.json}"            # NEW
DATA_PARTYDRINKS="${DATA_PARTYDRINKS:-public/data/partyDrinks.json}" # NEW
FAVICON="${FAVICON:-public/favicon.svg}"
OG_IMAGE="${OG_IMAGE:-public/og-image.png}"

# =============================
# Derived settings
# =============================
S3_PREFIX="s3://$BUCKET/$PREFIX/"
BASE_PATH="/${PREFIX}/"                 # vite base
DATA_BASE="/${PREFIX}/data"            # fetch base for JSON

# =============================
# Build with Vite base/data paths
# =============================
export VITE_BASE_PATH="$BASE_PATH"
export VITE_DATA_BASE_URL="$DATA_BASE"

echo "Building with VITE_BASE_PATH=$VITE_BASE_PATH and VITE_DATA_BASE_URL=$VITE_DATA_BASE_URL …"
npm run build

# =============================
# Upload assets
# =============================
aws s3 sync "$DIST_DIR/" "$S3_PREFIX" \
  --delete \
  --exclude "index.html" \
  --cache-control "public, max-age=31536000, immutable"

# Correct MIME types for JS/CSS
aws s3 cp "$DIST_DIR/assets/" "$S3_PREFIX/assets/" \
  --recursive --exclude "*" --include "*.js" \
  --content-type "application/javascript" \
  --cache-control "public, max-age=31536000, immutable" \
  --metadata-directive REPLACE || true

aws s3 cp "$DIST_DIR/assets/" "$S3_PREFIX/assets/" \
  --recursive --exclude "*" --include "*.css" \
  --content-type "text/css" \
  --cache-control "public, max-age=31536000, immutable" \
  --metadata-directive REPLACE || true

# Upload index.html with no-store
aws s3 cp "$DIST_DIR/index.html" "${S3_PREFIX}index.html" \
  --content-type "text/html" \
  --cache-control "no-store"

# Optional files
# Optional files
if [[ -f "$DATA_JSON" ]]; then
  aws s3 cp "$DATA_JSON" "${S3_PREFIX}data/drinks.json" \
    --content-type "application/json" \
    --cache-control "no-cache"
fi

# NEW: parties.json
if [[ -f "$DATA_PARTIES" ]]; then
  aws s3 cp "$DATA_PARTIES" "${S3_PREFIX}data/parties.json" \
    --content-type "application/json" \
    --cache-control "no-cache"
fi

# NEW: partyDrinks.json
if [[ -f "$DATA_PARTYDRINKS" ]]; then
  aws s3 cp "$DATA_PARTYDRINKS" "${S3_PREFIX}data/partyDrinks.json" \
    --content-type "application/json" \
    --cache-control "no-cache"
fi

if [[ -f "$FAVICON" ]]; then
  aws s3 cp "$FAVICON" "${S3_PREFIX}favicon.svg" \
    --content-type "image/svg+xml" \
    --cache-control "public, max-age=31536000, immutable"
fi

if [[ -f "$OG_IMAGE" ]]; then
  aws s3 cp "$OG_IMAGE" "${S3_PREFIX}og-image.png" \
    --content-type "image/png" \
    --cache-control "public, max-age=3600"
fi

echo
echo "✅ Deployed to: http://$BUCKET/$PREFIX/"
echo "   Data URL   : http://$BUCKET/$PREFIX/data/drinks.json"

