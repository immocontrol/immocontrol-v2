/**
 * Eingebettete Karte mit Treffer-Markern für den WGH-Scout.
 * Nutzt Leaflet + react-leaflet; nur anzeigen wenn POIs mit Koordinaten vorhanden.
 */
import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { ScoutPOI } from "@/lib/scoutProviders";
import "leaflet/dist/leaflet.css";

/** Default-Marker-Icon (Bundler-freundlich: Standard-Icon-Pfad setzen). */
const defaultIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitBounds({ pois }: { pois: { lat: number; lon: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (pois.length === 0) return;
    if (pois.length === 1) {
      map.setView([pois[0].lat, pois[0].lon], 15);
      return;
    }
    const bounds = L.latLngBounds(pois.map((p) => [p.lat, p.lon] as L.LatLngTuple));
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
  }, [map, pois]);
  return null;
}

export interface ScoutMapProps {
  /** Treffer mit Koordinaten (z. B. visibleResults). */
  pois: ScoutPOI[];
  /** Initiale Bounding Box (z. B. „Ganzer Ort“). */
  bbox?: { south: number; north: number; west: number; east: number } | null;
  /** Initialer Mittelpunkt (z. B. Umkreis-Suche). */
  center?: { lat: number; lng: number } | null;
  /** Höhe der Karte (CSS). */
  height?: string;
  className?: string;
}

export function ScoutMap({ pois, bbox, center, height = "280px", className }: ScoutMapProps) {
  const hasValidCoords = useMemo(
    () => pois.filter((p) => typeof p.lat === "number" && typeof p.lon === "number"),
    [pois]
  );

  const defaultCenter: [number, number] = useMemo(() => {
    if (center) return [center.lat, center.lng];
    if (bbox) return [(bbox.south + bbox.north) / 2, (bbox.west + bbox.east) / 2];
    if (hasValidCoords.length > 0) {
      const lat = hasValidCoords.reduce((s, p) => s + p.lat, 0) / hasValidCoords.length;
      const lon = hasValidCoords.reduce((s, p) => s + p.lon, 0) / hasValidCoords.length;
      return [lat, lon];
    }
    return [52.52, 13.405]; // Berlin fallback
  }, [bbox, center, hasValidCoords]);

  if (hasValidCoords.length === 0) return null;

  return (
    <div className={className} style={{ height, minHeight: 120, borderRadius: 8, overflow: "hidden" }}>
      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds pois={hasValidCoords} />
        {hasValidCoords.map((p, i) => (
          <Marker
            key={`${p.lat}-${p.lon}-${p.name}-${i}`}
            position={[p.lat, p.lon]}
            icon={defaultIcon}
          >
            <Popup>
              <span className="font-medium">{p.name}</span>
              {p.type && <><br /><span className="text-muted-foreground text-sm">{p.type}</span></>}
              {p.address && <><br /><span className="text-sm">{p.address}</span></>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
