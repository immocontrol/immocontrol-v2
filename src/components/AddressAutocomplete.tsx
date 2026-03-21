import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fetchAddressSuggestions, isGooglePlacesEnabled } from "@/integrations/addressSuggestions";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

const AddressAutocomplete = ({
  value,
  onChange,
  placeholder = "Straße Nr, PLZ Stadt",
  className,
  id,
}: AddressAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<Array<{ formatted: string; subtitle?: string }>>([]);
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
      const results = await fetchAddressSuggestions(query);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
      setHighlightIndex(-1);
    } catch {
      setSuggestions([]);
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

  const selectSuggestion = (suggestion: { formatted: string; subtitle?: string }) => {
    onChange(suggestion.formatted);
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
      e.preventDefault();
      e.stopPropagation();
      if (highlightIndex >= 0 && suggestions[highlightIndex]) {
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
        <div className="absolute z-50 w-full mt-1 overflow-hidden rounded-xl border border-border/80 bg-popover/95 text-popover-foreground shadow-md backdrop-blur-sm" role="listbox" aria-label="Adressvorschläge">
          {suggestions.map((suggestion, i) => (
            <button
              key={`${suggestion.formatted}-${i}`}
              type="button"
              className={cn(
                "w-full text-left px-3 py-2 text-sm flex items-start gap-2 transition-colors",
                i === highlightIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50 text-foreground"
              )}
              onMouseEnter={() => setHighlightIndex(i)}
              onClick={() => selectSuggestion(suggestion)}
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="block truncate font-medium" title={suggestion.formatted}>{suggestion.formatted}</span>
                {suggestion.subtitle && (
                  <span className="block truncate text-xs text-muted-foreground" title={suggestion.subtitle}>{suggestion.subtitle}</span>
                )}
              </div>
            </button>
          ))}
          <div className="px-3 py-1 text-[10px] text-muted-foreground/50 border-t">
            {isGooglePlacesEnabled() ? "Powered by Google" : "Powered by OpenStreetMap"}
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
