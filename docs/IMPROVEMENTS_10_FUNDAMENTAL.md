# 10 fundamentale Verbesserungen (Stand März 2025)

Kernverbesserungen, die die App stabiler, zugänglicher und benutzerfreundlicher machen.

---

## 1. Onboarding-Preload

**Umsetzung:** `onboardingImport()` wurde in `preloadRoutes()` ergänzt, damit die Onboarding-Seite bereits beim ersten Navigieren vorab geladen wird.

**Datei:** `src/App.tsx`

---

## 2. A11y: announce() bei kritischen Aktionen

**Umsetzung:** Screenreader-Ankündigungen per `announce()` bei zentralen Aktionen:
- AddLoanDialog: „Darlehen wurde angelegt“
- Bereits vorhanden: AddPropertyDialog, AddContactDialog, AddTenantDialog, Besichtigungen

**Dateien:** `src/components/AddLoanDialog.tsx` (neu), weitere wie oben.

---

## 3. Keyboard-Shortcut für Objekte

**Umsetzung:** Shortcut `Alt+O` für „Navigation: Objekte“ in ShortcutSettings und KeyboardShortcutSettings.

**Dateien:** `src/components/settings/ShortcutSettings.tsx`, `src/components/settings/KeyboardShortcutSettings.tsx`

---

## 4. Cloud-Backup in Supabase Storage

**Umsetzung:** Option „Backup in Cloud speichern“ in den Backup-Einstellungen. Erstellt ein JSON-Backup aller relevanten Tabellen und lädt es in Supabase Storage (Bucket `backups`) hoch.

**Anforderung:** Der Bucket `backups` muss in Supabase angelegt und mit passenden RLS-Richtlinien versehen sein.

**Datei:** `src/components/settings/BackupSettings.tsx`

---

## 5. Benachrichtigungen-Einstellungen

**Umsetzung:** Neuer Bereich „Benachrichtigungen“ in den Einstellungen mit Kanälen: In-App, Browser, Telegram. Verweis auf `docs/BENACHRICHTIGUNGEN.md`.

**Datei:** `src/components/settings/BenachrichtigungenSettings.tsx`, `src/pages/Settings.tsx`

---

## 6. E2E-Pfade

**Status:** E2E-Tests nutzen bereits zentrale `ROUTES` aus `src/lib/routes.ts`; keine Anpassung erforderlich.

**Datei:** `e2e/auth.spec.ts`

---

## 7. Fehlerbehandlung & Undo/Retry

**Status:** Konsistente Nutzung von `handleError`, `toastErrorWithRetry` bzw. `createMutationErrorHandler` in AddLoanDialog, AddContactDialog, AddTenantDialog, CRM, Besichtigungen, PropertyNotes, ServiceContracts u. a.

---

## 8. Empty States mit CTAs

**Status:** Empty States auf ObjekteList, Contacts und Loans enthalten bereits Links zu Deals, Besichtigungen, Objekte, CRM usw. Keine Änderung nötig.

---

## 9. Zentrale ROUTES

**Status:** `src/lib/routes.ts` dient als zentrale Quelle für alle Routen; App und E2E nutzen diese Konstanten.

---

## 10. Dokumentation

**Dokumente:**  
- `docs/VORSCHLAEGE_FUNKTIONSVERBESSERUNGEN.md` – alle 20 Vorschläge  
- `docs/IMPROVEMENTS_2025-03.md` – Verbesserungen März 2025  
- `docs/BENACHRICHTIGUNGEN.md` – Benachrichtigungs-Kanäle  
- `docs/IMPROVEMENTS_10_FUNDAMENTAL.md` – diese Übersicht
