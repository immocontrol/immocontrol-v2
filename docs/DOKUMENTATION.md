# Dokumentationsrichtlinien (ImmoControl)

Alle Änderungen werden transparent und konsistent dokumentiert.

## Zentrale Dateien

| Datei | Zweck |
|-------|-------|
| **CHANGELOG.md** | Änderungshistorie (Neu, Geändert, Behoben). Vor jedem Release: Einträge in neue Version verschieben. |
| **.github/CONTRIBUTING.md** | Commit-Konventionen (Conventional Commits), Beitrags-Workflow. |
| **README.md** | Übersicht, Tech-Stack, Start, Deployment. |

## docs/ Struktur

| Datei | Inhalt |
|-------|--------|
| **ARCHITECTURE.md** | Architektur, Datenfluss. |
| **DEEPSEEK_NUTZUNG.md** | AI/DeepSeek-Funktionen, Technik. |
| **MOBILE_BREAKPOINTS.md** | Breakpoints, Dialog-Patterns, Navigation. |
| **SYNERGIEN.md** | Vernetzung zwischen Modulen (Deals↔Besichtigungen etc.). |
| **USABILITY_UND_MOBILE.md** | Usability, Touch-Targets, Browser-Optimierung. |

## Änderung dokumentieren

1. **Code** – Inline-Kommentare für komplexe Logik.
2. **CHANGELOG** – Jede relevante Änderung unter `[Unreleased]`:
   - `### Neu` – Neue Features
   - `### Geändert` – Verbesserungen, Refactoring
   - `### Behoben` – Bugfixes
3. **Commit** – Conventional Commits: `feat(bereich): Beschreibung`.

## Beispiele

```
feat(besichtigungen): Deep-Links und Todo-Synergie
fix(deals): Besichtigung bei Stage-Wechsel
docs: SYNERGIEN.md ergänzt
a11y: Touch-Targets min 44px
perf: Lazy-Load für Bilder
```
