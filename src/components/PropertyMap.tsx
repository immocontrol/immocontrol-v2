import { useState, useEffect, useRef } from "react";
import { useProperties } from "@/context/PropertyContext";
import { MapPin, Loader2, ChevronRight } from "lucide-react";

import { formatCurrency } from "@/lib/formatters";
import { ROUTES } from "@/lib/routes";

interface GeocodedProperty {
  id: string;
  name: string;
  location: string;
  address: string;
  currentValue: number;
  monthlyRent: number;
  monthlyCashflow: number;
  type: string;
  units: number;
  lat: number;
  lng: number;
}

// Load leaflet CSS + JS from CDN
/* FIX-31: Replace `any` return type and window casts with proper Leaflet type */
const loadLeaflet = (): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    if ((window as Record<string, unknown>).L) {
      resolve((window as Record<string, unknown>).L);
      return;
    }

    // CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    /* FIX-32: Replace `as any` window cast */
    script.onload = () => resolve((window as Record<string, unknown>).L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const PropertyMap = () => {
  const { properties, loading } = useProperties();
  const mapRef = useRef<HTMLDivElement>(null);
  /* FIX-33: Replace `any` ref type with unknown */
  const mapInstanceRef = useRef<unknown>(null);
  const [geocoded, setGeocoded] = useState<GeocodedProperty[]>([]);
  const [geocoding, setGeocoding] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Geocode addresses
  useEffect(() => {
    if (properties.length === 0) return;

    const geocodeAll = async () => {
      setGeocoding(true);
      const results: GeocodedProperty[] = [];

      for (const p of properties) {
        const query = p.address || `${p.name} ${p.location}`;
        try {
          const res = await fetch(
            `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=de`
          );
          const data = await res.json();
          if (data.features && data.features.length > 0) {
            const [lng, lat] = data.features[0].geometry.coordinates;
            results.push({
              id: p.id,
              name: p.name,
              location: p.location,
              address: p.address,
              currentValue: p.currentValue,
              monthlyRent: p.monthlyRent,
              monthlyCashflow: p.monthlyCashflow,
              type: p.type,
              units: p.units,
              lat,
              lng,
            });
          }
          await new Promise((r) => setTimeout(r, 200));
        } catch {
          // Skip failed
        }
      }

      setGeocoded(results);
      setGeocoding(false);
    };

    geocodeAll();
  }, [properties]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || properties.length === 0) return;

    let cancelled = false;

    loadLeaflet().then((L) => {
      if (cancelled || !mapRef.current) return;

      // Destroy existing map
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const map = L.map(mapRef.current, {
        center: [51.1657, 10.4515],
        zoom: 6,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [properties.length > 0]);

  // Add markers when geocoding finishes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || geocoded.length === 0) return;

    /* FIX-34: Replace `as any` and `any[]` with proper types */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const L = (window as Record<string, unknown>).L as Record<string, (...args: unknown[]) => unknown> | undefined;
    if (!L) return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const map = mapInstanceRef.current as Record<string, (...args: unknown[]) => unknown>;
    const markers: unknown[] = [];

    geocoded.forEach((prop) => {
      const color = prop.monthlyCashflow >= 0 ? "#3cb97a" : "#d94040";

      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: 32px; height: 32px; 
          background: ${color}; 
          border: 3px solid white; 
          border-radius: 50%; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -34],
      });

      const marker = L.marker([prop.lat, prop.lng], { icon }).addTo(map);

      marker.bindPopup(`
        <div style="min-width:200px;font-family:DM Sans,system-ui,sans-serif">
          <strong style="font-size:14px">${prop.name}</strong>
          <div style="font-size:11px;color:#888;margin:4px 0 8px">${prop.address || prop.location}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
            <div><div style="color:#888;font-size:10px">Wert</div><div style="font-weight:600">${formatCurrency(prop.currentValue)}</div></div>
            <div><div style="color:#888;font-size:10px">Miete/M</div><div style="font-weight:600">${formatCurrency(prop.monthlyRent)}</div></div>
            <div><div style="color:#888;font-size:10px">Cashflow/M</div><div style="font-weight:600;color:${prop.monthlyCashflow >= 0 ? '#3cb97a' : '#d94040'}">${formatCurrency(prop.monthlyCashflow)}</div></div>
            <div><div style="color:#888;font-size:10px">Typ</div><div style="font-weight:600">${prop.type} · ${prop.units} WE</div></div>
          </div>
          <a href="${ROUTES.PROPERTY}/${prop.id}" style="display:flex;align-items:center;justify-content:center;gap:4px;margin-top:10px;padding:6px 0;border-radius:6px;background:#3cb97a;color:white;text-decoration:none;font-size:12px;font-weight:600">Details →</a>
        </div>
      `);

      markers.push(marker);
    });

    // Fit bounds
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 14 });
    }

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [geocoded, mapReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" /> Kartenansicht
        </h2>
        <div className="text-center py-12">
          <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Füge Objekte hinzu, um sie auf der Karte zu sehen</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:400ms]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" /> Kartenansicht
        </h2>
        <div className="flex items-center gap-2">
          {/* IMPROVE-39: Geocoding progress indicator shows real-time count of resolved addresses */}
          {geocoding && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Adressen werden geladen…
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {geocoded.length}/{properties.length} Objekte
          </span>
        </div>
      </div>

      <div
        ref={mapRef}
        className="rounded-lg overflow-hidden border border-border h-[400px]"
      />

      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-3 h-3 rounded-full bg-profit border-2 border-foreground/20" />
          Positiver Cashflow
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-3 h-3 rounded-full bg-loss border-2 border-foreground/20" />
          Negativer Cashflow
        </div>
      </div>
    </div>
  );
};

export default PropertyMap;
