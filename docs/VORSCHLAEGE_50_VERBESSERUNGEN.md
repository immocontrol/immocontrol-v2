# 50 Vorschläge: Wo man in der App noch verbessern kann

Überblick über Verbesserungspotenziale in der gesamten ImmoControl-App. Priorität und Umsetzung je nach Ressourcen.

---

## A. Barrierefreiheit (A11y)

1. **Icon-Buttons mit aria-label** – Alle reinen Icon-Buttons (Expand, Schließen, Senden, Kopieren, Löschen) mit `aria-label` versehen (z. B. FinanzierungsVergleich, QuickNoteWidget, TenantPortal/HandworkerPortal Logout, ImmoAIBubble, ImmoAI, PropertyNotes, DragDropDashboard, SteuerCockpit, WidgetCustomizer, ErrorScanner, TenantManagement, BerichteInProsa, VermoegensuebersichtV2, PortfolioHistorie, CrmFollowUpReminder, EditPropertyDialog, ExposeHistory).
2. **Bilder: sinnvolle alt-Texte** – Alle `<img>` mit inhaltlichem `alt` oder bei dekorativen mit `alt=""` und ggf. `aria-hidden` (bereits teilweise umgesetzt; restliche Stellen prüfen).
3. **Formulare: Label-Zuordnung** – Bei allen Inputs `id` am Input und `htmlFor` am Label (oder `aria-label`) setzen (TodoEditDialog, HandoverProtocol, AngebotsGenerator, KautionsManagement, PortfolioGoals, ContractManagement, ServiceContracts, BankMatching, EnergyCertificateTracker, DealBewertungsScorecard, Auth, PasswordReset, MessageCenter, DragDropDashboard).
4. **Listen: role und aria** – Listen-Container mit `role="list"` und Einträge mit `role="listitem"` wo sinnvoll; bei dynamischen Inhalten `aria-live` nutzen.
5. **Fokus-Management** – Bei geöffneten Dialogen Fokus ins Modal lenken und bei Schließen zurück (Focus Trap); bei Tab-Wechsel Fokus setzen.

---

## B. Sicherheit & Externe Links

6. **target="_blank"** – Alle externen Links mit `rel="noopener noreferrer"` (bereits durchgängig umgesetzt; bei neuen Links beibehalten).
7. **Eingaben sanitizen** – Alle nutzerbeeinflussbaren Ausgaben (z. B. in Markdown, Tooltips) gegen XSS absichern; rehype-sanitize etc. prüfen.
8. **Sensible Daten nicht loggen** – Keine E-Mail, Tokens oder personenbezogenen Daten in console/logger in Produktion.

---

## C. UX & Feedback

9. **Ladezustand bei Async-Aktionen** – Buttons während Mutations mit `disabled` oder `LoadingButton` (QuickNoteWidget, GesellschaftSelector, PortfolioGoals, KautionsManagement, HandoverProtocol, ContractManagement, DealBewertungsScorecard, FileImportPicker).
10. **Konsistente Fehlermeldungen** – Einheitliche Nutzung von `handleError` + `toastErrorWithRetry` bzw. zentrale Texte in `toastMessages.ts` (Auth, TwoFactorSettings, BenachrichtigungenSettings).
11. **Erfolgs-Feedback** – Nach Speichern/Löschen kurzes Feedback (Toast oder Haptic); bei kritischen Aktionen `announce()` für Screenreader.
12. **Empty States** – Auf allen Listen-/Übersichtsseiten klare Empty States mit CTA (bereits weitgehend umgesetzt; neue Bereiche prüfen).
13. **Bestätigung bei destruktiven Aktionen** – Löschen, Kündigung etc. immer per AlertDialog bestätigen (bereits oft umgesetzt; restliche Stellen prüfen).

---

## D. Dokumentation & Meta

14. **document.title auf allen Seiten** – Jede Route setzt beim Mount einen aussagekräftigen Seitentitel und beim Unmount ggf. zurück auf „ImmoControl“ (bereits viele umgesetzt; fehlende: Index, Einladung, ImmobilienBewertung, FinanzierungsCockpit, HandworkerPortal).
15. **Meta-Description** – Für wichtige öffentliche oder geteilte Seiten optional `meta name="description"` setzen (SEO/Preview).
16. **Dokumentation** – Architektur, Offline, RLS/Validierung, Mobile Breakpoints aktuell halten (docs/).

