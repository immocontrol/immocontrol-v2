#!/usr/bin/env bash
# Setzt NSFaceIDUsageDescription in Info.plist – erforderlich, damit Face ID in der iOS-App funktioniert.
# Ohne diesen Key erlaubt iOS die Nutzung von Face ID nicht (WebAuthn/Plattform-Authenticator bleibt deaktiviert).
# Voraussetzung: cap sync ios wurde ausgeführt (ios/App existiert).
set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST="$REPO_ROOT/ios/App/App/Info.plist"
FACE_ID_MSG="ImmoControl nutzt Face ID bzw. Touch ID, um den Zugang zur App nach dem Anmelden zu schützen."

if [ ! -f "$PLIST" ]; then
  echo "Info.plist nicht gefunden ($PLIST). Überspringe Face-ID-Usage-Description."
  exit 0
fi

/usr/libexec/PlistBuddy -c "Delete :NSFaceIDUsageDescription" "$PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :NSFaceIDUsageDescription string $FACE_ID_MSG" "$PLIST"
echo "NSFaceIDUsageDescription in Info.plist gesetzt (Face ID aktiviert)."
