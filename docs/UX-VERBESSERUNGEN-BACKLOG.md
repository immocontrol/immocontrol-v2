# UX-Verbesserungen – Backlog (User-Friendliness)

Konkrete Vorschläge zum späteren Abarbeiten. Priorität und Reihenfolge frei wählbar.

---

## Erledigt (Umsetzung 2025-03)

- **1. Kurz-Onboarding:** Dismissibler Hinweis „Willkommen im Portfolio“ auf dem Dashboard (localStorage „Nicht mehr anzeigen“).
- **2. Empty States:** Vorhandene Empty States mit CTA beibehalten (Kontakte, Dokumente, Deals, Berichte etc.).
- **4. Formulare Fokus:** AddLoanDialog und AddContactDialog nutzen bereits `useFocusFirstInput`; AddPropertyDialog ebenfalls. Keyboard-Aware-Scroll in AddPropertyDialog, AddTenantDialog, EditPropertyDialog, AddContactDialog, AddLoanDialog (Mobile).
- **5. Bestätigung:** Gefahrenzone Konto löschen hat bereits doppelte Bestätigung („LÖSCHEN“ tippen). Copy-Toasts überall ergänzt.
- **6. Touch-Targets:** Deals (CSV, Kanban/Liste, Deal anlegen), Contacts (Aktions-Buttons), PropertyDetail-Links mit touch-target/min-h-[44px]; aria-label für ikonische Buttons (Contacts).
- **7. Such-/Filterhilfe:** Platzhalter in Contacts („Name, Firma oder E-Mail …“), Dokumente („z. B. Mietvertrag, Adresse …“) und Filter-Tipp „Nach Kategorie oder Objekt filtern“. Deals hatte bereits guten Platzhalter.
- **8. Breadcrumbs:** PropertyDetail „Zurück zu Objekte“ (Link zu Objekte-Liste); Deals-Seite Breadcrumbs; Not-found-Ansicht ebenfalls.
- **9. Fehlermeldungen:** `handleError.ts` – verständliche Meldungen („Verbindung unterbrochen …“, „Bitte erneut versuchen“ etc.).
- **10. Tooltips Fachbegriffe:** LTV und EK-Rendite bereits mit (i)-Tooltip; Leerstand-Tooltip ergänzt. AfA-Tooltip (PropertyDetail); LTV-Title (FinanzierungsCockpit). Lade-Skeletons: Deals nutzt DealsSkeleton; PropertyDetail/CRM bereits Skeleton.

---

## 1. **Kurz-Onboarding / Tooltips bei erstem Besuch** ✅ umgesetzt

- Beim ersten Login oder ersten Besuch einer wichtigen Seite (z. B. Dashboard, Mieten & Betrieb) einen kurzen Hinweis anzeigen: „Hier siehst du …“ mit Option „Nicht mehr anzeigen“.
- Optional: einmalige Spotlight-Tour für „Objekt anlegen“, „Darlehen erfassen“, „Mieteinnahmen“ (nur wenn noch keine Daten da sind).

**Relevante Stellen:** Onboarding erweitern, Local Storage für „tour_completed“, z. B. `Dashboard.tsx`, `MietenBetriebPage.tsx`.

---

## 2. **Konsistente Empty States mit nächstem Schritt**

- Überall, wo Listen leer sein können (Kontakte, Dokumente, Aufgaben, Deals, Besichtigungen), ein einheitliches `EmptyState` mit klarem CTA („Ersten Kontakt anlegen“, „Dokument hochladen“, etc.).
- Kurzer Satz, warum die Seite leer ist und was der Nutzer als Nächstes tun kann.

**Relevante Stellen:** Prüfen aller Pages auf fehlende oder uneinheitliche Empty States; `EmptyState.tsx` ggf. um Varianten erweitern.

---

## 3. **Ladezustände und Skeleton einheitlich**

- Lange Listen und schwere Seiten (PropertyDetail, CRM, Deals) mit Skeleton/Loading-State statt nur „Laden…“.
- Einheitliches Muster: z. B. `PageSkeleton` oder `MobilePageSkeletons` überall nutzen, wo Daten asynchron geladen werden.

**Relevante Stellen:** `PageSkeleton.tsx`, `MobilePageSkeletons.tsx`; jede Page mit `loading`/`isPending` prüfen.

---

## 4. **Formulare: Fokus und Reihenfolge**

