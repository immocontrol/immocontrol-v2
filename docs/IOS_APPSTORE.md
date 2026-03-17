# ImmoControl als iOS-App im App Store

Diese Anleitung beschreibt, wie du ImmoControl als native iOS-App im App Store veröffentlichst. Im Projekt ist **Capacitor** bereits vorbereitet; der Rest erfordert einen **Mac mit Xcode** und einen **Apple Developer Account**.

---

## Option: Build mit Codemagic (ohne eigenen Mac)

Im Projekt liegt eine **`codemagic.yaml`** für [Codemagic](https://codemagic.io). Wenn du das Repo mit Codemagic verknüpft hast:

1. **Umgebungsvariablen in Codemagic anlegen** (Application oder Team → Environment variables):
   - **Gruppe `supabase_config`** (Pflicht, damit die App auf dem Gerät funktioniert):  
     **`VITE_SUPABASE_URL`** = deine Supabase Project URL (z. B. `https://xxxx.supabase.co`).  
     **`VITE_SUPABASE_PUBLISHABLE_KEY`** = dein Supabase anon/public Key.  
     Ohne diese Werte bricht der Build im Schritt **„Supabase-Konfiguration prüfen“** ab (und die App würde auf dem Gerät „Konfiguration fehlt“ anzeigen).
   - Gruppe **`app_store_credentials`**: `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_IDENTIFIER`, `APP_STORE_CONNECT_PRIVATE_KEY` (App Store Connect API-Key, [Anleitung](https://docs.codemagic.io/code-signing-yaml/signing-ios/)).
   - Gruppe **`certificate_credentials`**: `CERTIFICATE_PRIVATE_KEY`.
   - Variable **`APP_STORE_APPLE_ID`**: Die numerische App-ID aus App Store Connect (App → General → App Information), sobald die App dort angelegt ist.

2. **`codemagic.yaml`** committen und pushen, dann in Codemagic auf **„Check for configuration file“** klicken.

3. **App-Icon:** Die Datei `resources/ios/AppIcon-1024.png` (1024×1024 PNG) muss im Repo liegen; sonst schlägt der Schritt **„App-Icon prüfen“** fehl. Der Schritt **„iOS App-Icon setzen“** erzeugt daraus alle iOS-Icongrößen.

4. Build starten (manuell oder per Push/Tag). Der Workflow baut die Web-App (Vite), synchronisiert Capacitor iOS, setzt das App-Icon und erstellt die IPA; mit gültigen Credentials wird zu TestFlight hochgeladen.

Ohne gesetzte Credentials schlägt der Schritt „Signing-Dateien holen“ oder „IPA bauen“ fehl – dann zuerst die Variablen eintragen.

**Push-Benachrichtigungen (inkl. Apple Watch):** Die App registriert sich für APNs und speichert den Geräte-Token in Supabase (`device_tokens`). In der **Codemagic-Pipeline** aktiviert das Skript **`scripts/ios-push-capability.sh`** automatisch die Push-Capability (Entitlements + `CODE_SIGN_ENTITLEMENTS`) und fügt die nötigen Methoden in **AppDelegate.swift** ein (Weitergabe des Device-Tokens an Capacitor). Du musst dafür nichts mehr manuell in Xcode einstellen.  
**Versand:** Die Edge Function **`send-push-ios`** sendet mit **`interruption-level: time-sensitive`**, sodass Benachrichtigungen auf dem iPhone und gespiegelt auf der Apple Watch erscheinen. Dafür in Supabase die Secrets `APPLE_TEAM_ID`, `APPLE_KEY_ID` und `APPLE_P8_KEY` setzen (siehe `supabase/functions/send-push-ios/README.md`).

**Fehler „Provisioning profile doesn't include the Push Notifications capability“:** Die App nutzt Push (aps-environment). Das **Provisioning Profile** in Apple muss dieselbe Capability haben. Einmalig im [Apple Developer Portal](https://developer.apple.com/account) – siehe die detaillierte Anleitung unten.

Ohne diesen Schritt schlägt der Archiv-Schritt mit „doesn't include the aps-environment entitlement“ fehl.

#### Detaillierte Anleitung: Push im Developer Portal aktivieren (Schritt für Schritt)

Du musst **zwei Dinge** tun: (A) an der **App-ID** Push aktivieren, (B) das **Provisioning Profile** so anpassen, dass es Push enthält. Beides machst du im **Apple Developer Portal** (nicht in App Store Connect, nicht in Xcode).

---

**Voraussetzung:** Du bist mit dem Apple-Developer-Account eingeloggt, der auch für Codemagic/App Store Connect genutzt wird.

---

**Teil A: Push Notifications an der App-ID aktivieren**

1. **Developer Portal öffnen**  
   Gehe zu: **[developer.apple.com/account](https://developer.apple.com/account)** und melde dich an.

2. **Zu „Identifiers“ gehen**  
   In der linken Seitenleiste: **„Certificates, Identifiers & Profiles“** (oder nur **„Identifiers“**, je nach Ansicht).  
   Dann auf **„Identifiers“** klicken (oder den Bereich **App IDs** auswählen).

3. **Die richtige App-ID finden**  
   In der Liste siehst du alle **App IDs** (Bundle IDs).  
   Suche die Zeile mit der **Identifier** (Bundle ID) **`com.immocontrol.app`** (oder deine tatsächliche Bundle ID aus der `codemagic.yaml`, z. B. `BUNDLE_ID`).  
   Klicke auf diese Zeile, um die App-ID zu **bearbeiten** (nicht „+“ für neu).

4. **Push Notifications aktivieren**  
   Auf der Bearbeitungsseite der App-ID siehst du eine Liste von **Capabilities** (z. B. App Groups, Associated Domains, **Push Notifications**, …).  
   - Finde **„Push Notifications“**.  
   - Setze den **Haken** bei **Push Notifications** (Checkbox aktivieren).  
   - Scrolle nach unten und klicke auf **„Save“** (Speichern).  
   - Bestätige ggf. den Hinweis mit **„Confirm“**.

Damit ist die **App-ID** so konfiguriert, dass sie Push Notifications nutzen darf. Das reicht aber noch nicht: Das **Provisioning Profile** wurde früher ohne Push erstellt und muss aktualisiert werden.

---

**Teil B: Provisioning Profile aktualisieren (damit es Push enthält)**

Das Provisioning Profile wurde erstellt, als die App-ID noch **kein** Push hatte. Es „merkt“ sich die Capabilities von damals. Damit der Build durchläuft, muss das Profil **neu erzeugt** werden (dann enthält es Push) – entweder per **Edit → neu generieren** oder per **Profil löschen** (Codemagic legt dann ein neues an).

---

**Variante 1: Bestehendes Profil bearbeiten und neu generieren**

| Schritt | Was du genau machst |
|--------|----------------------|
| **B1** | Im [Apple Developer Portal](https://developer.apple.com/account) links auf **„Profiles“** klicken (unter „Certificates, Identifiers & Profiles“). |
| **B2** | Du siehst eine **Liste aller Provisioning Profiles**. In der Tabelle gibt es u. a. Spalten wie **Name**, **Type**, **App ID**, **Expires**. |
| **B3** | **Das richtige Profil finden:** Suche ein Profil, bei dem **Type** = **„App Store“** (oder „iOS App Store“ / „Distribution“) ist und **App ID** zu deiner App passt (z. B. **com.immocontrol.app** oder ein Name wie „com immocontrol app ios_app_store …“). **Nicht** „Development“ oder „Ad Hoc“ wählen. Der Name kann z. B. so aussehen wie in der Fehlermeldung: **com immocontrol app ios_app_store 1773588955**. |
| **B4** | **Auf den Profil-Namen klicken** (die ganze Zeile), um die **Detailseite** dieses Profils zu öffnen. |
| **B5** | Auf der Detailseite siehst du Infos zum Profil (Name, Type, App ID, Certificate, Status, Ablaufdatum). Oben rechts gibt es einen Button **„Edit“** (Bearbeiten). **„Edit“** anklicken. |
| **B6** | Es öffnet sich ein mehrstufiger **Assistent** (z. B. „Select App ID“, „Select certificates“, „Generate“). Du musst **nichts** umstellen: Die App-ID ist schon ausgewählt (und hat jetzt Push aus Teil A), das Zertifikat bleibt. Einfach durchklicken (z. B. **„Next“** / **„Continue“**) bis du zu **„Generate“** (oder **„Save“** / **„Create“**) kommst. |
| **B7** | **„Generate“** (bzw. **„Save“**) klicken. Apple erzeugt eine **neue Version** des Profils – diese Version enthält jetzt die Push Notifications Capability, weil die App-ID sie hat. |
| **B8** | Optional: Du kannst das neue Profil **herunterladen** (**.mobileprovision**). Für Codemagic ist das nicht nötig: Beim nächsten Build lädt Codemagic die Signing-Dateien selbst neu und bekommt automatisch die neue Profil-Version. |

Fertig. Beim nächsten Codemagic-Build wird das aktualisierte Profil verwendet und der Archiv-Fehler sollte weg sein.

---

**Variante 2: Profil löschen (Codemagic erstellt ein neues)**

Wenn du **kein „Edit“** siehst, der Assistent unklar ist oder du auf Nummer sicher gehen willst, kannst du das **App-Store-Profil für deine App löschen**. Codemagic erstellt beim nächsten Build mit `fetch-signing-files … --create` ein **neues** Profil – das enthält automatisch Push, weil die App-ID (nach Teil A) Push hat.

| Schritt | Was du genau machst |
|--------|----------------------|
| **B1–B4** | Wie in Variante 1: **Profiles** öffnen, das **App Store**-Profil für **com.immocontrol.app** (bzw. den Namen wie in der Fehlermeldung) in der Liste finden und **anklicken**, damit die Detailseite aufgeht. |
| **B5l** | Auf der **Detailseite** des Profils: Unten (oder in den Aktionen) nach einem Button **„Delete“** / **„Delete Profile“** suchen und klicken. |
| **B6l** | Die Löschbestätigung bestätigen (z. B. **„Delete“** / **„Confirm“**). Das Profil verschwindet aus der Liste. |
| **B7l** | Beim **nächsten Codemagic-Build** führt Codemagic `app-store-connect fetch-signing-files "$BUNDLE_ID" --type IOS_APP_STORE --create` aus. Weil kein passendes Profil mehr existiert, **erstellt** Apple ein neues – mit allen Capabilities der App-ID, also inkl. Push Notifications. |

Danach einfach einen neuen Build in Codemagic starten; der Rest läuft automatisch.

---

**Danach**

- **Codemagic:** Einfach einen neuen **Build starten** (z. B. Push oder „Start new build“).  
  Codemagic holt sich die Signing-Dateien neu; das aktualisierte (oder neu erstellte) Profil enthält jetzt Push, und der Archiv-Schritt sollte durchlaufen.  
- Die Umgebungsvariable **`BUILD_WITHOUT_PUSH_CAPABILITY`** kannst du in Codemagic wieder **entfernen**, falls du den Workaround genutzt hattest.

**Workaround (nur bis zum Profil-Fix):** In Codemagic eine **Umgebungsvariable** setzen: **`BUILD_WITHOUT_PUSH_CAPABILITY=1`**. Dann wird vor dem Archiv das Push-Entitlement entfernt und der Build läuft mit dem bestehenden Profil durch – die App hat in diesem Build **keine** Push-Benachrichtigungen. Sobald du im Developer Portal Push aktiviert und das Profil neu erzeugt hast, Variable wieder löschen und neu bauen.

**E-Mail für Build-Benachrichtigungen:** In der `codemagic.yaml` ist ein Platzhalter für die E-Mail-Empfänger. Entweder in Codemagic unter **Publishing** → **Email notifications** deine E-Mail eintragen oder in der YAML die Zeile `recipients:` mit deiner E-Mail anpassen.

### TestFlight: Checkliste in App Store Connect (einmalig)

Damit der Build nach dem Upload automatisch zur **externen TestFlight-Betareview** eingereicht werden kann, müssen in App Store Connect ausgefüllt sein:

| Wo | Was |
|----|-----|
| **TestFlight** → **Testinformationen** | **Feedback-E-Mail** (Beta App Information) |
| | **Beta App Review Information:** Vorname, Nachname, Telefon, E-Mail |
| | **Beschreibung der Beta-App** (Beta App Description) – kurze Beschreibung der App für Tester |
| **Build** | **Export Compliance** – siehe Abschnitt unten |

Fehlt eines davon, schlägt der Schritt „Submit build to TestFlight beta review“ mit einer 422-Meldung von Apple fehl.

#### Export Compliance (Verschlüsselung)

**1. Dauerhaft im Build (bereits umgesetzt)**  
In der `codemagic.yaml` wird vor dem IPA-Build gesetzt:
- **Info.plist:** `ITSAppUsesNonExemptEncryption = false` (nur Standard-Verschlüsselung wie HTTPS, keine Deklarationspflicht).
- **Xcode:** Build-Setting `INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO`.

Damit teilst du Apple mit, dass die App keine eigene/nicht-standardisierte Verschlüsselung nutzt.

#### Face ID / Touch ID (Biometrie-Entsperrung)

Auf der iPhone-App wird **Face ID bzw. Touch ID nativ** über das Capacitor-Plugin genutzt (nicht WebAuthn im WebView). Damit die App Face ID für die Biometrie-Entsperrung nutzen kann, muss in der **Info.plist** der Key **`NSFaceIDUsageDescription`** („Privacy - Face ID Usage Description“) gesetzt sein. Ohne diesen Key erlaubt iOS die Nutzung von Face ID nicht.

- **In der Codemagic-Pipeline** wird das automatisch erledigt (Schritt „Face-ID-Usage-Description setzen“, Script `scripts/ios-face-id-usage.sh`).
- **Lokaler Build (Xcode):** Nach `npm run cap:sync` oder `npx cap open ios` einmalig ausführen:  
  `./scripts/ios-face-id-usage.sh`  
  Alternativ in Xcode: **Info.plist** öffnen, Key „Privacy - Face ID Usage Description“ hinzufügen, Wert z. B. „ImmoControl nutzt Face ID bzw. Touch ID, um den Zugang zur App nach dem Anmelden zu schützen.“

**2. Falls Apple trotzdem „Build is missing export compliance“ meldet (einmalig)**  
Apple übernimmt den Status manchmal erst nach manueller Bestätigung:

- In **App Store Connect** → deine App **ImmoControl**.
- Entweder: **TestFlight** → den betroffenen Build auswählen → bei „Export compliance information missing“ auf **„Verwalten“** (Manage) klicken.  
  Oder: **App-Informationen** (App Information) → bei **„App-Verschlüsselungsdokumentation“** auf **+** klicken.
- Frage **„Does your app use encryption?“** beantworten: typisch **„No“** bzw. **„None of the algorithms mentioned above“**, wenn du nur HTTPS/Standard-APIs nutzt.
- Speichern. Danach sollte die Einreichung zur TestFlight-Betareview durchgehen; spätere Builds werden oft automatisch akzeptiert.

#### 422 „Another build in the same train is already in beta review“

Apple erlaubt **nur einen Build pro Version** („Train“) gleichzeitig in der TestFlight-Beta-Review. Wenn du einen neuen Build hochlädst, während ein Build derselben Version (z. B. 1.0.0) noch „In Review“ ist, antwortet die API mit 422.

**Lösung:** Version in **`package.json`** erhöhen (z. B. von `1.0.0` auf `1.0.1`), committen, pushen und einen neuen Build starten. Die Pipeline setzt die iOS-Marketing-Version aus `package.json`; der neue Build gehört dann zu einer anderen Train und kann zur Beta Review eingereicht werden.  
Alternativ: Warten, bis der aktuelle Build aus der Review ist, und danach den neuen Build erneut einreichen oder einen weiteren Build mit neuer Version starten.

### Vor der Veröffentlichung im App Store (Checkliste)

Bevor du die App zur Prüfung einreichst, in App Store Connect prüfen:

| Angabe | Wo / was |
|--------|----------|
| **Screenshots** | Für alle geforderten Gerätegrößen (iPhone, ggf. iPad) |
| **App-Beschreibung** | Kurzbeschreibung und ggf. ausführliche Beschreibung |
| **Keywords** | Suchbegriffe für die App-Suche |
| **Datenschutz-URL** | URL zu deiner Datenschutzseite (z. B. `https://deine-domain.com/datenschutz`) |
| **Support-URL** | Kontakt- oder Support-Seite (kann gleich Impressum/Kontakt sein) |
| **Kategorie** | Passende App-Kategorie (z. B. Finanzen oder Produktivität) |

Die App hat öffentliche Seiten für Datenschutz (`/datenschutz`), Impressum (`/impressum`) und Nutzungsbedingungen (`/nutzungsbedingungen`). Für die Datenschutz-URL die vollständige URL angeben (z. B. `https://app.immocontrol.de/datenschutz`).

---

## Was bereits im Projekt erledigt ist

- **Capacitor** ist in `package.json` eingetragen (`@capacitor/core`, `@capacitor/ios`, `@capacitor/cli`).
- **Konfiguration:** `capacitor.config.ts` (App-ID: `com.immocontrol.app`, App-Name: ImmoControl, Web-Verzeichnis: `dist`).
- **NPM-Scripts:**
  - `npm run ios` – baut die Web-App, synchronisiert mit dem iOS-Projekt und öffnet Xcode.
  - `npm run cap:sync` – kopiert den aktuellen Build nach `ios/`.
  - `npm run cap:ios` – Sync + Xcode öffnen.

Du musst **keine** weiteren Code- oder Config-Änderungen für Capacitor vornehmen.

---

## App-Updates: So bekommen Nutzer die neue Version

Die iOS-App lädt die Web-Inhalte aus dem **App-Bundle** (dem beim Build eingebauten `dist`-Stand). Ein Redeploy der Web-App (z. B. auf Railway) **ändert die installierte App auf dem iPhone nicht** – dafür ist immer ein **neuer App-Build** nötig.

### Was du als Entwickler tun musst

1. **Version anheben**  
   In `package.json` die `version` erhöhen (z. B. von `1.0.1` auf `1.0.2`). Die Codemagic-Pipeline übernimmt diese Version als Marketing-Version für iOS.

2. **Neuen Build erstellen**  
   Build in Codemagic starten (oder lokal: `npm run build`, `npx cap sync ios`, dann in Xcode archivieren). Der Workflow erstellt eine neue IPA und lädt sie bei konfigurierten Credentials zu **TestFlight** hoch.

3. **TestFlight / App Store**  
   - **TestFlight:** Nach dem Upload erscheint der Build in App Store Connect unter TestFlight. Dort ggf. „Beta Review“ starten, danach können Tester die neue Version installieren.  
   - **App Store:** Wenn du die Version zur Prüfung einreichst, erscheint sie nach Freigabe im App Store; Nutzer sehen sie unter **Updates** bzw. bekommen sie bei aktivierten **Automatischen Updates**.

### Was Nutzer tun (iPhone)

- **Manuell:** App Store → Tab **Updates** → bei ImmoControl auf **Aktualisieren** tippen.  
- **Automatisch:** Einstellungen → App Store → **Automatische Updates** aktivieren (dann werden App-Updates im Hintergrund installiert).

Kurz: **Neue Version in package.json → Build → TestFlight/App Store → Nutzer aktualisieren im App Store.** Es gibt keine „Live-Aktualisierung“ der App-Inhalte ohne neuen App-Release.

---

## Was du brauchst (dafür kann der Agent nichts übernehmen)

| Erforderlich | Erklärung |
|--------------|-----------|
| **Mac** | iOS-Apps baut und signiert man nur unter macOS. |
| **Xcode** | Kostenlos im Mac App Store. Ohne Xcode kein Archiv und kein Upload. |
| **Apple Developer Account** | 99 €/Jahr, [developer.apple.com](https://developer.apple.com). Nötig für Signing und App Store Connect. |
| **Rechte für Installation** | `npm install` und ggf. `npx cap add ios` brauchen Schreibrechte ins Projekt (z. B. Admin oder ein Rechner, wo du installieren darfst). |

Ohne Admin-Rechte auf deinem aktuellen PC kannst du die Schritte ab „Schritt 2“ auf einem **anderen Rechner** (z. B. Mac oder ein PC mit Rechten) ausführen und das Projekt per Git dorthin klonen.

---

## Schritt-für-Schritt (auf einem Mac mit Xcode)

### 1. Projekt vorbereiten (einmalig)

Auf einem Rechner, wo du `npm install` ausführen darfst (z. B. dein Mac oder ein Kollege):

```bash
cd /pfad/zu/immocontrol-v2
npm install
npx cap add ios
```

Damit wird der Ordner `ios/` mit dem Xcode-Projekt angelegt. Diesen Ordner am besten ins Git committen, dann haben alle das gleiche iOS-Projekt.

### 2. Web-App bauen und in die iOS-App übernehmen

```bash
npm run build
npm run cap:sync
```

Oder in einem Schritt (inkl. Xcode öffnen):

```bash
npm run ios
```

### 3. In Xcode öffnen und signieren

1. **Xcode starten** (z. B. mit `npx cap open ios` oder durch Doppelklick auf `ios/App/App.xcworkspace`).
2. Links **„App“** unter dem blauen Projekt-Icon auswählen.
3. Tab **„Signing & Capabilities“**:
   - **Team:** dein Apple-Developer-Team wählen (oder sich mit Apple-ID anmelden).
   - **Bundle Identifier** kann so bleiben (`com.immocontrol.app`) oder du änderst es einmalig (z. B. `de.deinefirma.immocontrol`). Danach nicht mehr ändern, sonst stimmt der Link zu App Store Connect nicht.
4. Oben links **„App“** als Schema auswählen und auf einem Simulator oder echten Gerät **Run** (▶), um zu testen.

### 4. App in App Store Connect anlegen (einmalig)

1. Öffne [appstoreconnect.apple.com](https://appstoreconnect.apple.com) und melde dich mit deiner Apple-Developer-ID an.
2. **Apps** → **+** → **Neue App**:
   - **Plattform:** iOS
   - **Name:** ImmoControl (oder wie die App heißen soll)
   - **Sprache:** Deutsch (Primärsprache)
   - **Bundle ID:** genau die gleiche wie in Xcode (z. B. `com.immocontrol.app`)
   - **SKU:** z. B. `immocontrol-ios` (nur für dich sichtbar)
3. App anlegen und die App-Seite öffnen.

### 5. Archiv erstellen und hochladen

1. In Xcode: **Product** → **Archive** (nur möglich, wenn ein echtes Gerät oder „Any iOS Device“ als Ziel gewählt ist, nicht Simulator).
2. Nach dem Archiv: Fenster **Organizer** öffnet sich → dein neuestes Archiv auswählen → **Distribute App**.
3. **App Store Connect** → **Upload** → Optionen belassen → bis zum Upload durchklicken.
4. Einige Minuten warten, bis der Build in App Store Connect unter **TestFlight** und dann unter der App-Version erscheint.

### 6. Version im App Store einrichten und einreichen

1. In App Store Connect: deine App → **App Store**-Tab (oder **TestFlight** nur zum Testen).
2. **+ Version** oder bestehende Version wählen (z. B. 1.0.0).
3. **Build:** den soeben hochgeladenen Build auswählen.
4. **Beschreibung, Screenshots, Kategorien, Datenschutz** etc. ausfüllen (Pflichtangaben).
5. **Zur Überprüfung einreichen**. Nach Prüfung durch Apple erscheint die App im App Store und Nutzer können sie wie jede andere iOS-App installieren.

---

## Wenn du keinen Mac hast

- **Option A:** Einen Mac leihen oder nutzen (Arbeit, Freund, Apple Store).
- **Option B:** **CI/CD mit Mac** (z. B. GitHub Actions mit macOS Runner): Build und Archiv automatisch erstellen, manuell nur noch in App Store Connect den Build auswählen und einreichen. Das Setup dafür ist in dieser Anleitung nicht beschrieben, aber möglich.
- **Option C:** Jemanden mit Mac und Apple Developer Account bitten, Schritte 2–6 einmalig (oder bei Updates) durchzuführen; du lieferst den Code per Git.

---

## Kurz: Was der Agent übernommen hat vs. was du brauchst

| Übernommen vom Agent | Musst du (oder jemand mit Mac/Account) tun |
|----------------------|-------------------------------------------|
| Capacitor-Pakete in package.json | `npm install` und `npx cap add ios` (einmalig, auf Rechner mit Rechten) |
| capacitor.config.ts | Xcode öffnen, Signing einrichten |
| NPM-Scripts (build, cap:sync, ios) | Archiv erstellen, zu App Store Connect hochladen |
| Diese Anleitung | App in App Store Connect anlegen, Metadaten, Screenshots, Einreichung |

Ohne Admin-Rechte auf deinem PC: Projekt per Git auf einen Mac (oder Rechner mit npm-Rechten) klonen und dort ab Schritt 1 durchgehen. Die Vorbereitung im Repo ist fertig.
