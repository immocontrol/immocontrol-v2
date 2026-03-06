# 20 sinnvolle Vorschläge für starke Funktionsverbesserungen

Basierend auf einer Analyse der Codebase und der bestehenden Features. Priorisiert nach Nutzen und Machbarkeit.

---

## 1. **Ein einheitliches Toast-System**

**Problem:** Es gibt Sonner und Radix Toast parallel; NotificationCenter hängt an einer eigenen Historie.

**Vorschlag:** Auf ein System (z. B. Sonner) standardisieren, alle Erfolgs-/Fehler-Meldungen und das NotificationCenter darüber laufen lassen. Einheitliche Dauer, Styling und ggf. „Als gelesen markieren“.

**Nutzen:** Weniger Duplikate, konsistente UX, einfachere Wartung.

---

## 2. **Gemeinsame Schemas für alle Formulare**

**Problem:** AddPropertyDialog (und andere) nutzen eigene Zod-Schemas; `schemas.ts` wird nicht überall genutzt (z. B. Typ „ZFH“ vs „DHH“).

**Vorschlag:** Alle wichtigen Formulare (Objekt, Kontakt, Darlehen, Deal, …) auf die zentralen Schemas aus `schemas.ts` umstellen, mit `zodResolver` und ggf. `validateForm`. Ein Ort für Pflichtfelder und Typen.

**Nutzen:** Einheitliche Validierung, weniger Inkonsistenzen, einfachere Anpassungen.

---

## 3. **Export/Backup-Spalten an die Datenbank anpassen**

**Problem:** DataExportBackup verwendet teils andere Spaltennamen als die DB (z. B. Tenants: `rent_amount` vs `monthly_rent`, `unit_number` vs `unit_label`).

**Vorschlag:** Export-CSV/JSON an die aktuellen Tabellen und Spalten anpassen, Spaltenliste dokumentieren (z. B. in README oder docs).

**Nutzen:** Exporte sind korrekt und für Steuerberater/Archiv nutzbar.

---

## 4. **Onboarding in die Routen und den Flow integrieren**

**Problem:** Onboarding-Komponente existiert, ist aber nicht in ROUTES; unklar, wann genau sie nach Login/Signup kommt.

**Vorschlag:** Route z. B. `/onboarding` anlegen und nach erstem Login (z. B. wenn `onboarding_completed` false) dorthin leiten. In ROUTES und Doku erwähnen.

**Nutzen:** Klarer Einstieg für neue Nutzer, bessere Conversion.

---

## 5. **TenantPortal & HandworkerPortal in den Haupt-Router**

**Problem:** Tenant- und Handwerker-Portal sind im Code vorhanden, aber nicht in den zentralen Routes in App.tsx.

**Vorschlag:** Portale in App.tsx unter klaren Pfaden (z. B. `/mieter/*`, `/handwerker/*`) registrieren oder dokumentieren, wie sie (Subdomain/Subpath) erreichbar sind.

**Nutzen:** Deep-Links, E2E-Tests und Einladungs-Links funktionieren zuverlässig.

---

## 6. **E2E-Tests an aktuelle URLs anpassen**

**Problem:** E2E nutzt z. B. `/portfolio`, `/immobilien`, `/todos` – die App nutzt `/`, `/objekt`, `/aufgaben`.

**Vorschlag:** In `e2e.setup.ts` (und allen E2E-Dateien) die Pfade auf die echten ROUTES umstellen.

**Nutzen:** E2E-Tests laufen gegen die reale Navigation und finden echte Fehler.

---

## 7. **Kontakt: einheitliche Abbildung Kategorie ↔ Rolle**

**Problem:** Schema nutzt `role`, die DB `category`; Mapping ist nicht überall einheitlich.

**Vorschlag:** Eine zentrale Stelle (z. B. Kontext oder Mapper) für „role ↔ category“; Formulare und API nutzen nur diese Abbildung.

**Nutzen:** Keine falschen oder fehlenden Kategorien mehr bei Import/Export und Anzeige.

---

## 8. **Zentrale Regeln für Pflichtfelder und Datumslogik**

**Problem:** Pflichtfelder und Regeln (z. B. Enddatum > Startdatum) sind pro Form verteilt.

**Vorschlag:** Pro Entität (Vertrag, Darlehen, Mietzeitraum, …) zentrale Regeln definieren (z. B. in Schemas oder Validatoren) und in allen zugehörigen Formularen nutzen.

**Nutzen:** Weniger Validierungs-Lücken und einheitliches Verhalten.

---