- Beim Öffnen von Dialogen (Objekt anlegen, Darlehen, Kontakt, etc.) automatisch erstes fokussierbares Feld fokussieren (`useFocusFirstInput` oder `autoFocus`).
- Logische Tab-Reihenfolge in mehrspaltigen Formularen prüfen (Tab durch alle Felder ohne Sprünge).

**Relevante Stellen:** `useFocusFirstInput`, `AddPropertyDialog`, `AddLoanDialog`, `AddContactDialog`, alle größeren Dialoge.

---

## 5. **Bestätigung und Rückmeldung bei Aktionen**

- Nach „Speichern“ / „Löschen“ / „Export“ kurze, klare Toast-Meldung (bereits oft vorhanden; Lücken schließen).
- Bei kritischen Aktionen (Konto löschen, Objekt löschen) doppelte Bestätigung (z. B. „Löschen“-Button erst nach Eingabe eines Bestätigungstexts aktiv).

**Relevante Stellen:** Alle `mutate`/`onSuccess`-Stellen; Gefahrenzone in Settings; ggf. `AlertDialog`-Pattern überall für Löschen.

---

## 6. **Mobile: Größere Touch-Targets und Abstände**

- Buttons und klickbare Bereiche mind. 44×44 px (bereits teilweise `touch-target`/`min-h-[44px]`; konsequent prüfen).
- Abstand zwischen klickbaren Elementen auf kleinen Screens, damit kein versehentliches Antippen passiert.

**Relevante Stellen:** Suche nach Buttons/Links ohne `min-h-[44px]` oder `touch-target`; `.cursor/rules/text-no-clip.mdc` (nav-label-responsive) beachtet lassen.

---

## 7. **Such- und Filterhilfe**

- Bei Seiten mit vielen Einträgen (Kontakte, Dokumente, Verträge, Deals): Platzhalter im Suchfeld mit Beispiel (z. B. „Name, Firma oder E-Mail …“).
- Optional: kurzer Hinweis „Tipp: Filter nach Kategorie“ unter dem Filter, wenn viele Kategorien existieren.

**Relevante Stellen:** `Contacts.tsx`, `Dokumente.tsx`, `Vertraege.tsx`, `Deals.tsx`, `GlobalSearch.tsx`.

---

## 8. **Breadcrumbs / Kontext auf Unterseiten**

- Auf Unterseiten (Objekt-Detail, Deal-Detail, Kontakt-Detail) eine kurze Breadcrumb oder „Zurück zu [Liste]“, damit der Nutzer den Kontext behält.
- Mobile: „Zurück“-Button mit sinnvollem Ziel (nicht nur Browser-Back).

**Relevante Stellen:** `PropertyDetail.tsx`, `Deals.tsx` (Detail-Ansicht), `Contacts.tsx`; `MobileBreadcrumbNav.tsx`, `Breadcrumbs.tsx` gezielt einsetzen.

---

## 9. **Fehlermeldungen verständlich formulieren**

- Technische Fehler (z. B. Supabase/Network) in nutzerverständliche Kurzmeldungen übersetzen („Verbindung unterbrochen. Bitte erneut versuchen.“).
- Wo sinnvoll: „Erneut versuchen“-Button anbieten (`toastErrorWithRetry`-Pattern ausbauen).

**Relevante Stellen:** `handleError.ts`, `toastMessages.ts`, ErrorBoundary-Meldungen, Formular-`catch`-Blöcke.

---

## 10. **Kurzinfos / Tooltips bei Fachbegriffen**

- Bei Begriffen wie „LTV“, „DSCR“, „AfA“, „Nebenkostenabrechnung“, „Zinsbindung“ optional ein kleines (i)-Icon mit Tooltip oder kurzer Erklärung.
- Besonders in Cockpits (Finanzierung, Steuer, Analyse) und in Rechnern – hilft Neulingen ohne Erklärung zu überfordern.

**Relevante Stellen:** `FinanzierungsCockpit.tsx`, `SteuerCockpitPage.tsx`, `AnalysisCalculator.tsx`, KPI-Labels auf Dashboard; Tooltip-Komponente und ggf. kleines Glossar in Einstellungen/Hilfe.

---

## Fortsetzung

- Jeder Punkt kann in ein separates Issue/Ticket überführt werden.
- Bei Umsetzung: gleiche Patterns (EmptyState, Skeleton, Toast, Focus) in der ganzen App beibehalten.
- Nach Abschluss eines Punkts hier abhaken oder in „Erledigt“-Sektion verschieben.
