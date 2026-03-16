#!/usr/bin/env bash
# Erzeugt aus resources/ios/AppIcon-1024.png alle iOS App-Icon-Größen
# und schreibt sie nach ios/App/App/Assets.xcassets/AppIcon.appiconset/
# Voraussetzung: cap sync ios wurde ausgeführt (ios/App existiert).
# Läuft unter macOS (sips).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE="$REPO_ROOT/resources/ios/AppIcon-1024.png"
ICONSET="$REPO_ROOT/ios/App/App/Assets.xcassets/AppIcon.appiconset"

if [ ! -f "$SOURCE" ]; then
  echo "Fehler: Quell-Icon nicht gefunden: $SOURCE"
  exit 1
fi
if [ ! -d "$REPO_ROOT/ios/App" ]; then
  echo "Fehler: iOS-Projekt fehlt. Bitte zuerst 'cap sync ios' ausführen."
  exit 1
fi

mkdir -p "$ICONSET"
cd "$ICONSET"

# Alle benötigten Pixelgrößen (von 1024 skaliert)
sizes="20 29 40 58 60 76 80 87 120 152 167 180 1024"
for size in $sizes; do
  sips -z "$size" "$size" "$SOURCE" --out "Icon-${size}.png"
done

# Contents.json für iPhone, iPad und App Store
cat > Contents.json << 'CONTENTS_EOF'
{
  "images" : [
    { "filename" : "Icon-20.png",  "idiom" : "ipad", "scale" : "1x", "size" : "20x20" },
    { "filename" : "Icon-40.png",  "idiom" : "ipad", "scale" : "2x", "size" : "20x20" },
    { "filename" : "Icon-29.png",  "idiom" : "ipad", "scale" : "1x", "size" : "29x29" },
    { "filename" : "Icon-58.png",  "idiom" : "ipad", "scale" : "2x", "size" : "29x29" },
    { "filename" : "Icon-40.png",  "idiom" : "ipad", "scale" : "1x", "size" : "40x40" },
    { "filename" : "Icon-80.png",  "idiom" : "ipad", "scale" : "2x", "size" : "40x40" },
    { "filename" : "Icon-76.png",  "idiom" : "ipad", "scale" : "1x", "size" : "76x76" },
    { "filename" : "Icon-152.png", "idiom" : "ipad", "scale" : "2x", "size" : "76x76" },
    { "filename" : "Icon-167.png", "idiom" : "ipad", "scale" : "2x", "size" : "83.5x83.5" },
    { "filename" : "Icon-40.png",  "idiom" : "iphone", "scale" : "2x", "size" : "20x20" },
    { "filename" : "Icon-60.png",  "idiom" : "iphone", "scale" : "3x", "size" : "20x20" },
    { "filename" : "Icon-58.png",  "idiom" : "iphone", "scale" : "2x", "size" : "29x29" },
    { "filename" : "Icon-87.png",  "idiom" : "iphone", "scale" : "3x", "size" : "29x29" },
    { "filename" : "Icon-80.png",  "idiom" : "iphone", "scale" : "2x", "size" : "40x40" },
    { "filename" : "Icon-120.png", "idiom" : "iphone", "scale" : "3x", "size" : "40x40" },
    { "filename" : "Icon-120.png", "idiom" : "iphone", "scale" : "2x", "size" : "60x60" },
    { "filename" : "Icon-180.png", "idiom" : "iphone", "scale" : "3x", "size" : "60x60" },
    { "filename" : "Icon-1024.png", "idiom" : "ios-marketing", "scale" : "1x", "size" : "1024x1024" }
  ],
  "info" : { "author" : "xcode", "version" : 1 }
}
CONTENTS_EOF

echo "iOS App-Icons nach $ICONSET geschrieben."
