# Error Logging und „Copy for AI“

Fehler werden zentral erfasst und können als **Copy for AI**-Bericht in die Zwischenablage kopiert werden. Der Bericht ist so formatiert, dass er direkt in Cursor, Lovable oder andere Vibe-Coding-Tools eingefügt werden kann, um einen Fix-Vorschlag zu erhalten.

## Ablauf

1. **Fehler tritt auf** → `handleError()` (oder `trackError()`) wird aufgerufen.
2. **Toast** (nur in DEV): Neben der Fehlermeldung erscheint die Aktion **„Copy for AI“**.
3. **Klick auf „Copy for AI“** → Ein formatierter Fehlerbericht wird in die Zwischenablage kopiert.
4. **In Cursor/Lovable einfügen** → Der Assistent erhält Message, Stack, Kontext und kann konkrete Code-Änderungen vorschlagen.

## Wo „Copy for AI“ verfügbar ist

- **Fehler-Toast (DEV):** Jeder über `handleError()` behandelte Fehler zeigt in der Entwicklungsumgebung die Toast-Aktion „Copy for AI“.
- **Einstellungen → Error Scanner:**  
  - Button **„Copy for AI“** im Header kopiert den neuesten Fehler der Liste.  
  - Pro Eintrag: Bei aufgeklapptem Eintrag erscheint **„Copy for AI“** und kopiert genau diesen Fehler.

## Format des Berichts

Der kopierte Text enthält:

- **Message** – Fehlermeldung
- **Where** – Kontext (z. B. `context: supabase`), URL
- **Time** – Zeitstempel
- **Stack trace** – sofern vorhanden, als Codeblock
- **Abschluss** – kurze Anweisung für den AI-Assistenten (Projekt, gewünschte Antwort: Dateipfad + Code-Änderungen)

Beispiel:

```
## Error (paste into AI coding assistant to get a fix)

**Message:**
Failed to fetch

**Where:** context: network · https://app.example.com/objekt/123
**Time:** 07.03.2026, 14:30:00

**Stack trace:**
```
    at fetch (main.tsx:45)
    ...
```

---
Project: ImmoControl (React/TypeScript, Vite). Fix this error. Reply with exact file path and code changes.
```

## Technik

- **Quelle:** `src/lib/errorTracking.ts`  
  - `formatErrorReportForAI(entry)` – erzeugt den Text  
  - `copyErrorReportToClipboard(entry?)` – kopiert in die Zwischenablage (ohne Argument: letzter getrackter Fehler)  
  - `trackError()` gibt den erstellten Eintrag zurück (für handleError → Toast-Aktion).
- **handleError:** `src/lib/handleError.ts` – ruft `trackError` auf, zeigt in DEV die Toast-Aktion „Copy for AI“.
- **Error Scanner:** `src/components/ErrorScanner.tsx` – nutzt `copyErrorReportToClipboard` für Header- und Pro-Eintrag-Button.

Sensible Daten (Passwörter, Tokens, E-Mail) werden vor dem Speichern und im Bericht durch `sanitizeForLog()` redigiert.
