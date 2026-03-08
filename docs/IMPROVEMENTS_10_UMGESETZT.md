# 10 Verbesserungen – Umsetzung (Stand März 2025)

Kurzdokumentation der umgesetzten Punkte aus der Verbesserungsliste.

---

## 1. Lint-Warnings

- **Status:** Teilweise. Auto-fix wurde genutzt; viele `exhaustive-deps`-Warnings bleiben bewusst (stabile Refs, kein unnötiges Re-Run). Gezieltes Bereinigen pro Modul empfohlen.

## 2. Typisierung / Null-Safety

- **TicketSystem:** Typisierte Casts für Landlord-/Handworker-Tickets (`Ticket & { tenants?, properties? }`).
- **Schemas:** `contactFormSchema` und `ContactFormDataUI` für Kontaktformulare (category als Enum).
- **Deals:** `DealRecord`, `STAGES`, `stageMap`, `emptyForm` in `src/pages/deals/DealTypes.ts` ausgelagert.

## 3. Toast-System (Sonner)

- **App:** Nutzt bereits `Toaster` von `@/components/ui/sonner`. Kein Radix-Toaster im Baum.
- **Doku:** In `src/hooks/use-toast.ts` Hinweis ergänzt: Neue Implementierungen sollen `import { toast } from "sonner"` verwenden.

## 4. Formulare an zentrale Schemas

- **Kontakt:** `AddContactDialog` validiert mit `contactFormSchema` (name, email, phone, category, company, address, notes) vor Submit.
- **Schemas:** `contactFormSchema` und `ContactFormDataUI` in `src/lib/schemas.ts`; category = `["Handwerker", "Hausverwaltung", "Versicherung", "Sonstiges"]`.

## 5. Export/Backup-Spalten

- **Status:** Spalten in `DataExportBackup` (EXPORT_TABLES) entsprechen bereits den Supabase-Tabellen (z. B. tenants: `monthly_rent`, `unit_label`).
- **Doku:** Kommentar in `DataExportBackup.tsx` ergänzt – bei Schema-Änderungen hier und in `types.ts` anpassen.

## 6. Offline-Verhalten dokumentieren

- **Datei:** `docs/OFFLINE.md`.
- **Ergänzt:** Abschnitt „Konflikthandling nach Reconnect“ (Reihenfolge, Fehler, Duplikate).

## 7. Web-Push (optional)

- **Status:** Bereits umgesetzt. `src/lib/pushNotifications.ts`, `BenachrichtigungenSettings` mit Toggle „Web-Push aktivieren“; VAPID-Konfiguration erforderlich.

## 8. E2E-Tests an ROUTES

- **Status:** E2E nutzt bereits `ROUTES` aus `src/lib/routes.ts` (`e2e/auth.spec.ts`, `e2e.setup.ts`). Neue Tests sollen weiterhin ROUTES verwenden.

## 9. A11y: announce() bei kritischen Aktionen

- **PasswordSettings:** Erfolg und Fehler beim Passwort-Ändern werden per `announce()` gemeldet (polite/assertive).
- **Contacts:** Beim Löschen (Papierkorb) wird „Kontakt gelöscht“ angesagt (polite).
- Bereits vorhanden: AddPropertyDialog, AddContactDialog, AddLoanDialog, AddTenantDialog, Besichtigungen.

## 10. Große Seiten in Module aufteilen

- **Deals:** `src/pages/deals/DealTypes.ts` mit `DealRecord`, `STAGES`, `stageMap`, `emptyForm`. `Deals.tsx` importiert von dort.

---

Weitere Ideen siehe `docs/VORSCHLAEGE_FUNKTIONSVERBESSERUNGEN.md` und `docs/IMPROVEMENTS_10_FUNDAMENTAL.md`.
