# Codemagic Build – Fehlersuche

Wenn der iOS-Build fehlschlägt, zeigt Codemagic oft nur eine Zusammenfassung (z. B. Umgebungsvariablen, Xcode/Node-Version). **Die eigentliche Fehlermeldung steht in den Build-Logs.**

## Wo du die Fehlermeldung findest

1. In **Codemagic**: Build öffnen (z. B. aus der E-Mail oder aus der Application).
2. Zum Tab **„Logs“** (oder „Build log“) wechseln.
3. **Nach unten scrollen** bis zum ersten **roten** oder fehlgeschlagenen Schritt.
4. Die **letzten Zeilen** dieses Schritts und ggf. der nächste Schritt enthalten die Fehlermeldung (z. B. `exit 1`, `error:`, `fatal:`).

Ohne diese Log-Ausgabe ist eine gezielte Fehlerbehebung kaum möglich. Am besten den **fehlgeschlagenen Schritt** und die **komplette Fehlerausgabe** (ohne Secrets) kopieren.

---

## Typische Fehler und Lösungen

| Schritt / Meldung | Ursache | Lösung |
|-------------------|--------|--------|
| **Supabase-Konfiguration prüfen** bricht ab | `VITE_SUPABASE_URL` oder Supabase-Key fehlt | In Codemagic → Environment variables eine **Gruppe `supabase_config`** anlegen und dem Workflow zuweisen. Darin: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (oder `VITE_SUPABASE_ANON_KEY`) setzen. Gruppennamen exakt wie in `codemagic.yaml` (`environment.groups`). |
| **App-Icon prüfen** / AppIcon-1024.png fehlt | Icon-Datei nicht im Repo | Datei `resources/ios/AppIcon-1024.png` (1024×1024 PNG) ins Repo committen. |
| **npm run build** schlägt fehl | Vite-Build-Fehler, fehlende Env-Vars | Logs prüfen (z. B. TypeScript/ESLint). Sicherstellen, dass `VITE_SUPABASE_*` in der **gleichen** Umgebungsgruppe wie der Build laufen (nicht nur in einer anderen Gruppe). |
| **cap add ios** / **cap sync ios** schlägt fehl | Node/Capacitor-Version, fehlende Abhängigkeiten | `npm ci` muss vorher erfolgreich laufen. Bei Fehlern in `cap sync`: Log-Ausgabe prüfen; ggf. lokal `npm run build && npx cap sync ios` testen. |
| **Keychain** / **Signing-Dateien** / **Zertifikate** | Fehlende oder falsche App-Store-/Zertifikat-Credentials | Gruppe `app_store_credentials`: `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_IDENTIFIER`, `APP_STORE_CONNECT_PRIVATE_KEY`. Gruppe `certificate_credentials`: `CERTIFICATE_PRIVATE_KEY`. `APP_STORE_APPLE_ID` (numerische App-ID) setzen. Siehe [Codemagic iOS Signing](https://docs.codemagic.io/code-signing-yaml/signing-ios/). |
| **Provisioning profile doesn't include Push** / **aps-environment** | App nutzt Push, Profil nicht | Im [Apple Developer Portal](https://developer.apple.com/account) bei der App-ID **Push Notifications** aktivieren, dann das **Provisioning Profile** neu erzeugen und in Codemagic erneut „Signing-Dateien holen“ laufen lassen. Siehe `docs/IOS_APPSTORE.md`. |
| **IPA bauen** / **xcodebuild** Fehler | Xcode-Build oder Export fehlgeschlagen | Logs von `scripts/ios-build-ipa-direct.sh` und `build/archive.log` prüfen. Häufig: Signing, fehlende Capability, falscher Scheme (`XCODE_SCHEME=App`, `XCODE_WORKSPACE=ios/App/App.xcworkspace`). |
| **export_options.plist** nicht gefunden | Export-Optionen für IPA fehlen | Wird normalerweise von Codemagic nach „Signing-Dateien holen“ bereitgestellt. Sicherstellen, dass der Schritt „Signing-Dateien von App Store Connect holen“ erfolgreich war. |

---

## Checkliste vor dem nächsten Build

- [ ] Gruppe **`supabase_config`** dem Workflow zugewiesen, mit `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY` (oder `VITE_SUPABASE_ANON_KEY`).
- [ ] Gruppen **`app_store_credentials`** und **`certificate_credentials`** gesetzt und zugewiesen.
- [ ] **`APP_STORE_APPLE_ID`** (numerische ID) gesetzt.
- [ ] **`resources/ios/AppIcon-1024.png`** im Repo.
- [ ] In Codemagic **Logs** des fehlgeschlagenen Builds prüfen und die genaue Fehlermeldung notieren.

Wenn du die **konkrete Fehlermeldung** aus den Logs (ohne Secrets) teilst, kann gezielt darauf eingegangen werden.
