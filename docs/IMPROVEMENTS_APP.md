# App-weite Verbesserungen

Zusammenfassung der durchgeführten Verbesserungen an der gesamten App.

## Fehlerbehandlung

- **Berichte (PDF-Export):** `handleError` + `toastErrorWithRetry` – bei Fehlern beim PDF-Erstellen kann der Nutzer erneut versuchen.
- **useInfiniteScroll:** `handleError` für zentrales Fehlertracking bei Ladefehlern.
- **PasswordSettings:** `handleError` + `toastErrorWithRetry` bei Passwort-Änderung.

## Barrierefreiheit (A11y)

- **Dialog:** Close-Button sr-only Text von „Close“ auf „Schließen“ geändert.
- **Sheet:** Close-Button sr-only Text von „Close“ auf „Schließen“ geändert.

## Weitere geplante Verbesserungen

(siehe `docs/VORSCHLAEGE_FUNKTIONSVERBESSERUNGEN.md` und die Analyse in den Agent-Transcripts)