---

## E. Code-Qualität & Wartbarkeit

17. **Wiederholte Logik auslagern** – Expand/Collapse-Pattern als `useDisclosure()` oder gemeinsame `ExpandableCard`; Async + Loading + Error als Hook oder einheitliches Pattern.
18. **Zentrale Fehler-zu-Text-Funktion** – z. B. `toErrorMessage(err)` in lib, nutzen in supabaseService und Catch-Blöcken.
19. **Stabile Keys in Listen** – In `.map()` wo möglich `key={item.id}` statt `key={index}` (ImmoAI messages, NotificationBell, DragDropDocUpload, HandoverProtocol, SteuerExport, etc.).
20. **Keine leeren catch-Blöcke** – Mindestens Logging oder generische Meldung; bei Nutzeraktionen Toast oder Retry.
21. **TypeScript: any reduzieren** – `as any` / `as unknown` schrittweise durch typisierte Casts oder bessere Typen ersetzen.
22. **Query Keys zentral** – Alle React-Query-Keys aus `queryKeys` nutzen; keine String-Literale in Komponenten.

---

## F. Performance

23. **Lazy Loading schwerer Komponenten** – Recharts, PDF, Immo-AI, große Dialoge per `React.lazy` + Suspense laden.
24. **Bilder: loading="lazy"** – Bei allen nicht-above-the-fold Bildern `loading="lazy"` setzen (bereits an vielen Stellen).
25. **Virtuelle Listen** – Lange Listen (z. B. Objekte, Deals, Kontakte) mit VirtualList oder Fensterung rendern (ObjekteList bereits VirtualList ab 25).
26. **Debounce bei Suche/Filter** – Such- und Filterinputs debouncen (bereits oft umgesetzt; neue Suchfelder prüfen).
27. **Bundle-Analyse** – Regelmäßig Visualizer nutzen; große Chunks identifizieren und ggf. splitten.

---

## G. Mobile & Responsive

28. **Touch-Targets mind. 44×44 px** – Alle klickbaren Elemente auf Mobile ausreichend groß; `touch-target`-Klassen prüfen.
29. **Kein horizontaler Scroll in Hauptinhalten** – In #main-content und Karten `min-width: 0`, `word-break`, `overflow-wrap` setzen (Regel text-no-clip).
30. **Bottom Sheets auf Mobile** – Schwere Formulare auf schmalen Screens als Sheet statt zentrierter Dialog (ResponsiveDialog nutzen).
31. **Sticky Actions/FAB** – Wichtige Aktionen (Speichern, Neues Ticket) auf langen Seiten sticky oder als FAB.

---

## H. Formulare & Validierung

32. **Zentrale Schemas** – Alle wichtigen Formulare an Zod-Schemas aus `schemas.ts` anbinden; einheitliche Pflichtfelder und Typen.
33. **Client-Validierung vor Submit** – Vor dem Absenden Validierung; Fehler unter dem Feld oder gesammelt anzeigen.
34. **Datum-Logik zentral** – Enddatum > Startdatum etc. in Validatoren/Schemas; überall dieselben Regeln.
35. **Autosave/Form-Draft** – Bei langen Formularen Draft in sessionStorage (bereits bei Deals; auf andere Formulare ausdehnen wo sinnvoll).

---

## I. Fehlerbehandlung & Robustheit

36. **Error Boundaries pro Bereich** – Dashboard, Objekte, Einstellungen etc. mit eigenem Boundary und Fallback-UI.
37. **Retry bei Netzfehlern** – Einheitlich `toastErrorWithRetry` oder ähnlich; Nutzer kann Aktion erneut ausführen.
38. **Offline-Queue dokumentieren** – Welche Mutations gequeuet werden, Reihenfolge, Konflikthandling (docs/OFFLINE.md).
39. **Graceful Degradation** – Wenn eine Teildatenquelle fehlschlägt, Rest der Seite nutzbar halten (z. B. WidgetErrorBoundary).

---

## J. Inhalte & Funktionen

