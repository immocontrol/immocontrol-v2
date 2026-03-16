#!/usr/bin/env bash
# Behebt Xcode 15+ Fehlschlag beim Archivieren: Die Build-Phase "[CP] Embed Pods Frameworks"
# hat keine Outputs, sodass "Based on dependency analysis" zu Problemen führt.
# Setzt alwaysOutOfDate = 1 für diese Phase, damit sie zuverlässig ausgeführt wird.
# Voraussetzung: cap sync ios und pod install wurden ausgeführt (ios/App existiert).
# Läuft in Codemagic nach "Push Notifications aktivieren".

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PBXPROJ="$REPO_ROOT/ios/App/App.xcodeproj/project.pbxproj"

if [ ! -f "$PBXPROJ" ]; then
  echo "project.pbxproj nicht gefunden (ios/App). Überspringe CocoaPods-Embed-Fix."
  exit 0
fi

# Prüfen, ob die [CP] Embed Pods Frameworks Phase bereits alwaysOutOfDate hat (idempotent)
if awk '/\[CP\] Embed Pods Frameworks/,/^[[:space:]]*};/ { if (/alwaysOutOfDate/) found=1 } END { exit !found }' "$PBXPROJ"; then
  echo "[CP] Embed Pods Frameworks hat bereits alwaysOutOfDate. Nichts zu tun."
  exit 0
fi

# Füge alwaysOutOfDate = 1 in der [CP] Embed Pods Frameworks Build-Phase ein
# (direkt nach der Zeile mit name = "[CP] Embed Pods Frameworks";)
if grep -q 'name = "\[CP\] Embed Pods Frameworks";' "$PBXPROJ"; then
  perl -i -0pe 's/(name = "\[CP\] Embed Pods Frameworks";)(\s*\n)/$1$2\t\t\t\talwaysOutOfDate = 1;$2/g' "$PBXPROJ"
  echo "project.pbxproj: alwaysOutOfDate = 1 für [CP] Embed Pods Frameworks gesetzt."
else
  echo "Hinweis: [CP] Embed Pods Frameworks Phase nicht gefunden (evtl. keine Pods). Überspringe."
fi
