/**
 * MOB4-15: Mobile PDF Viewer
 * Embedded PDF viewer instead of download. View documents directly in-app.
 * Touch-optimized with zoom, page navigation, sharing.
 */
import { useState, useCallback, useRef, useEffect, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, Share2, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobilePDFViewerProps {
  /** PDF URL or blob URL */
  src: string;
  /** Document title */
  title?: string;
  /** Whether viewer is open */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Additional class */
  className?: string;
  /** Allow download */
  allowDownload?: boolean;
}

export const MobilePDFViewer = memo(function MobilePDFViewer({
  src,
  title = "Dokument",
  open,
  onClose,
  className,
  allowDownload = true,
}: MobilePDFViewerProps) {
  const isMobile = useIsMobile();
  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (open) {
      setZoom(isMobile ? 80 : 100);
      setPage(1);
      setLoading(true);
    }
  }, [open, isMobile]);

  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(z + 25, 300));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(z => Math.max(z - 25, 50));
  }, []);

  const handleDownload = useCallback(() => {
    const link = document.createElement("a");
    link.href = src;
    link.download = title.endsWith(".pdf") ? title : `${title}.pdf`;
    link.click();
  }, [src, title]);

  const handleShare = useCallback(async () => {
    if ("share" in navigator) {
      try {
        await navigator.share({
          title: title,
          url: src,
        });
      } catch {
        // User cancelled
      }
    }
  }, [src, title]);

  if (!open) return null;

  return (
    <div className={cn("fixed inset-0 z-50 flex flex-col bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-background/95 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted active:bg-muted/80 transition-colors shrink-0"
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium truncate">{title}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Zoom controls */}
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-md hover:bg-muted active:bg-muted/80 transition-colors"
            aria-label="Verkleinern"
            disabled={zoom <= 50}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted-foreground min-w-[40px] text-center tabular-nums">
            {zoom}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-md hover:bg-muted active:bg-muted/80 transition-colors"
            aria-label="Vergrößern"
            disabled={zoom >= 300}
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Share */}
          {"share" in navigator && (
            <button
              onClick={handleShare}
              className="p-1.5 rounded-md hover:bg-muted active:bg-muted/80 transition-colors"
              aria-label="Teilen"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}

          {/* Download */}
          {allowDownload && (
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-md hover:bg-muted active:bg-muted/80 transition-colors"
              aria-label="Herunterladen"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* PDF content */}
      <div
        className="flex-1 overflow-auto bg-muted/30"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Dokument wird geladen...</span>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={`${src}#zoom=${zoom}&toolbar=0&navpanes=0`}
          className={cn(
            "w-full h-full border-0",
            loading && "invisible"
          )}
          title={title}
          onLoad={() => setLoading(false)}
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top left",
            width: `${10000 / zoom}%`,
            height: `${10000 / zoom}%`,
          }}
        />
      </div>
    </div>
  );
});

/**
 * Compact PDF preview card that opens fullscreen viewer on tap.
 */
export const MobilePDFPreview = memo(function MobilePDFPreview({
  src,
  title = "Dokument",
  className,
}: {
  src: string;
  title?: string;
  className?: string;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setViewerOpen(true)}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border bg-card",
          "hover:bg-muted/50 active:bg-muted transition-colors text-left w-full",
          className
        )}
      >
        <div className="w-10 h-12 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase">PDF</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{title}</p>
          <p className="text-xs text-muted-foreground">Tippen zum Öffnen</p>
        </div>
        <Maximize2 className="w-4 h-4 text-muted-foreground shrink-0 ml-auto" />
      </button>

      <MobilePDFViewer
        src={src}
        title={title}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
});
