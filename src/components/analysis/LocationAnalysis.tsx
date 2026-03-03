import { useState, useCallback } from "react";
import { MapPin, Search, Building2, Train, ShoppingBag, GraduationCap, TreePine, TrendingUp, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

interface POI {
  name: string;
  type: string;
  distance: number; // meters
}

interface LocationData {
  address: string;
  lat: number;
  lon: number;
  mikrolage: {
    pois: POI[];
    score: number; // 1-10
    description: string;
  };
  makrolage: {
    city: string;
    state: string;
    population?: string;
    score: number;
    description: string;
    avgRent?: string;
    marketListings: MarketListing[];
  };
}

interface MarketListing {
  source: string;
  title: string;
  price: string;
  size: string;
  url: string;
}

/* Fix 16: Mikro/Makrolage analysis using free data sources */
const LocationAnalysis = () => {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [locationData, setLocationData] = useState<LocationData | null>(null);

  /* Geocode address using Nominatim (free, no API key) */
  const geocodeAddress = async (query: string): Promise<NominatimResult | null> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { "User-Agent": "ImmoControl/1.0" } }
      );
      const data = await res.json();
      return data.length > 0 ? data[0] : null;
    } catch {
      return null;
    }
  };

  /* Query nearby POIs using Overpass API (free OpenStreetMap data) */
  const fetchNearbyPOIs = async (lat: number, lon: number): Promise<POI[]> => {
    const radius = 1000; // 1km radius
    const query = `
      [out:json][timeout:10];
      (
        node["amenity"~"school|kindergarten|university"](around:${radius},${lat},${lon});
        node["shop"~"supermarket|mall"](around:${radius},${lat},${lon});
        node["amenity"~"pharmacy|doctors|hospital"](around:${radius},${lat},${lon});
        node["railway"="station"](around:${radius * 2},${lat},${lon});
        node["amenity"="bus_station"](around:${radius},${lat},${lon});
        node["leisure"~"park|playground"](around:${radius},${lat},${lon});
        node["amenity"~"restaurant|cafe"](around:${radius},${lat},${lon});
      );
      out body 30;
    `;
    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const data = await res.json();
      const pois: POI[] = (data.elements || []).map((el: { tags?: Record<string, string>; lat: number; lon: number }) => {
        const tags = el.tags || {};
        const name = tags.name || tags.amenity || tags.shop || tags.railway || tags.leisure || "Unbekannt";
        const type = tags.amenity || tags.shop || tags.railway || tags.leisure || "sonstig";
        const dist = Math.round(
          Math.sqrt(Math.pow((el.lat - lat) * 111320, 2) + Math.pow((el.lon - lon) * 111320 * Math.cos(lat * Math.PI / 180), 2))
        );
        return { name, type, distance: dist };
      });
      return pois.sort((a, b) => a.distance - b.distance).slice(0, 20);
    } catch {
      return [];
    }
  };

  /* Calculate Mikrolage score based on POI categories */
  const calcMikroScore = (pois: POI[]): { score: number; description: string } => {
    let score = 5;
    const categories = {
      transport: pois.filter(p => ["station", "bus_station"].includes(p.type)),
      shopping: pois.filter(p => ["supermarket", "mall"].includes(p.type)),
      education: pois.filter(p => ["school", "kindergarten", "university"].includes(p.type)),
      health: pois.filter(p => ["pharmacy", "doctors", "hospital"].includes(p.type)),
      green: pois.filter(p => ["park", "playground"].includes(p.type)),
      gastro: pois.filter(p => ["restaurant", "cafe"].includes(p.type)),
    };

    if (categories.transport.length > 0) score += 1;
    if (categories.transport.some(p => p.distance < 500)) score += 0.5;
    if (categories.shopping.length > 0) score += 1;
    if (categories.education.length > 0) score += 0.5;
    if (categories.health.length > 0) score += 0.5;
    if (categories.green.length > 0) score += 0.5;
    if (categories.gastro.length >= 3) score += 0.5;
    if (pois.length < 5) score -= 1;

    score = Math.min(10, Math.max(1, Math.round(score)));

    const parts: string[] = [];
    if (categories.transport.length > 0) parts.push(`${categories.transport.length} ÖPNV-Stationen`);
    if (categories.shopping.length > 0) parts.push(`${categories.shopping.length} Einkaufsmöglichkeiten`);
    if (categories.education.length > 0) parts.push(`${categories.education.length} Bildungseinrichtungen`);
    if (categories.green.length > 0) parts.push(`${categories.green.length} Grünflächen`);
    if (categories.health.length > 0) parts.push(`${categories.health.length} Gesundheitseinrichtungen`);

    const desc = parts.length > 0
      ? `Im Umkreis von 1 km: ${parts.join(", ")}.`
      : "Wenig Infrastruktur im Umkreis von 1 km erkannt.";

    return { score, description: desc };
  };

  /* Calculate Makrolage score */
  const calcMakroScore = (result: NominatimResult): { score: number; description: string; city: string; state: string } => {
    const addr = result.address || {};
    const city = addr.city || addr.town || addr.village || addr.municipality || "";
    const state = addr.state || "";

    let score = 5;
    // Larger cities generally have better Makrolage
    const largeCities = ["Berlin", "München", "Hamburg", "Köln", "Frankfurt", "Stuttgart", "Düsseldorf", "Leipzig", "Dresden", "Nürnberg", "Hannover"];
    const mediumCities = ["Bonn", "Münster", "Karlsruhe", "Mannheim", "Augsburg", "Wiesbaden", "Freiburg", "Heidelberg", "Potsdam", "Regensburg"];

    if (largeCities.some(c => city.includes(c))) score = 9;
    else if (mediumCities.some(c => city.includes(c))) score = 7;
    else if (city) score = 5;
    else score = 3;

    // Economic powerhouse states get a small boost
    const strongStates = ["Bayern", "Baden-Württemberg", "Hessen"];
    if (strongStates.some(s => state.includes(s))) score = Math.min(10, score + 0.5);

    score = Math.min(10, Math.max(1, Math.round(score)));

    const desc = city
      ? `${city}, ${state} — ${score >= 8 ? "Top-Lage mit starker Wirtschaft und Nachfrage" : score >= 6 ? "Gute Lage mit solider Infrastruktur" : score >= 4 ? "Durchschnittliche Lage, moderate Nachfrage" : "Ländliche/periphere Lage, geringere Nachfrage"}`
      : "Standortbewertung nicht möglich";

    return { score, description: desc, city, state };
  };

  /* Analyze location */
  const analyzeLocation = useCallback(async () => {
    if (!address.trim()) {
      toast.error("Bitte eine Adresse eingeben");
      return;
    }

    setLoading(true);
    try {
      const geocoded = await geocodeAddress(address);
      if (!geocoded) {
        toast.error("Adresse nicht gefunden");
        setLoading(false);
        return;
      }

      const lat = parseFloat(geocoded.lat);
      const lon = parseFloat(geocoded.lon);

      // Fetch POIs from Overpass API
      const pois = await fetchNearbyPOIs(lat, lon);

      // Calculate scores
      const mikro = calcMikroScore(pois);
      const makro = calcMakroScore(geocoded);

      setLocationData({
        address: geocoded.display_name,
        lat,
        lon,
        mikrolage: { pois, ...mikro },
        makrolage: {
          city: makro.city,
          state: makro.state,
          score: makro.score,
          description: makro.description,
          marketListings: [],
        },
      });

      toast.success("Standortanalyse abgeschlossen");
    } catch (err) {
      toast.error("Fehler bei der Standortanalyse: " + (err instanceof Error ? err.message : "Unbekannt"));
    } finally {
      setLoading(false);
    }
  }, [address]);

  const ScoreBar = ({ score, label }: { score: number; label: string }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold">{score}/10</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            score >= 8 ? "bg-green-500" : score >= 5 ? "bg-yellow-500" : "bg-red-500"
          }`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
    </div>
  );

  const poiIcon = (type: string) => {
    if (["station", "bus_station"].includes(type)) return <Train className="h-3 w-3" />;
    if (["supermarket", "mall"].includes(type)) return <ShoppingBag className="h-3 w-3" />;
    if (["school", "kindergarten", "university"].includes(type)) return <GraduationCap className="h-3 w-3" />;
    if (["park", "playground"].includes(type)) return <TreePine className="h-3 w-3" />;
    return <Building2 className="h-3 w-3" />;
  };

  return (
    <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Standortanalyse (Mikro- & Makrolage)</h2>
      </div>

      <div className="flex gap-2">
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Adresse eingeben, z.B. Musterstr. 1, 80331 München"
          className="text-sm flex-1"
          onKeyDown={(e) => e.key === "Enter" && analyzeLocation()}
        />
        <Button size="sm" onClick={analyzeLocation} disabled={loading} className="gap-1.5 shrink-0">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Analysieren
        </Button>
      </div>

      {locationData && (
        <div className="space-y-4 mt-4">
          <p className="text-xs text-muted-foreground truncate">📍 {locationData.address}</p>

          {/* Scores */}
          <div className="grid grid-cols-2 gap-4">
            <ScoreBar score={locationData.mikrolage.score} label="Mikrolage" />
            <ScoreBar score={locationData.makrolage.score} label="Makrolage" />
          </div>

          {/* Makrolage */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-primary" /> Makrolage
            </h3>
            <p className="text-xs text-muted-foreground">{locationData.makrolage.description}</p>
            <div className="flex gap-2 flex-wrap">
              {locationData.makrolage.city && <Badge variant="secondary" className="text-[10px]">{locationData.makrolage.city}</Badge>}
              {locationData.makrolage.state && <Badge variant="outline" className="text-[10px]">{locationData.makrolage.state}</Badge>}
            </div>
            {/* Links to market listings */}
            <div className="flex gap-2 flex-wrap mt-2">
              {locationData.makrolage.city && (
                <>
                  <a
                    href={`https://www.immobilienscout24.de/Suche/de/${encodeURIComponent(locationData.makrolage.state || "")}/${encodeURIComponent(locationData.makrolage.city)}/wohnung-mieten`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    <ExternalLink className="h-2.5 w-2.5" /> ImmoScout24
                  </a>
                  <a
                    href={`https://www.immowelt.de/liste/${encodeURIComponent(locationData.makrolage.city.toLowerCase())}/wohnungen/mieten`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    <ExternalLink className="h-2.5 w-2.5" /> ImmoWelt
                  </a>
                  <a
                    href={`https://www.kleinanzeigen.de/s-wohnung-mieten/k0c203l${encodeURIComponent(locationData.makrolage.city)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    <ExternalLink className="h-2.5 w-2.5" /> Kleinanzeigen
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Mikrolage */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-primary" /> Mikrolage
            </h3>
            <p className="text-xs text-muted-foreground">{locationData.mikrolage.description}</p>
            {locationData.mikrolage.pois.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {locationData.mikrolage.pois.slice(0, 12).map((poi, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] px-2 py-1 bg-secondary/50 rounded">
                    <div className="flex items-center gap-1.5">
                      {poiIcon(poi.type)}
                      <span className="truncate max-w-[180px]">{poi.name}</span>
                    </div>
                    <span className="text-muted-foreground shrink-0">{poi.distance < 1000 ? `${poi.distance}m` : `${(poi.distance / 1000).toFixed(1)}km`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Map link */}
          <a
            href={`https://www.openstreetmap.org/?mlat=${locationData.lat}&mlon=${locationData.lon}#map=16/${locationData.lat}/${locationData.lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <MapPin className="h-3 w-3" /> Auf OpenStreetMap ansehen
          </a>
        </div>
      )}
    </div>
  );
};

export default LocationAnalysis;
