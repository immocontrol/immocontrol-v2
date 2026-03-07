import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PhotonFeature {
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
  };
}

import { parseNominatimResponse } from "@/lib/apiValidation";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

const formatAddress = (props: PhotonFeature["properties"]): string => {
  const parts: string[] = [];
  if (props.street) {
    parts.push(props.housenumber ? `${props.street} ${props.housenumber}` : props.street);
  } else if (props.name && props.osm_key !== "place") {
    parts.push(props.name);
  }
  if (props.postcode || props.city) {
    parts.push([props.postcode, props.city].filter(Boolean).join(" "));
  }
  /* If we only have a place name (city/village), show it with state */
  if (parts.length === 0 && props.name) {
    parts.push(props.name);
    if (props.state) parts.push(props.state);
  }
  return parts.join(", ");
};

const formatSubtitle = (props: PhotonFeature["properties"]): string => {
  const parts: string[] = [];
  if (props.district && props.district !== props.city) parts.push(props.district);
  if (props.state) parts.push(props.state);
  if (props.countrycode) parts.push(props.countrycode.toUpperCase());
  return parts.join(", ");
};

/* Fetch from Photon API (primary) with improved parameters for DACH region */
async function fetchPhoton(query: string): Promise<PhotonFeature[]> {
  const params = new URLSearchParams({
    q: query,
    limit: "6",
    lang: "de",
    /* Restrict to DACH region (Germany, Austria, Switzerland) bounding box */
    bbox: "5.87,46.27,16.60,55.10",
  });
  const url = `https://photon.komoot.io/api/?${params}&osm_tag=place&osm_tag=highway&osm_tag=building`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error("Photon API error");
  const data = await res.json();
  return (data.features || []) as PhotonFeature[];
}

/* Fetch from Nominatim API (fallback) — free, no API key needed */
async function fetchNominatim(query: string): Promise<PhotonFeature[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: "5",
    countrycodes: "de,at,ch",
    "accept-language": "de",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": "ImmoControl/2.0" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error("Nominatim API error");
  const raw = await res.json();
  const results = parseNominatimResponse(raw);
  return results.map((r) => {
    const a = r.address ?? {};
    return {
      properties: {
        street: a.road,
        housenumber: a.house_number,
        postcode: a.postcode,
        city: a.city ?? a.town ?? a.village,
        state: a.state,
        country: a.country,
      },
    };
  });
}

const AddressAutocomplete = ({
  value,
  onChange,
  placeholder = "Straße Nr, PLZ Stadt",
  className,
  id,
}: AddressAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    try {
      /* Try Photon first (faster, better for autocomplete) */
      let results = await fetchPhoton(query);
      /* If Photon returns no results, fallback to Nominatim */
      if (results.length === 0) {
        results = await fetchNominatim(query);
      }
      /* Deduplicate by formatted address */
      const seen = new Set<string>();
      const unique = results.filter((f) => {
        const addr = formatAddress(f.properties);
        if (!addr || seen.has(addr)) return false;
        seen.add(addr);
        return true;
      });
      setSuggestions(unique.slice(0, 6));
      setShowDropdown(unique.length > 0);
      setHighlightIndex(-1);
    } catch {
      /* On Photon error, try Nominatim as fallback */
      try {
        const fallback = await fetchNominatim(query);
        setSuggestions(fallback.slice(0, 5));
        setShowDropdown(fallback.length > 0);
      } catch {
        setSuggestions([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250);
  };

  const selectSuggestion = (feature: PhotonFeature) => {
    const formatted = formatAddress(feature.properties);
    onChange(formatted);
    setSuggestions([]);
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      /* Stop propagation so the parent form's onKeyDown doesn't also fire */
      e.preventDefault();
      e.stopPropagation();
      if (highlightIndex >= 0) {
        selectSuggestion(suggestions[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          id={id}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          placeholder={placeholder}
          className={cn("pl-8 h-9 text-sm", className)}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
        )}
      </div>
      {/* IMP-44-12: Add ARIA listbox role and label for screen reader accessibility */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden" role="listbox" aria-label="Adressvorschläge">
          {suggestions.map((feature, i) => {
            const addr = formatAddress(feature.properties);
            const subtitle = formatSubtitle(feature.properties);
            return (
              <button
                key={`${addr}-${i}`}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-2 text-sm flex items-start gap-2 transition-colors",
                  i === highlightIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50 text-foreground"
                )}
                onMouseEnter={() => setHighlightIndex(i)}
                onClick={() => selectSuggestion(feature)}
              >
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="block truncate font-medium">{addr}</span>
                  {subtitle && (
                    <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
                  )}
                </div>
              </button>
            );
          })}
          <div className="px-3 py-1 text-[10px] text-muted-foreground/50 border-t">
            Powered by OpenStreetMap
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
