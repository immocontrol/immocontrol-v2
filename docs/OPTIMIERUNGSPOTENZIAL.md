# Optimierungspotenzial – Codebase-Check

Überblick über identifizierte Verbesserungen (Performance, Bundle, Konsistenz). Priorität nach Impact.

---

## 1. Duplikate / Konsistenz

| Bereich | Befund | Empfehlung |
|--------|--------|------------|
| **Währungsformat** | Mehrere Manus-Komponenten + MobileQuickCalculator nutzen lokales `formatEuro` / `toLocaleString("de-DE", { currency: "EUR" })`. | Überall `formatCurrency` aus `@/lib/formatters` verwenden (einheitlich + NaN-Sicher). |
| **Datumsformat** | Viele Stellen nutzen `new Date(...).toLocaleDateString("de-DE")` oder mit Optionen. | `formatDate` / `formatDateLong` / `formatMonthYear` aus `@/lib/formatters` nutzen. |
| **AddContactDialog** | Manuelle Validierung mit `contactFormSchema.safeParse(form)` und lokales Error-Mapping. | Auf `useForm` + `zodResolver(contactFormSchema)` umstellen (wie AddPropertyDialog). |
| **AddLoanDialog** | Eigene Validierungs-Logik (`validationErrors`, `highlightFields`). | Optional: gemeinsames Loan-Schema in `@/lib/schemas` + `useForm` + `zodResolver`. |

---

## 2. Bundle / Lazy Loading

| Bereich | Befund | Empfehlung |
|--------|--------|------------|
| **GewerbeScout** | `ScoutMap` (und damit `react-leaflet` / `leaflet`) wird synchron importiert. | ScoutMap per `React.lazy()` laden und in Suspense mit Fallback rendern → Leaflet nur bei „Karte anzeigen“. |
| **ErrorScanner** | `import jsPDF from "jspdf"` auf Top-Level. | jsPDF nur im PDF-Export-Handler per `import("jspdf")` laden → nicht im Settings-Chunk. |
| **HockeyStickSimulator** | jsPDF und Recharts auf Top-Level. | jsPDF im Export-Pfad dynamisch importieren; Recharts bleibt routengebunden. |
| **Routen** | Alle Routen bereits per `React.lazy()`. | Keine Änderung nötig. |

---

## 3. Re-Renders

| Bereich | Befund | Empfehlung |
|--------|--------|------------|
| **ResponsiveTable** | `onClick={() => onRowClick?.(row)}` pro Zeile → neue Funktion je Render. | Ein Handler mit `data-rowkey` oder stabilem Callback pro Zeile (z. B. kleine Row-Komponente mit memo). |
| **MobileCardList** | Gleiches Muster: `onClick={() => onRowClick?.(item)}` pro Item. | Wie oben: stabiler Handler oder memo-Komponente. |
| **Listen mit Aktionen** | Viele `onClick={() => setX(...)}` / `onClick={() => action(id)}` in Listen. | Bei langen Listen: List-Item mit `memo`, Handler mit `useCallback` oder id + zentraler Handler. |
| **Inline-Styles** | `style={{ width: \`${pct}%` }}` etc. in Listen. | Style-Objekt mit `useMemo` keyed by value oder kleine memo-Komponente. |

---

## 4. Data Fetching

| Bereich | Befund | Empfehlung |
|--------|--------|------------|
| **Query-Keys** | Ad-hoc-Keys wie `["bank_transactions"]`, `["vertraege_stats"]`, `["mietuebersicht_tenants"]` statt zentraler `queryKeys`. | Keys in `@/lib/queryKeys.ts` aufnehmen und überall nutzen → einheitliche Invalidierung + setQueryDefaults (staleTime). |
| **staleTime** | setQueryDefaults nur für bekannte Keys (properties, loans, contacts, …). | Nach Umstellung auf queryKeys für neue Bereiche passende staleTime setzen (z. B. bank_matching, vertraege, mietuebersicht). |
| **N+1** | Kein Fetch pro Item in `.map()` gefunden. | Optional: RentIncreaseTimeline – zwei sequentielle Queries ggf. bündeln. |

---

## 5. Sonstiges

| Bereich | Befund | Empfehlung |
|--------|--------|------------|
| **Abhängigkeiten** | date-fns statt moment; kein volles lodash. | Keine Änderung. |
| **Kommentare** | Vereinzelt große auskommentierte Blöcke. | Bei Gelegenheit prüfen und entfernen, wenn obsolet. |

---

## Umgesetzt (nach diesem Check)

- **ScoutMap:** Lazy-Load in GewerbeScout mit Suspense.
- **jsPDF:** Dynamischer Import in ErrorScanner und HockeyStickSimulator (nur im Export-Pfad).
- **MobileQuickCalculator:** `formatCurrency` aus formatters statt lokalem `formatEuro`.

---

## Priorität für nächste Schritte

1. **Hoch:** Query-Keys zentralisieren (bessere Cache-Steuerung, weniger Refetches).
2. **Mittel:** Row-Click-Handler in ResponsiveTable / MobileCardList stabilisieren (weniger Re-Renders bei langen Listen).
3. **Mittel:** Formulare AddContactDialog / AddLoanDialog auf useForm + zodResolver vereinheitlichen.
4. **Niedrig:** Weitere Duplikate (formatEuro, toLocaleDateString) in Manus-Komponenten und anderen Seiten auf formatters umstellen.
