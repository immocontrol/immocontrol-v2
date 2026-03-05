/**
 * MOB5-12: Mobile Address Lookup
 * Address search with GPS location detection and Nominatim geocoding.
 * Touch-optimized with auto-complete suggestions and map preview link.
 */
import { useState, useCallback, useRef, useEffect, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { MapPin, Navigation, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AddressResult {
  /** Full formatted address */
  displayName: string;
  /** Street */
  street?: string;
  /** House number */
  houseNumber?: string;
  /** City */
  city?: string;
  /** Postal code */
  postalCode?: string;
  /** State/Region */
  state?: string;
  /** Country */
  country?: string;
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
}

interface MobileAddressLookupProps {
  /** Current value */
  value?: string;
  /** Address selected handler */
  onSelect?: (address: AddressResult) => void;
  /** Text change handler */
  onChange?: (value: string) => void;
  /** Placeholder */
  placeholder?: string;
  /** Country filter for search (ISO code) */
  countryCode?: string;
  /** Allow GPS location detection */
  allowGPS?: boolean;
  /** Additional class */
  className?: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    postcode?: string;
    state?: string;
    country?: string;
  };
}

export const MobileAddressLookup = memo(function MobileAddressLookup({
  value = "",
  onSelect,
  onChange,
  placeholder = "Adresse suchen...",
  countryCode = "de",
  allowGPS = true,
  className,
}: MobileAddressLookupProps) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AddressResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value
  useEffect(() => {
    if (value !== query) {
      setQuery(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const searchAddress = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        format: "json",
        addressdetails: "1",
        limit: "5",
        countrycodes: countryCode,
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: {
            "Accept-Language": "de",
          },
        }
      );

      if (!response.ok) throw new Error("Suche fehlgeschlagen");

      const data: NominatimResult[] = await response.json();
      const addresses: AddressResult[] = data.map(item => ({
        displayName: item.display_name,
        street: item.address.road,
        houseNumber: item.address.house_number,
        city: item.address.city || item.address.town || item.address.village,
        postalCode: item.address.postcode,
        state: item.address.state,
        country: item.address.country,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }));

      setResults(addresses);
      setShowResults(addresses.length > 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler bei der Suche");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [countryCode]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange?.(val);

    // Debounced search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchAddress(val);
    }, 400);
  }, [onChange, searchAddress]);

  const handleSelect = useCallback((address: AddressResult) => {
    setQuery(address.displayName);
    setShowResults(false);
    setResults([]);
    onChange?.(address.displayName);
    onSelect?.(address);
  }, [onChange, onSelect]);

  const handleGPSLocate = useCallback(async () => {
    if (!navigator.geolocation) {
      setError("GPS nicht verfügbar");
      return;
    }

    setIsLocating(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode
      const params = new URLSearchParams({
        lat: String(latitude),
        lon: String(longitude),
        format: "json",
        addressdetails: "1",
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${params}`,
        {
          headers: { "Accept-Language": "de" },
        }
      );

      if (!response.ok) throw new Error("Geocoding fehlgeschlagen");

      const data: NominatimResult = await response.json();
      const address: AddressResult = {
        displayName: data.display_name,
        street: data.address.road,
        houseNumber: data.address.house_number,
        city: data.address.city || data.address.town || data.address.village,
        postalCode: data.address.postcode,
        state: data.address.state,
        country: data.address.country,
        lat: latitude,
        lng: longitude,
      };

      handleSelect(address);
    } catch (err) {
      if (err instanceof GeolocationPositionError) {
        setError("GPS-Zugriff verweigert");
      } else {
        setError(err instanceof Error ? err.message : "Standort nicht gefunden");
      }
    } finally {
      setIsLocating(false);
    }
  }, [handleSelect]);

  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setShowResults(false);
    setError(null);
    onChange?.("");
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div className={cn("relative w-full", className)}>
      {/* Input field */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder={placeholder}
          className={cn(
            "w-full pl-9 pr-20 py-2.5 text-sm rounded-lg border bg-card",
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
            "placeholder:text-muted-foreground/50",
            isMobile && "min-h-[44px] text-base",
            error && "border-destructive"
          )}
          autoComplete="off"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isSearching && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
          {query && !isSearching && (
            <button
              onClick={handleClear}
              className="p-1 rounded-full hover:bg-muted transition-colors"
              aria-label="Eingabe löschen"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
          {allowGPS && (
            <button
              onClick={handleGPSLocate}
              disabled={isLocating}
              className={cn(
                "p-1.5 rounded-md hover:bg-muted active:bg-muted/80 transition-colors",
                isLocating && "animate-pulse"
              )}
              aria-label="GPS-Standort verwenden"
              title="Meinen Standort verwenden"
            >
              {isLocating ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <Navigation className="w-4 h-4 text-primary" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-destructive mt-1 px-1">{error}</p>
      )}

      {/* Results dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-lg border bg-background shadow-lg overflow-hidden">
          {results.map((result, index) => (
            <button
              key={index}
              onClick={() => handleSelect(result)}
              className={cn(
                "w-full flex items-start gap-2.5 px-3 py-2.5 text-left",
                "hover:bg-muted active:bg-muted/80 transition-colors border-b last:border-0",
                isMobile && "min-h-[44px]"
              )}
            >
              <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium leading-snug">
                  {result.street && (
                    <>
                      {result.street} {result.houseNumber}
                      {result.postalCode && `, ${result.postalCode}`}
                      {result.city && ` ${result.city}`}
                    </>
                  )}
                  {!result.street && result.displayName.split(",").slice(0, 2).join(",")}
                </p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {result.displayName}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
