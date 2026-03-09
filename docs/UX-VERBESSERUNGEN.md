# UX-Verbesserungen – App so nutzerfreundlich wie möglich

Priorisierte Vorschläge für mehr User-Freundlichkeit. Kurz umsetzbar = Quick Wins, mittelfristig = Backlog.

---

## Sofort umsetzbar (Quick Wins)

### 1. **Schnellzugriff sichtbar machen**
- **Command Palette (Ctrl+K / Cmd+K):** In der Suche oder im Header einen kleinen Hinweis anzeigen: „Schnellsuche: Ctrl+K“ oder Icon mit Tooltip „Schnellsuche öffnen (Ctrl+K)“.
- **Ergebnis:** Nutzer entdecken die Schnellnavigation schneller.

### 2. **Empty States mit klarer nächster Aktion**
- Jede leere Liste/Seite sollte einen **einen** primären Button haben (z. B. „Objekt hinzufügen“, „Deal anlegen“).
- Kurzer Satz: Was hier passiert + was der Nutzer als Nächstes tun kann.
- **Prüfen:** ObjekteList, Deals, Contacts, Darlehen, Todos – überall einheitlich mit `EmptyState` + CTA.

### 3. **Löschen nur nach Bestätigung**
- Jede **destruktive Aktion** (Objekt löschen, Darlehen löschen, Kontakt löschen, Vertrag löschen) über **AlertDialog** mit Titel „Wirklich löschen?“ und kurzer Beschreibung.
- `ConfirmDialog` (destructive) konsequent nutzen; nirgends sofort löschen ohne Rückfrage.

### 4. **Formulare: Fehler freundlich und sichtbar**
- Validierungsmeldungen **in verständlicher Sprache** (z. B. „Bitte Kaufpreis eingeben“ statt „purchasePrice required“).
- Nach „Speichern“ bei Fehlern: **Scroll zum ersten Fehlerfeld** (bereits `scrollToFirstError`) + Fokus setzen.
- Optional: Zusammenfassung „3 Felder müssen ausgefüllt werden“ oben im Dialog.

### 5. **Ladezustände einheitlich**
- Wo Daten aus dem Netz geladen werden: **Skeleton** statt nur Spinner (z. B. `DashboardSkeleton`, `TablePageSkeleton`).
- Kurzer `aria-label`/`role="status"` für Screenreader: „Dashboard wird geladen“.

### 6. **Erfolgs-Feedback**
- Nach **Speichern/Anlegen/Ändern**: kurzer **Toast** (z. B. „Objekt gespeichert“, „Darlehen angelegt“) – bereits oft umgesetzt, prüfen ob überall konsistent.
- Bei asynchronen Aktionen: Button „Wird gespeichert…“ + disabled, danach Toast.

---

## Leichte Verbesserungen

### 7. **Tooltips bei Kennzahlen und Icons**
- Bei **Kaltmiete/qm**, **Cashflow**, **Rendite** etc.: kleines (i) oder Tooltip mit einer Zeile Erklärung.
- Icon-Buttons in der Nav und in Listen: `aria-label` + Tooltip mit Beschreibung (z. B. „Objekt bearbeiten“).

### 8. **Dialoge: Escape und Fokus**
- **Escape** schließt jeden Dialog (bereits Standard bei Radix).
- Beim Öffnen: **Fokus auf erstes Eingabefeld** (autofocus oder `useEffect` + `focus()`).
- Beim Schließen: Fokus zurück auf den auslösenden Button (für Tastatur-Nutzer).

### 9. **Einheitliche Bezeichnungen**
- Eine Sache = ein Begriff (z. B. überall „Kaltmiete“ statt teils „Miete“, „Nettomiete“).
- In Breadcrumbs und Seitentiteln dieselben Begriffe wie in der Navigation.

### 10. **Hilfetexte unter wichtigen Feldern**
- Bei Objekt anlegen: kurze Zeile unter Wohnfläche/Gewerbefläche (bereits: „Wohnfläche + Gewerbefläche = vermietete Fläche“).
- Bei Darlehen: „Zins + Tilgung in % p.a.“ usw. – spart Klicks in die Doku.

---

## Mittelfristig (Backlog)

### 11. **Onboarding / Ersteinrichtung**
- Nach Registrierung: **geführter erster Schritt** („Lege dein erstes Objekt an“ oder „Import aus Excel?“).
- Onboarding-Seite (Investoren-Typ, Strategie) mit **„Überspringen“** und später in Einstellungen erreichbar.

### 12. **Rückgängig (Undo)**
- Nach **Löschen** (z. B. Todo, Kontakt): Toast „X gelöscht“ mit Button **„Rückgängig“** für wenige Sekunden.
- `useUndoToast` bzw. Soft-Delete wo fachlich möglich.

### 13. **Kontextuelle Hilfe**
- Optional (i) oder „?“ bei Abschnitten (z. B. „Was ist die Peters’sche Formel?“) mit kurzer Erklärung oder Link zu Hilfe.

### 14. **Tastaturkurzbefehle sichtbar**
- In Einstellungen oder in der Command Palette: **Liste der Shortcuts** (Ctrl+K, Ctrl+N für neues Objekt, etc.).
- Tooltip bei Buttons, die einen Shortcut haben: „Objekt hinzufügen (Ctrl+N)“.

### 15. **Mobile**
- **Touch-Ziele** mind. 44×44 px für Buttons und Links.
- **Pull-to-Refresh** auf Listen-Seiten (bereits Hook vorhanden).
- Keine verschachtelten Scroll-Bereiche, die auf dem Handy verwirren.

---

## Bereits gut umgesetzt (beibehalten)

- Safe-Area für Notch (Header).
- StepIndicator bei mehrstufigen Formularen.
- Berechnete Felder klar gekennzeichnet („wird berechnet“).
- Synergien (Fristen → Benachrichtigungen, Deal-Benchmark → Steuer-Cockpit).
- Zinsalarm und Liquiditäts-Check (Monate Reserve).
- ImmoAI mit Kontext für präzisere Antworten.

---

## Priorität für die nächsten Sprints

1. **Quick Wins 1–3:** Command-Palette-Hinweis, Empty States mit CTA, Löschen nur mit Bestätigung.
2. **Quick Wins 4–6:** Formular-Fehler, Lade-Skeletons, Erfolgs-Toasts prüfen.
3. **Leicht 7–10:** Tooltips, Fokus in Dialogen, einheitliche Begriffe, Hilfetexte.
4. **Backlog 11–15:** Onboarding, Undo, Hilfe, Shortcuts-Liste, Mobile-Feinschliff.

Wenn du möchtest, können wir die Quick Wins 1–3 direkt im Code umsetzen.
