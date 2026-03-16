#!/usr/bin/env bash
# Führt xcodebuild archive und exportArchive direkt aus (ohne xcode-project Wrapper),
# damit die echte xcodebuild-Ausgabe im Log erscheint und Archiv-Fehler sichtbar sind.
# Erwartet: XCODE_WORKSPACE, XCODE_SCHEME gesetzt; xcode-project use-profiles wurde ausgeführt.
# Ausgabe: build/ios/ipa/*.ipa

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ARCHIVE_DIR="${ARCHIVE_DIR:-build/ios/xcarchive}"
IPA_DIR="${IPA_DIR:-build/ios/ipa}"
ARCHIVE_PATH="$ARCHIVE_DIR/App.xcarchive"
EXPORT_PLIST="${EXPORT_OPTIONS_PLIST:-$HOME/export_options.plist}"

mkdir -p "$ARCHIVE_DIR" "$IPA_DIR"

echo "Archive: $ARCHIVE_PATH"
xcodebuild -workspace "$XCODE_WORKSPACE" -scheme "$XCODE_SCHEME" \
  -archivePath "$ARCHIVE_PATH" \
  archive \
  COMPILER_INDEX_STORE_ENABLE=NO

echo "Export IPA to $IPA_DIR"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$IPA_DIR" \
  -exportOptionsPlist "$EXPORT_PLIST"

echo "IPA built successfully."
