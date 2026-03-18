# ImmoMetrica-Deals automatisch in ImmoControl sehen

So bekommst du Deals aus Telegram (z. B. **ImmoMetrica** / **immometrica_bot**) automatisch in die ImmoControl Deals-Ansicht.

## Variante A: Du bekommst die Deals privat von @immometrica_bot

Wenn du die Deal-Nachrichten **privat** von **@immometrica_bot** erhältst:

1. **Eigenen Bot** bei @BotFather erstellen und Token kopieren.
2. In **ImmoControl → Einstellungen → Telegram**: Bot-Token eintragen, **Webhook aktivieren** (und optional „Auto-Import Deals“ anlassen).
3. **Weiterleiten:** Jede Deal-Nachricht von @immometrica_bot **an deinen Bot** weiterleiten (Rechner auf die Nachricht → „Weiterleiten“ → deinen Bot auswählen).
4. Die weitergeleiteten Nachrichten werden automatisch erkannt und als Deals in deiner App gespeichert – auch aus dem **privaten Chat** mit deinem Bot. Kein eigener Kanal oder Gruppe nötig.

---

## Variante B: Kanal oder Gruppe (eigener Kanal / weitergeleitete Posts)

Dein **eigener** Telegram-Bot muss **Nachrichten aus dem Kanal/der Gruppe erhalten**:

- **Du bist Admin des Kanals** (z. B. eigener Kanal oder Gruppe „ImmoMetrica“) → Bot als Admin hinzufügen, dann funktioniert alles wie unten beschrieben.
- **ImmoMetrica ist ein öffentlicher Kanal, den du nicht leitest** → Du kannst:
  - einen **eigenen privaten Kanal oder eine Gruppe** anlegen (z. B. „ImmoMetrica für mich“),
  - Posts aus dem öffentlichen ImmoMetrica-Kanal dorthin **weiterleiten**,
  - deinen Bot in **diese** Gruppe/diesen Kanal als Admin einladen und in ImmoControl den Kanal-Filter auf den **Namen dieser Gruppe/dieses Kanals** setzen.

---

## Schritte in ImmoControl

### 1. Bot erstellen und Token holen

1. In Telegram **@BotFather** öffnen.
2. `/newbot` senden und Namen/Benutzernamen für deinen Bot wählen.
3. Den **Token** (lange Zeichenkette wie `123456:ABC-DEF1234...`) kopieren.

### 2. Bot in den Kanal/ die Gruppe einladen

- **Eigenen Kanal/Gruppe:** Kanal/ Gruppe öffnen → Verwalten → Administratoren → Administrator hinzufügen → deinen Bot auswählen (z. B. über @dein_bot_name). Dem Bot die Berechtigung geben, Nachrichten zu lesen (bzw. als Admin reicht meist).
- **Weiterleitung aus ImmoMetrica:** Wie oben einen eigenen Kanal oder eine Gruppe anlegen, deinen Bot dort als Admin hinzufügen und ImmoMetrica-Posts dorthin weiterleiten.

### 3. In ImmoControl einrichten

1. **Einstellungen** → **Telegram** öffnen.
2. **Bot-Token** einfügen (von BotFather).
3. **Kanal-Filter:** Wenn dein Kanal/Gruppe „ImmoMetrica“ oder „immometrica“ im Titel enthält, reicht der Standardwert **ImmoMetrica**. Sonst den exakten Teil des Kanal-/Gruppennamens eintragen (Groß-/Kleinschreibung egal).
4. **„Auto-Import Deals“** aktiviert lassen → beim Öffnen der **Deals-Seite** werden neue Nachrichten abgerufen und als Deals angeboten/angelegt.
5. **„Webhook aktivieren“** klicken → dann werden neue Kanal-Nachrichten **auch bei geschlossener App** serverseitig verarbeitet und als Deals gespeichert.

### 4. Deals ansehen

- **Mit Webhook:** Neue Deals erscheinen automatisch in der App (Deals-Seite), auch wenn du die App nicht offen hattest.
- **Ohne Webhook (nur Auto-Import):** Beim Öffnen der Deals-Seite werden neue Nachrichten geholt und als Deals importiert; du siehst sie in der Pipeline (z. B. „Recherche“).

---

## Kurzfassung

| Schritt | Aktion |
|--------|--------|
| 1 | Bei @BotFather Bot erstellen, Token kopieren |
| 2 | Bot als Admin in **deinen** Kanal/Gruppe einladen (in dem ImmoMetrica-Posts ankommen) |
| 3 | Einstellungen → Telegram: Token eintragen, Kanal-Filter z. B. „ImmoMetrica“ oder „immometrica“, Webhook aktivieren |
| 4 | Deals erscheinen automatisch unter **Deals** in der App |

Wenn der Kanal-Filter zum Kanal-/Gruppennamen passt und der Bot Admin ist, werden eingehende Nachrichten im ImmoMetrica-Format geparst und als Deals in deinem Account gespeichert.
