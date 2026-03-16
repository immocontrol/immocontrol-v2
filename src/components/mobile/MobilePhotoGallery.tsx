/**
 * MOB4-3: Mobile Property Photo Gallery
 * Fullscreen swipe gallery with pinch-to-zoom for property images.
 * Touch-optimized with indicator dots and counter.
 */
import { useState, useRef, useCallback, useEffect, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

interface GalleryImage {
  src: string;
  alt?: string;
  caption?: string;
}

interface MobilePhotoGalleryProps {
  images: GalleryImage[];
  /** Initial image index */
  initialIndex?: number;
  /** Called when gallery is closed */
  onClose?: () => void;
  /** Whether gallery is open */
  open?: boolean;
  /** Additional class for thumbnails container */
  className?: string;
}

export const MobilePhotoGallery = memo(function MobilePhotoGallery({
  images,
  initialIndex = 0,
  onClose,
  open = false,
  className,
}: MobilePhotoGalleryProps) {
  const isMobile = useIsMobile();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const touchStart = useRef<{ x: number; y: number; dist: number; scale: number }>({ x: 0, y: 0, dist: 0, scale: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [initialIndex, open]);

  const goTo = useCallback((index: number) => {
    if (index >= 0 && index < images.length) {
      setCurrentIndex(index);
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    }
  }, [images.length]);

  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

  // Touch handlers for swipe and pinch
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        dist: 0,
        scale,
      };
      isDragging.current = true;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStart.current = {
        ...touchStart.current,
        dist: Math.sqrt(dx * dx + dy * dy),
        scale,
      };
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch to zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (touchStart.current.dist > 0) {
        const newScale = Math.min(4, Math.max(1, touchStart.current.scale * (dist / touchStart.current.dist)));
        setScale(newScale);
      }
    } else if (e.touches.length === 1 && scale > 1 && isDragging.current) {
      // Pan when zoomed
      const dx = e.touches[0].clientX - touchStart.current.x;
      const dy = e.touches[0].clientY - touchStart.current.y;
      setTranslate({ x: dx, y: dy });
    }
  }, [scale]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (scale <= 1 && isDragging.current && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const threshold = 60;
      if (Math.abs(dx) > threshold) {
        if (dx > 0) goPrev();
        else goNext();
      }
    }
    isDragging.current = false;

    // Snap back if scale is close to 1
    if (scale < 1.1) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    }
  }, [scale, goNext, goPrev]);

  // Double tap to zoom
  const lastTap = useRef(0);
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setScale(prev => (prev > 1 ? 1 : 2.5));
      setTranslate({ x: 0, y: 0 });
    }
    lastTap.current = now;
  }, []);

  if (!open || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      role="dialog"
      aria-label="Fotogalerie"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm text-white z-10">
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Schließen"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium">
          {currentIndex + 1} / {images.length}
        </span>
        <button
          onClick={() => setScale(prev => (prev > 1 ? 1 : 2.5))}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Zoomen"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleDoubleTap}
      >
        <img
          src={currentImage.src}
          alt={currentImage.alt || `Bild ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
            transition: isDragging.current ? "none" : "transform 0.2s ease-out",
          }}
          draggable={false}
        />

        {/* Navigation arrows (desktop) */}
        {!isMobile && currentIndex > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label="Vorheriges Bild"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {!isMobile && currentIndex < images.length - 1 && (
          <button
            onClick={goNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label="Nächstes Bild"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Caption */}
      {currentImage.caption && (
        <div className="px-4 py-2 bg-black/80 text-white/80 text-center text-sm">
          {currentImage.caption}
        </div>
      )}

      {/* Indicator dots */}
      {images.length > 1 && images.length <= 20 && (
        <div className="flex justify-center gap-1.5 py-3 bg-black/80">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                idx === currentIndex
                  ? "bg-white w-4"
                  : "bg-white/40 hover:bg-white/60"
              )}
              aria-label={`Bild ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/** Thumbnail grid for triggering gallery */
export const MobilePhotoThumbnails = memo(function MobilePhotoThumbnails({
  images,
  className,
  maxVisible = 4,
}: {
  images: GalleryImage[];
  className?: string;
  maxVisible?: number;
}) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);

  const openGallery = useCallback((index: number) => {
    setStartIndex(index);
    setGalleryOpen(true);
  }, []);

  if (images.length === 0) return null;

  const visibleImages = images.slice(0, maxVisible);
  const remaining = images.length - maxVisible;

  return (
    <>
      <div className={cn("grid grid-cols-4 gap-1.5 rounded-lg overflow-hidden", className)}>
        {visibleImages.map((img, idx) => (
          <button
            key={idx}
            onClick={() => openGallery(idx)}
            className={cn(
              "relative aspect-square overflow-hidden",
              idx === 0 && visibleImages.length > 1 && "col-span-2 row-span-2"
            )}
          >
            <img
              src={img.src}
              alt={img.alt || `Bild ${idx + 1}`}
              className="w-full h-full object-cover hover:scale-105 transition-transform"
              loading="lazy"
            />
            {idx === maxVisible - 1 && remaining > 0 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white font-bold text-lg">+{remaining}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      <MobilePhotoGallery
        images={images}
        initialIndex={startIndex}
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
      />
    </>
  );
});