## 9. **Offline-Verhalten dokumentieren und ausbauen**

**Problem:** Es gibt Offline-Queue und Background-Sync; unklar ist, welche Aktionen genau gequeuet werden und wie Konflikte nach Reconnect gelöst werden.

**Vorschlag:** Kurze Doku (z. B. in docs oder README): welche Mutations gequeuet werden, Reihenfolge, Fehlerbehandlung. Optional: Offline-Queue auch für Kontakte und Darlehen (analog zu Objekten).

**Nutzen:** Vorhersehbares Verhalten und weniger Überraschungen bei schlechtem Netz.

---

## 10. **Optional: Cloud-Backup und Wiederherstellung**

**Problem:** Backup ist nur lokal (Download + autoBackup in localStorage); kein cloudgestütztes Backup.

**Vorschlag:** Option in den Einstellungen: Backup (JSON/verschlüsselt) in Supabase Storage (oder vergleichbar) speichern und „Wiederherstellen“ anbieten (mit Bestätigung).

**Nutzen:** Daten sind geräteunabhängig gesichert und wiederherstellbar.

---

## 11. **Web-Push für Benachrichtigungen**

**Problem:** Hinweise (überfällige Mieten, Vertragsende, Dokumente) erscheinen nur in der App oder per Browser-Notification, wenn die App offen ist.

**Vorschlag:** Optional Web-Push (Service Worker + Push-API) mit Abo in den Einstellungen; gleiche Ereignisse wie heute, aber auch bei geschlossenem Tab.

**Nutzen:** Wichtige Fristen werden nicht verpasst.

---

## 12. **Zentrale Benachrichtigungs-Einstellungen**

**Problem:** Verschiedene Kanäle (Browser, Telegram, in-app) und Themen (Mieten, Verträge, Dokumente, …) sind nicht an einem Ort steuerbar.

**Vorschlag:** Eine Seite/ Sektion „Benachrichtigungen“: pro Kanal (Browser, Telegram, in-app) und pro Thema ein-/ausschaltbar.

**Nutzen:** Nutzer können Störungen reduzieren und trotzdem nichts Wichtiges verpassen.

---

## 13. **Optionale Nutzungs-Analyse (Privacy-first)**

**Problem:** Es gibt nur Fehler-Tracking; keine Kennzahlen zu Nutzung (z. B. welche Berichte genutzt werden, ob Deals konvertiert werden).

**Vorschlag:** Leichte, optionale Event-Erfassung (z. B. „Bericht erstellt“, „Deal → Objekt“, „Export ausgeführt“) ohne personenbezogene Daten; Auswertung nur aggregiert; Opt-in in den Einstellungen.

**Nutzen:** Bessere Entscheidungen für Produkt und UX.

---

## 14. **i18n-Vorbereitung (falls mehr Sprachen geplant)**

**Problem:** Alle Texte sind fest auf Deutsch im Code; keine Struktur für weitere Sprachen.

**Vorschlag:** Wenn EN oder weitere Sprachen geplant sind: Strings in Keys auslagern und eine schlanke i18n-Lösung (z. B. react-i18next oder eigene kleine Schicht) einführen; schrittweise pro Seite/Modul.

**Nutzen:** Späterer Mehrsprachen-Support ohne Großrefactoring.

---

## 15. **Barrierefreiheit: systematische Ansagen**

**Problem:** Es gibt `announce()` und AccessibilityProvider; nicht überall werden wichtige Zustandsänderungen angesagt.

**Vorschlag:** Bei kritischen Aktionen (Speichern, Löschen, Fehler, Wechsel der Hauptbereiche) gezielt `announce()` mit kurzem, prägnantem Text nutzen; einheitliche Muster in einer kleinen Doku.

**Nutzen:** Bessere Nutzbarkeit mit Screenreadern.

---

## 16. **Eigene Route für die Objektliste**

**Problem:** Objekte sind vor allem über Dashboard und `/objekt/:id` erreichbar; keine dedizierte Liste unter eigenem Pfad.

**Vorschlag:** Route z. B. `/objekte` oder `/immobilien` für eine reine Objektliste (Filter, Sortierung, Kartenansicht optional).

**Nutzen:** Klarere Informationsarchitektur und bessere Verlinkbarkeit.

---

## 17. **DATEV- und Anlage-V-Export prüfen und absichern**

**Problem:** DATEV- und Anlage-V-Exporte existieren; unklar, ob Formate und Felder aktuell und vollständig sind.

