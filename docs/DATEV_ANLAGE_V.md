# DATEV und Anlage V (ImmoControl)

Hinweise zu Exporten für Steuerberater und Anlage V (Vorschlag 17).

## Vorhandene Exporte

- **Berichte:** `src/pages/Berichte.tsx` — u. a. Anlage-V-Export, DATEV-relevante Auswertungen.
- **Steuer/Finanzen:** Komponenten wie `SteuerJahresabschluss`, `FinanceExport`, `AnlageVExport` (siehe Codebase).

## Prüfung

- **Formate:** DATEV- und Anlage-V-Formate können sich ändern. Vor jedem Steuerjahr prüfen: aktuelle Vorgaben der DATEV bzw. des Bundeslandes/BMF einhalten.
- **Felder:** Sicherstellen, dass exportierte Spalten und Werte (z. B. aus `rent_payments`, `properties`, Nebenkosten) den aktuellen Anforderungen entsprechen.
- **Tests:** Mindestens einen manuellen Export-Test pro Jahr bzw. nach Formatänderungen durchführen.

## Dokumentation im Code

Export-Komponenten sollten kurz im Kommentar erwähnen, welches Format bzw. welche Version angestrebt wird (z. B. „Anlage V 2024“), damit spätere Anpassungen leichter fallen.
