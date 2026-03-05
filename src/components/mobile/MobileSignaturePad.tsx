/**
 * MOB5-9: Mobile Signature Pad
 * Touch signature drawing pad for contracts and protocols.
 * Supports drawing with finger/stylus, undo, clear, and export as data URL.
 */
import { useRef, useState, useCallback, useEffect, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Undo2, Trash2, Check, Pen } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileSignaturePadProps {
  /** Callback when signature is completed */
  onComplete?: (dataUrl: string) => void;
  /** Callback when signature is cleared */
  onClear?: () => void;
  /** Pen color */
  penColor?: string;
  /** Pen width */
  penWidth?: number;
  /** Canvas height */
  height?: number;
  /** Placeholder text */
  placeholder?: string;
  /** Additional class */
  className?: string;
}

interface Point {
  x: number;
  y: number;
}

export const MobileSignaturePad = memo(function MobileSignaturePad({
  onComplete,
  onClear,
  penColor = "#1a1a1a",
  penWidth = 2.5,
  height = 200,
  placeholder = "Hier unterschreiben",
  className,
}: MobileSignaturePadProps) {
  const isMobile = useIsMobile();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const pathsRef = useRef<Point[][]>([]);
  const currentPathRef = useRef<Point[]>([]);

  // Set up canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;

      // Redraw existing paths after canvas reset
      for (const path of pathsRef.current) {
        if (path.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
      }
    }
  }, [penColor, penWidth]);

  const getPoint = useCallback((e: React.TouchEvent | React.MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  }, []);

  const drawLine = useCallback((from: Point, to: Point) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }, []);

  const handleStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const point = getPoint(e);
    currentPathRef.current = [point];
    setIsDrawing(true);
    setHasSignature(true);
  }, [getPoint]);

  const handleMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const point = getPoint(e);
    const lastPoint = currentPathRef.current[currentPathRef.current.length - 1];
    if (lastPoint) {
      drawLine(lastPoint, point);
    }
    currentPathRef.current.push(point);
  }, [isDrawing, getPoint, drawLine]);

  const handleEnd = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    pathsRef.current.push([...currentPathRef.current]);
    currentPathRef.current = [];
  }, [isDrawing]);

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;

    for (const path of pathsRef.current) {
      if (path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.stroke();
    }
  }, [penColor, penWidth]);

  const handleUndo = useCallback(() => {
    pathsRef.current.pop();
    if (pathsRef.current.length === 0) {
      setHasSignature(false);
    }
    redrawAll();
  }, [redrawAll]);

  const handleClear = useCallback(() => {
    pathsRef.current = [];
    currentPathRef.current = [];
    setHasSignature(false);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }

    onClear?.();
  }, [onClear]);

  const handleComplete = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    const dataUrl = canvas.toDataURL("image/png");
    onComplete?.(dataUrl);
  }, [hasSignature, onComplete]);

  return (
    <div className={cn("w-full", className)}>
      {/* Canvas area */}
      <div className="relative rounded-lg border-2 border-dashed border-border bg-card overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full touch-none cursor-crosshair"
          style={{ height }}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
        />

        {/* Placeholder */}
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-muted-foreground/50">
              <Pen className="w-4 h-4" />
              <span className="text-sm">{placeholder}</span>
            </div>
          </div>
        )}

        {/* Signature line */}
        <div className="absolute bottom-8 left-6 right-6 border-b border-muted-foreground/20" />
        <span className="absolute bottom-2 left-6 text-[10px] text-muted-foreground/40">
          Unterschrift
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex gap-2">
          <button
            onClick={handleUndo}
            disabled={!hasSignature}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs rounded-md border",
              "hover:bg-muted active:bg-muted/80 transition-colors",
              "disabled:opacity-30 disabled:cursor-not-allowed",
              isMobile && "min-h-[44px]"
            )}
            aria-label="Rückgängig"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Rückgängig</span>
          </button>
          <button
            onClick={handleClear}
            disabled={!hasSignature}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs rounded-md border",
              "hover:bg-muted active:bg-muted/80 transition-colors text-destructive",
              "disabled:opacity-30 disabled:cursor-not-allowed",
              isMobile && "min-h-[44px]"
            )}
            aria-label="Löschen"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Löschen</span>
          </button>
        </div>

        <button
          onClick={handleComplete}
          disabled={!hasSignature}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md",
            "bg-primary text-primary-foreground",
            "hover:bg-primary/90 transition-colors",
            "disabled:opacity-30 disabled:cursor-not-allowed",
            isMobile && "min-h-[44px]"
          )}
          aria-label="Unterschrift bestätigen"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Bestätigen</span>
        </button>
      </div>
    </div>
  );
});