**Vorschlag:** Anforderungen (z. B. DATEV-Format, Anlage V) dokumentieren, Exporte darauf prüfen und ggf. anpassen; mindestens einen manuellen Test pro Jahr/Version.

**Nutzen:** Steuerlich und rechtlich belastbare Exporte.

---

## 18. **Übersicht zu RLS und Validierung**

**Problem:** Frontend-Validierung und Supabase/RLS-Regeln sind nirgends zusammengefasst.

**Vorschlag:** Ein kurzes Doku-Dokument: welche Felder pro Tabelle Pflicht sind, welche RLS-Regeln gelten, und wo im Frontend dieselben Regeln abgebildet sind.

**Nutzen:** Weniger Diskrepanzen zwischen Frontend und Backend, weniger 400/403 überraschungen.

---

## 19. **Mobile: Breakpoints und Dialog-Pattern dokumentieren**

**Problem:** Es gibt viele mobile Komponenten (Bottom Sheet, Dialog, …); Regeln, wann was genutzt wird, sind nicht festgehalten.

**Vorschlag:** Kurze Doku: Breakpoints (z. B. 639px / 1024px), wann Bottom Sheet vs. Dialog, wann kompakte Nav; als Referenz für neue Features.

**Nutzen:** Einheitliches Verhalten auf Mobil und weniger Doppel-Implementierungen.

---

## 20. **Einheitliches Fehler- und Rückgängig-Erlebnis**

**Problem:** Bei fehlgeschlagenen Mutations und bei „Rückgängig“ gibt es unterschiedliche Muster (UndoToast, mutationErrorHandler, manuelle Toasts).

**Vorschlag:** Ein klares Muster: Fehlermeldung + optional „Erneut versuchen“; bei löschbaren Aktionen konsequent Undo anbieten; z. B. in einer kleinen UX-Richtlinie festhalten und schrittweise umsetzen.

**Nutzen:** Nutzer wissen immer, was passiert ist und was sie tun können.

---

## Priorisierung (Vorschlag)

| Priorität | Nr.  | Kurztitel                    |
|----------|------|------------------------------|
| Hoch     | 2, 3 | Schemas, Export/Backup       |
| Hoch     | 4, 5 | Onboarding, Portale-Routes  |
| Hoch     | 9, 20| Offline-Doku, Fehler/Undo   |
| Mittel   | 1, 7 | Toast, Kontakt Kategorie    |
| Mittel   | 6, 16| E2E-Pfade, Objektliste-Route|
| Mittel   | 10, 11, 12 | Cloud-Backup, Push, Benachrichtigungs-Einstellungen |
| Niedrig  | 8, 13–19 | Validierung, Analytics, i18n, A11y, DATEV, RLS-Doku, Mobile-Doku |

---

## Umsetzungsstand (nach Refactor & Implementierung)

| Nr. | Kurztitel              | Status |
|-----|------------------------|--------|
| 1   | Toast-System           | Sonner durchgängig genutzt; NotificationCenter unverändert (schrittweise vereinheitlichen) |
| 2   | Gemeinsame Schemas     | ✅ AddPropertyDialog nutzt `addPropertyFormSchema` aus schemas.ts |
| 3   | Export/Backup-Spalten  | ✅ An DB angepasst; Doku-Referenz in DataExportBackup |
| 4–7, 9, 16 | wie zuvor | ✅ |
| 8   | Zentrale Validierung   | ✅ `validateDateRange()` in validation.ts; Schemas zentral in schemas.ts |
| 10  | Cloud-Backup           | Doku/Stub; Implementierung optional |
| 12  | Benachrichtigungen     | ✅ `docs/BENACHRICHTIGUNGEN.md` (Kanäle, Einstellungen) |
| 15  | A11y-Ansagen           | ✅ `announce()` nach Objekt anlegen (AddPropertyDialog) |
| 17  | DATEV/Anlage V         | ✅ `docs/DATEV_ANLAGE_V.md` |
| 18  | RLS/Validierung        | ✅ `docs/VALIDIERUNG_UND_RLS.md` |
| 19  | Mobile Breakpoints     | ✅ `docs/MOBILE_BREAKPOINTS.md` |
| 20  | Fehler/Undo-UX         | ✅ PropertyContext nutzt createMutationErrorHandler für alle Mutations |
| –   | AppLayout refaktoriert | ✅ navConfig.tsx |
| –   | Dashboard refaktoriert | ✅ useDashboardMetrics.ts (Metriken ausgelagert) |
| –   | Routes zentral         | ✅ src/lib/routes.ts |

---

*Stand: März 2025 – kann bei Änderungen am Produkt angepasst werden.*
