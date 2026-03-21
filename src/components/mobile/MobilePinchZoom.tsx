/**
 * MOB3-7: Mobile Pinch-to-Zoom on Charts
 * Pinch gesture for zooming on charts/graphs.
 * Safari-safe: uses touch events, prevents default zoom behavior.
 */
import { memo, useRef, useState, useCallback, type ReactNode } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobilePinchZoomProps {
  children: ReactNode;
  /** Min zoom level (default: 1) */
  minZoom?: number;
  /** Max zoom level (default: 3) */
  maxZoom?: number;
  className?: string;
}

export const MobilePinchZoom = memo(function MobilePinchZoom({
  children, minZoom = 1, maxZoom = 3, className,
}: MobilePinchZoomProps) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const initialDistance = useRef(0);
  const initialScale = useRef(1);
  const lastPanPos = useRef<{ x: number; y: number } | null>(null);
  const isPinching = useRef(false);

  const getDistance = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      isPinching.current = true;
      initialDistance.current = getDistance(e.touches[0], e.touches[1]);
      initialScale.current = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPinching.current) {
      e.preventDefault();
      const dist = getDistance(e.touches[0], e.touches[1]);
      const ratio = dist / initialDistance.current;
      const newScale = Math.min(maxZoom, Math.max(minZoom, initialScale.current * ratio));
      setScale(newScale);
    } else if (e.touches.length === 1 && scale > 1 && lastPanPos.current) {
      const dx = e.touches[0].clientX - lastPanPos.current.x;
      const dy = e.touches[0].clientY - lastPanPos.current.y;
      lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setTranslate(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    }
  }, [scale, minZoom, maxZoom]);

  const handleTouchEnd = useCallback(() => {
    isPinching.current = false;
    lastPanPos.current = null;
    // Snap back if below min
    if (scale <= 1) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    }
  }, [scale]);

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(maxZoom, prev + 0.5));
  }, [maxZoom]);

  const zoomOut = useCallback(() => {
    const newScale = Math.max(minZoom, scale - 0.5);
    setScale(newScale);
    if (newScale <= 1) setTranslate({ x: 0, y: 0 });
  }, [minZoom, scale]);

  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)} ref={containerRef}>
      {/* Zoom controls */}
      {scale > 1 && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-background/90 backdrop-blur-sm surface-section p-1 shadow-sm">
          <button onClick={zoomOut} className="p-1 rounded hover:bg-secondary" aria-label="Verkleinern">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-mono min-w-[2rem] text-center">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="p-1 rounded hover:bg-secondary" aria-label="Vergrößern">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button onClick={resetZoom} className="p-1 rounded hover:bg-secondary" aria-label="Zurücksetzen">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Zoomable content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="touch-none"
        style={{
          transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
          transformOrigin: "center center",
          transition: isPinching.current ? "none" : "transform 0.2s ease-out",
          /* Safari: force GPU compositing */
          willChange: scale > 1 ? "transform" : "auto",
        }}
      >
        {children}
      </div>

      {/* Zoom hint */}
      {scale === 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground/60 pointer-events-none">
          Pinch zum Zoomen
        </div>
      )}
    </div>
  );
});
