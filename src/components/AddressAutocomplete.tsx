import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PhotonFeature {
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

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
  } else if (props.name) {
    parts.push(props.name);
  }
  if (props.postcode || props.city) {
    parts.push([props.postcode, props.city].filter(Boolean).join(" "));
  }
  return parts.join(", ");
};

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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=de&osm_tag=place&osm_tag=highway&bbox=5.87,47.27,15.04,55.06`
      );
      const data = await res.json();
      setSuggestions(data.features || []);
      setShowDropdown(true);
      setHighlightIndex(-1);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
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
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[highlightIndex]);
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
      </div>
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((feature, i) => {
            const addr = formatAddress(feature.properties);
            return (
              <button
                key={i}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors",
                  i === highlightIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50 text-foreground"
                )}
                onMouseEnter={() => setHighlightIndex(i)}
                onClick={() => selectSuggestion(feature)}
              >
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{addr}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
