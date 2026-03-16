#!/usr/bin/env bash
# Aktiviert Push Notifications für die iOS-App (APNs) und patcht AppDelegate,
# damit der Device-Token an Capacitor übergeben wird (für Benachrichtigungen inkl. Apple Watch).
# Voraussetzung: cap sync ios wurde ausgeführt (ios/App existiert).
# Läuft in Codemagic nach "iOS App-Icon setzen".

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT/ios/App/App"
ENTITLEMENTS="$APP_DIR/App.entitlements"
DELEGATE="$APP_DIR/AppDelegate.swift"
PBXPROJ="$REPO_ROOT/ios/App/App.xcodeproj/project.pbxproj"

if [ ! -d "$REPO_ROOT/ios/App" ]; then
  echo "iOS-Projekt fehlt (ios/App). Überspringe Push-Capability."
  exit 0
fi

# 1) Entitlements: aps-environment für APNs
mkdir -p "$APP_DIR"
if [ ! -f "$ENTITLEMENTS" ]; then
  cat > "$ENTITLEMENTS" << 'ENT'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>aps-environment</key>
	<string>production</string>
</dict>
</plist>
ENT
  echo "App.entitlements erstellt (aps-environment = production)."
else
  if ! grep -q "aps-environment" "$ENTITLEMENTS"; then
    # Plist ist vorhanden, Key einfügen (vor </dict>)
    /usr/libexec/PlistBuddy -c "Add :aps-environment string production" "$ENTITLEMENTS" 2>/dev/null || \
      plutil -insert aps-environment -string production "$ENTITLEMENTS" 2>/dev/null || true
    echo "aps-environment zu App.entitlements hinzugefügt."
  fi
fi

# 2) Xcode-Projekt: CODE_SIGN_ENTITLEMENTS setzen, falls noch nicht gesetzt
if [ -f "$PBXPROJ" ] && ! grep -q "CODE_SIGN_ENTITLEMENTS" "$PBXPROJ"; then
  perl -i -0pe 's/(INFOPLIST_FILE = App\/Info\.plist;)/$1\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = App\/App.entitlements;/g' "$PBXPROJ"
  echo "CODE_SIGN_ENTITLEMENTS in project.pbxproj gesetzt."
fi

# 3) AppDelegate: Device-Token an Capacitor weitergeben (falls noch nicht vorhanden)
if [ ! -f "$DELEGATE" ]; then
  echo "AppDelegate.swift nicht gefunden. Überspringe."
  exit 0
fi

if grep -q "didRegisterForRemoteNotifications" "$DELEGATE"; then
  echo "AppDelegate enthält bereits Push-Registrierung."
  exit 0
fi

# Einfügen vor der letzten Zeile, die nur "}" enthält (Ende der AppDelegate-Klasse)
PUSH_METHODS='
  func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
  }

  func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
  }
'
# Letzte Zeile, die nur "}" (evtl. mit Whitespace) ist = Klassen-Ende
LAST_BRACE_LINE=$(grep -n '^[[:space:]]*}[[:space:]]*$' "$DELEGATE" | tail -1 | cut -d: -f1)
if [ -n "$LAST_BRACE_LINE" ]; then
  INSERT_LINE=$((LAST_BRACE_LINE - 1))
  head -n "$INSERT_LINE" "$DELEGATE" > "${DELEGATE}.tmp"
  echo "$PUSH_METHODS" >> "${DELEGATE}.tmp"
  tail -n "+$LAST_BRACE_LINE" "$DELEGATE" >> "${DELEGATE}.tmp"
  mv "${DELEGATE}.tmp" "$DELEGATE"
  echo "AppDelegate: Push-Token-Weitergabe eingefügt."
else
  echo "AppDelegate: Keine passende Zeile zum Einfügen gefunden."
fi

echo "Push-Capability und AppDelegate angepasst."