40. **Cloud-Backup** – Option „Backup in Cloud“ (Supabase Storage) mit Wiederherstellung (Doku/Stub vorhanden; Implementierung optional).
41. **Benachrichtigungen zentral** – Alle Kanäle (Browser, Telegram, In-App) und Themen an einem Ort steuerbar (bereits BenachrichtigungenSettings).
42. **Keyboard-Shortcuts** – Wichtige Aktionen per Tastatur (Alt+O Objekte bereits umgesetzt; weitere Shortcuts in Einstellungen dokumentieren und ggf. erweitern).
43. **Export-Spalten an DB anpassen** – DataExportBackup/CSV an aktuelle Tabellen/Spalten anpassen und dokumentieren (bereits angepasst; bei Schema-Änderungen mitziehen).
44. **DATEV/Anlage V prüfen** – Export-Formate periodisch prüfen und dokumentieren (docs/DATEV_ANLAGE_V.md).
45. **RLS & Validierung dokumentieren** – Welche RLS-Regeln, welche Pflichtfelder pro Tabelle (docs/VALIDIERUNG_UND_RLS.md).

---

## K. Tests & CI

46. **E2E an ROUTES** – Alle Playwright-Tests nutzen `ROUTES` aus `routes.ts`; keine hardcodierten Pfade.
47. **Kritische Flows E2E** – Login, Objekt anlegen, Deal → Objekt, Miete erfassen als E2E abdecken.
48. **Unit-Tests für Utils** – formatCurrency, filterAndSortDeals, toErrorMessage etc. mit Tests absichern.

---

## L. Sonstiges

49. **i18n-Vorbereitung** – Falls mehr Sprachen geplant: Strings in Keys auslagern, schlanke i18n-Lösung (react-i18next o. ä.); schrittweise pro Modul.
50. **Feature-Flags** – Experimentelle Features per Env oder Config ein-/ausschaltbar; klare Trennung Dev/Staging/Prod.

---

## Umsetzungsstand (Auswahl)

| Nr. | Kurzbeschreibung           | Status |
|-----|----------------------------|--------|
| 6   | target="_blank" + noopener | ✅ Umgesetzt |
| 14  | document.title (fehlende Seiten) | ✅ Index, Einladung, FinanzierungsCockpit, HandworkerPortal, ImmobilienBewertung ergänzt |
| 15  | Meta-Description (Start)   | ✅ `index.html` + OG/Twitter |
| 1   | aria-label Icon-Buttons    | ✅ Mehrere Komponenten (ImmoAI, HandworkerPortal, TenantPortal, NotificationBell, EditPropertyDialog, TenantManagement, etc.) |
| 3   | Form label id/htmlFor      | ✅ TodoEditDialog (Titel, Beschreibung, Fälligkeit, Uhrzeit, Priorität, Projekt); weitere Formulare schrittweise |
| 19  | Stabile Keys in Listen     | ✅ u. a. ImmoAI (msg.id), NotificationBell (Hash+Index), DragDropDocUpload (file.id), ContactDuplicateDetector (Kontakt-IDs) |
| 47  | E2E kritische Flows        | 🔄 Portfolio-Flow in `e2e/auth.spec.ts` weiterhin skip ohne E2E-Zugangsdaten; CI führt Lint+Unit+Build aus |
| 9   | Loading bei Async-Buttons  | ✅ LoadingButton in TenantManagement, ContractManagement, EnergyCertificateTracker, MaintenancePlanner; weitere schrittweise |
| 17  | useDisclosure / ExpandableCard | ✅ useDisclosure (hooks), ExpandableCard (components); Pilot-Nutzung möglich |
| 18  | toErrorMessage()           | ✅ In lib/handleError.ts exportiert (toErrorMessage + ErrorContext) |
| 38  | Offline-Queue dokumentieren | ✅ [OFFLINE.md](./OFFLINE.md) an Code angepasst |
| 45  | RLS & Validierung dokumentieren | ✅ [VALIDIERUNG_UND_RLS.md](./VALIDIERUNG_UND_RLS.md) |
| 48  | Unit-Tests Utils           | ✅ u. a. formatters, dealUtils, mutationErrorHandler, handleError |
| 46  | E2E nutzt ROUTES           | ✅ `e2e/auth.spec.ts` importiert `ROUTES` |
| 50  | Feature-Flags              | ✅ `src/lib/featureFlags.ts` + [FEATURE_FLAGS.md](./FEATURE_FLAGS.md) |

---

*Stand: März 2026. Kann bei Änderungen am Produkt angepasst werden.*
