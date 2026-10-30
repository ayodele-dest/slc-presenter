#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/build/icon.png"
ICONSET="$ROOT/build/icon.iconset"
OUTPUT="$ROOT/build/icon.icns"

rm -rf "$ICONSET"
mkdir -p "$ICONSET"

while read -r size name; do
  sips -z "$size" "$size" "$SOURCE" --out "$ICONSET/$name" >/dev/null
done <<'SIZES'
16 icon_16x16.png
32 icon_16x16@2x.png
32 icon_32x32.png
64 icon_32x32@2x.png
128 icon_128x128.png
256 icon_128x128@2x.png
256 icon_256x256.png
512 icon_256x256@2x.png
512 icon_512x512.png
1024 icon_512x512@2x.png
SIZES

iconutil -c icns "$ICONSET" -o "$OUTPUT"
rm -rf "$ICONSET"
echo "Created $OUTPUT"
