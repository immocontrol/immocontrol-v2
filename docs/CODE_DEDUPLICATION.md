# Code-Deduplizierung und gemeinsame Quellen

Dieses Dokument listet zentrale Konstanten/Quellen und verbleibende Duplikate, die bei Gelegenheit vereinheitlicht werden können.

## Erledigt: §558/§559 Mietrecht

- **Quelle:** `src/lib/mietrechtConstants.ts`
- **Inhalt:** KAPPUNGSGRENZE_NORMAL (20), KAPPUNGSGRENZE_ANGESPANNT (15), WARTEFRIST_MONATE (15), MODERNISIERUNG_UMLAGE_PROZENT (8), ANGESPANNTE_MÄRKTE, isAngespanntMarkt(), getKappungsgrenzePercent()
- **Nutzer:** Entwicklungsplan (entwicklungsplanEngine), RentIncreaseWizard, Mietvertragsverwaltung, MietpreisCheck

## Mietspiegel-Daten (mehrere Quellen)

Mietspiegel-Werte (€/m² min/mid/max pro Stadt) kommen derzeit an mehreren Stellen vor:

| Datei | Verwendung | Struktur |
|-------|------------|----------|
| `src/lib/mietspiegelApi.ts` | FUND-24, getMietspiegel(), checkRentAgainstMietspiegel() | min/avg/max, year, source |
| `src/components/MietpreisCheck.tsx` | Mietpreis-Check pro Objekt | MIETSPIEGEL_RANGES: min, mid, max |
| `src/components/MietpreisbremseChecker.tsx` | Mietpreisbremse 10%-Regel | MIETSPIEGEL_RANGES: min, max |
| `src/components/RentIncreaseLetter.tsx` | Mieterhöhungsschreiben | MIETSPIEGEL_DATA: min, max, avg, year |
| `src/components/MietspiegelComparison.tsx` | Vergleich Miete vs. Mietspiegel | eigene MIETSPIEGEL_DB |

**Empfehlung:** Langfristig alle auf `src/lib/mietspiegelApi.ts` (getMietspiegel, getAvailableMietspiegelCities) umstellen und lokale MIETSPIEGEL_*-Objekte in den Komponenten entfernen. Dazu müssen die Komponenten auf das gleiche Feld-Schema (minRentPerSqm, avgRentPerSqm, maxRentPerSqm) umgestellt werden.

## Rendite-Berechnungen

- **Quelle:** `src/lib/calculations.ts`
- **Funktionen:** calcBruttoRendite, calcNettoRendite, calcMietmultiplikator
- **Bereits umgestellt:** PropertyDetail, PropertyCard
- **Noch mit Inline-Formel:** useDashboardExports, ObjekteList, PropertyBenchmark, Dashboard, MobilePropertyDetailSheet, etc. – können schrittweise auf `@/lib/calculations` umgestellt werden.

## Formatter

- `formatCurrency`, `formatPercent` etc. sind bereits zentral in `src/lib/formatters.ts` – keine Duplikate.
