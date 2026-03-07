# WGH-Scout: Karten- und POI-Provider

Der WGH-Scout (Wohn- und Geschäftshaus) nutzt eine **Provider-Abstraktion**, damit mehrere Datenquellen genutzt und später ergänzt werden können. So gehen keine Infos verloren.

## Aktuell implementiert

| Provider        | Geocoding | Bbox/Umkreis POIs | Gebäudeflächen | Kosten / Limit        |
|-----------------|-----------|-------------------|----------------|------------------------|
| **OpenStreetMap** (Nominatim + Overpass) | ✅ | ✅ Bbox + Radius | ✅ (Overpass) | Kostenfrei, 1 req/s Nominatim |
| **Brandenburg ALKIS** (OGC API) | ❌ | ❌ | ✅ (nur Brandenburg) | Kostenfrei, Datenlizenz dl-de/by-2-0 |

Brandenburg ALKIS liefert amtliche Gebäude- und Flurstücksdaten des Liegenschaftskatasters (OGC API). Im WGH-Scout wird dieser Provider für Gebäudeflächen **automatisch bevorzugt**, wenn die Suche innerhalb Brandenburgs liegt (ca. 11–15°E, 51.3–53.6°N). Es werden parallel Gebäude (gebaeude_bauwerk) und Flurstücke (flurstueck) geladen; pro Gebäude wird die amtliche Grundstücksfläche (parcelArea) per Punkt-in-Polygon aus dem zugehörigen Flurstück ermittelt und am POI angezeigt. Außerhalb Brandenburgs werden weiterhin OSM-Gebäudedaten genutzt.

## Alternativen (für spätere Anreicherung)

Diese Dienste eignen sich als weitere Provider; die Architektur ist vorbereitet.

| Dienst | Stärken | Schwächen | Integration |
|--------|---------|-----------|-------------|
| **Google Places API** (Nearby Search, Text Search) | Sehr viele Gewerbedaten, Öffnungszeiten, Bewertungen, Fotos | Kosten (z. B. ~$0.02/Request), Lizenzpflicht, keine Gebäudegeometrie | Neuer Provider `googleProvider.ts`, `VITE_GOOGLE_PLACES_API_KEY`, Bbox ggf. über mehrere Radius-Suchen abdecken |
| **Foursquare Places API** | Viele POIs, Bewertungen, Kategorien | Kosten, kein Gebäude-Footprint | Eigenes Modul, Geocoding separat (z. B. OSM oder Google) |
| **HERE Geocoding & Search** | Stabile Abdeckung, B2B-tauglich | Kosten, Lizenz | HERE Geocoding + Place Search; Bbox/Radius je nach API |
| **Mapbox Geocoding + Geodata** | Günstige Preise, gute Karten | POI-Daten weniger fokussiert auf Gewerbe-Details | Mapbox API für POI-Suche prüfen |
| **Yelp Fusion API** | Starke Gastronomie-/Lokal-Daten, großzügiges Free-Tier | Weniger B2B/Allgemeingewerbe | Radius-basiert; als zusätzlicher Provider für Gastronomie |
| **TomTom Search API** | Günstig, gute Abdeckung | Weniger Attribute (Telefon/Web) als Google | Search API für POIs |
| **Sygic / SafeGraph / Netrows** | Spezialisierte POI-/B2B-Daten | Kommerziell, oft Datenlieferung statt Live-API | Bei Bedarf als weiterer Provider mit eigenem Adapter |

## Konfiguration

- **Aktive Provider:** `VITE_SCOUT_PROVIDERS=openstreetmap,brandenburg` (Standard). Brandenburg liefert nur Gebäudeflächen für BB; OSM liefert POIs + Gebäude (außerhalb BB).
- **Neuer Provider:** In `src/lib/scoutProviders/` anlegen und in `index.ts` in `PROVIDER_REGISTRY` eintragen bzw. `registerScoutProvider()` aufrufen.

## Technik

- **Interface:** `ScoutProvider` in `src/lib/scoutProviders/types.ts` (geocode, geocodeToBbox, fetchPOIsByBbox, fetchPOIsByRadius, optional fetchBuildingsByBbox/ByRadius).
- **Aggregation:** `aggregatePOIsByBbox` / `aggregatePOIsByRadius` rufen alle aktiven Provider auf, mergen die POIs, hängen Gebäudeflächen an (Brandenburg ALKIS in BB, sonst OSM) und deduplizieren nach Position. Für Filter/Sortierung im Scout wird `estimatedGrossArea ?? parcelArea` verwendet (Grundstücksfläche als Fallback wenn keine Bruttofläche).
- **Scout-Komponente:** Nutzt nur noch `@/lib/scoutProviders` (aggregateGeocode, aggregateGeocodeToBbox, aggregatePOIsByBbox, aggregatePOIsByRadius). Einzelne Karten-APIs sind nicht mehr direkt eingebunden.

## Ist OpenStreetMap die beste Lösung?

- **Vorteile OSM:** Kostenfrei, keine API-Keys, offene Daten, Gebäudegeometrie (Overpass) für Flächenschätzung, gut für erste Akquise.
- **Nachteile OSM:** Lücken in Gewerbedaten (v. a. Telefon/Web/Öffnungszeiten), unterschiedliche Aktualität je Region.
- **Empfehlung:** OSM als Basis beibehalten und **zusätzlich** weitere Provider (z. B. Google Places, Foursquare) anbinden. Über `VITE_SCOUT_PROVIDERS` können Nutzer:innen oder Umgebungen wählen; die Aggregation stellt sicher, dass alle Treffer genutzt und nach Quelle (CSV-Spalte „Quelle“) sichtbar sind.
