/**
 * MOB5-7: Mobile Map Preview
 * Inline map preview for property addresses using OpenStreetMap.
 * Tap to expand fullscreen. No API key required (uses OSM tiles).
 * Replaces MOB5-7 SortChips (MobileQuickFilterChips already covers sorting/filtering).
 */
import { useState, useCallback, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { MapPin, Maximize2, X, Navigation, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileMapPreviewProps {
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
  /** Address label */
  address?: string;
  /** Zoom level (1-18) */
  zoom?: number;
  /** Preview height */
  height?: number;
  /** Allow fullscreen expansion */
  expandable?: boolean;
  /** Additional class */
  className?: string;
}

function getStaticMapUrl(lat: number, lng: number, zoom: number, width: number, height: number): string {
  // Use OpenStreetMap tile server for static preview
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.003},${lng + 0.005},${lat + 0.003}&layer=mapnik&marker=${lat},${lng}`;
}

function getOsmUrl(lat: number, lng: number, zoom: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}

function getGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export const MobileMapPreview = memo(function MobileMapPreview({
  lat,
  lng,
  address,
  zoom = 15,
  height = 160,
  expandable = true,
  className,
}: MobileMapPreviewProps) {
  const isMobile = useIsMobile();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const openInMaps = useCallback(() => {
    // On mobile, prefer native maps app
    if (isMobile && /iPhone|iPad/.test(navigator.userAgent)) {
      window.open(`maps://maps.apple.com/?q=${lat},${lng}`, "_blank");
    } else {
      window.open(getGoogleMapsUrl(lat, lng), "_blank", "noopener,noreferrer");
    }
  }, [lat, lng, isMobile]);

  const embedUrl = getStaticMapUrl(lat, lng, zoom, 400, height);

  return (
    <>
      {/* Compact preview */}
      <div className={cn("relative rounded-lg overflow-hidden border bg-muted", className)}>
        {/* Map iframe */}
        <div style={{ height }} className="relative">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <MapPin className="w-6 h-6 text-muted-foreground animate-pulse" />
            </div>
          )}
          <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            title={address || "Kartenvorschau"}
            onLoad={() => setIframeLoaded(true)}
            loading="lazy"
          />
        </div>

        {/* Address overlay */}
        {address && (
          <div className="px-3 py-2 bg-background/95 backdrop-blur-sm border-t">
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground leading-snug flex-1">{address}</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="absolute top-2 right-2 flex gap-1">
          {expandable && (
            <button
              onClick={() => setIsFullscreen(true)}
              className={cn(
                "p-1.5 rounded-md bg-background/80 backdrop-blur-sm border shadow-sm",
                "hover:bg-background transition-colors",
                isMobile && "min-w-[36px] min-h-[36px] flex items-center justify-center"
              )}
              aria-label="Karte vergrößern"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={openInMaps}
            className={cn(
              "p-1.5 rounded-md bg-background/80 backdrop-blur-sm border shadow-sm",
              "hover:bg-background transition-colors",
              isMobile && "min-w-[36px] min-h-[36px] flex items-center justify-center"
            )}
            aria-label="In Maps öffnen"
          >
            <Navigation className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
              {address && (
                <span className="text-sm font-medium truncate">{address}</span>
              )}
            </div>
            <button
              onClick={openInMaps}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium",
                "rounded-md bg-primary text-primary-foreground",
                "hover:bg-primary/90 transition-colors",
                isMobile && "min-h-[36px]"
              )}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              In Maps öffnen
            </button>
          </div>
          <div className="flex-1">
            <iframe
              src={getOsmUrl(lat, lng, zoom)}
              className="w-full h-full border-0"
              title={address || "Karte"}
            />
          </div>
        </div>
      )}
    </>
  );
});
