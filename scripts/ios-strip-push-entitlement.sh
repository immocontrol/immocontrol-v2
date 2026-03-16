#!/usr/bin/env bash
# Workaround: Entfernt aps-environment aus App.entitlements, damit der Build mit einem
# Provisioning Profile ohne Push Notifications durchläuft.
# Nur ausführen, wenn BUILD_WITHOUT_PUSH_CAPABILITY=1 gesetzt ist (Codemagic: Env-Variable).
# Danach: Im Apple Developer Portal Push für die App-ID aktivieren, Profil neu erzeugen,
# diese Variable wieder entfernen und neu bauen. Siehe docs/IOS_APPSTORE.md.

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENTITLEMENTS="$REPO_ROOT/ios/App/App/App.entitlements"

if [ "${BUILD_WITHOUT_PUSH_CAPABILITY}" != "1" ]; then
  exit 0
fi

if [ ! -f "$ENTITLEMENTS" ]; then
  echo "App.entitlements nicht gefunden. Überspringe."
  exit 0
fi

if grep -q "aps-environment" "$ENTITLEMENTS"; then
  /usr/libexec/PlistBuddy -c "Delete :aps-environment" "$ENTITLEMENTS" 2>/dev/null || true
  echo "Hinweis: aps-environment aus App.entitlements entfernt (BUILD_WITHOUT_PUSH_CAPABILITY=1). Push erst nach Profil-Fix wieder aktiv."
fi
