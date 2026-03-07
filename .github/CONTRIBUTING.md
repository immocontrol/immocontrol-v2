# Beitragen

Damit Änderungen auf GitHub transparent und übersichtlich bleiben, folgen wir diesen Richtlinien.

## Commit-Nachrichten (Conventional Commits)

Bitte formuliere Commit-Nachrichten klar und konsistent:

```
<typ>(<bereich>): <kurze Beschreibung>

[Optional: ausführliche Beschreibung]

- Punkt 1
- Punkt 2
```

### Typen

| Typ      | Beschreibung                    |
|----------|----------------------------------|
| `feat`   | Neue Funktion                   |
| `fix`    | Bugfix                          |
| `docs`   | Dokumentation (README, CHANGELOG) |
| `refactor` | Code-Verbesserung ohne Funktionsänderung |
| `a11y`   | Barrierefreiheit                |
| `perf`   | Performance                     |
| `chore`  | Build, Dependencies, Konfig     |

### Bereiche (Beispiele)

- `besichtigungen`, `deals`, `crm`, `kontakte`, `dokumente`, `aufgaben`
- oder Dateiname/Modul

### Beispiele

```
feat(besichtigungen): Sortierung und Filter nach Bewertung
fix(deals): Besichtigung wird korrekt bei Stage-Wechsel angelegt
docs: CHANGELOG und CONTRIBUTING ergänzt
a11y: aria-labels für Suchfelder
refactor: handleError in mehr Komponenten verwendet
```

## CHANGELOG.md

Bei bedeutenden Änderungen den `CHANGELOG.md` aktualisieren (Abschnitt `[Unreleased]`). Vor jedem Release werden die Einträge in eine neue Version verschoben.
