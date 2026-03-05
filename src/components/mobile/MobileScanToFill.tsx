/**
 * MOB6-5: Mobile Scan to Fill
 * QR code/barcode scanner for invoices, meter reading barcodes, and energy certificate numbers.
 * Uses camera API for scanning and auto-fills detected data.
 */
import { useState, useCallback, useRef, useEffect, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Camera, ScanLine, X, Check, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScanResult {
  /** Raw scanned value */
  raw: string;
  /** Detected type */
  type: "qr" | "barcode" | "text";
  /** Parsed structured data (if applicable) */
  parsed?: Record<string, string>;
  /** Confidence score 0-1 */
  confidence: number;
}

interface MobileScanToFillProps {
  /** Handler when scan is completed */
  onScan: (result: ScanResult) => void;
  /** Scan button label */
  label?: string;
  /** Accepted scan types */
  acceptTypes?: ScanResult["type"][];
  /** Hint text shown in scanner */
  hint?: string;
  /** Show as full-screen scanner */
  fullscreen?: boolean;
  /** Additional class */
  className?: string;
}

// Parse common QR code formats
function parseQRContent(raw: string): ScanResult {
  // EPC QR Code (SEPA payment)
  if (raw.startsWith("BCD\n") || raw.startsWith("BCD\r\n")) {
    const lines = raw.split(/\r?\n/);
    const parsed: Record<string, string> = {};
    if (lines[4]) parsed.bic = lines[4];
    if (lines[5]) parsed.name = lines[5];
    if (lines[6]) parsed.iban = lines[6];
    if (lines[7]) parsed.amount = lines[7].replace("EUR", "").trim();
    if (lines[9]) parsed.reference = lines[9];
    if (lines[10]) parsed.text = lines[10];
    return { raw, type: "qr", parsed, confidence: 0.95 };
  }

  // URL
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return { raw, type: "qr", parsed: { url: raw }, confidence: 0.9 };
  }

  // vCard
  if (raw.startsWith("BEGIN:VCARD")) {
    const parsed: Record<string, string> = {};
    const nameMatch = raw.match(/FN:(.+)/);
    const telMatch = raw.match(/TEL[^:]*:(.+)/);
    const emailMatch = raw.match(/EMAIL[^:]*:(.+)/);
    if (nameMatch) parsed.name = nameMatch[1].trim();
    if (telMatch) parsed.phone = telMatch[1].trim();
    if (emailMatch) parsed.email = emailMatch[1].trim();
    return { raw, type: "qr", parsed, confidence: 0.9 };
  }

  // Meter reading or numeric code
  if (/^\d{8,20}$/.test(raw.trim())) {
    return { raw: raw.trim(), type: "barcode", parsed: { code: raw.trim() }, confidence: 0.85 };
  }

  return { raw, type: "text", confidence: 0.5 };
}

export const MobileScanToFill = memo(function MobileScanToFill({
  onScan,
  label = "Scannen",
  hint = "QR-Code oder Barcode in den Rahmen halten",
  fullscreen = false,
  className,
}: MobileScanToFillProps) {
  const isMobile = useIsMobile();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check camera availability
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setHasCamera(false);
    }
  }, []);

  const stopScanning = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, []);

  const startScanning = useCallback(async () => {
    setError(null);
    setLastResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsScanning(true);

      // Use BarcodeDetector API if available
      if ("BarcodeDetector" in window) {
        const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string; format: string }>> } }).BarcodeDetector({
          formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39"],
        });

        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const result = parseQRContent(barcodes[0].rawValue);
              setLastResult(result);
              onScan(result);
              stopScanning();
              if (navigator.vibrate) navigator.vibrate(50);
            }
          } catch {
            // Detection error, continue scanning
          }
        }, 500);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kamera-Zugriff fehlgeschlagen";
      setError(msg);
      setIsScanning(false);
    }
  }, [onScan, stopScanning]);

  // Manual input fallback
  const handleManualInput = useCallback(() => {
    const input = prompt("Code manuell eingeben:");
    if (input) {
      const result = parseQRContent(input);
      setLastResult(result);
      onScan(result);
    }
  }, [onScan]);

  return (
    <div className={cn("w-full", className)}>
      {/* Scan button */}
      {!isScanning && (
        <div className="space-y-2">
          <button
            onClick={startScanning}
            disabled={!hasCamera}
            className={cn(
              "flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl",
              "border-2 border-dashed border-primary/30 hover:border-primary/50",
              "hover:bg-primary/5 active:bg-primary/10 transition-all",
              "text-sm font-medium text-primary",
              !hasCamera && "opacity-50 cursor-not-allowed",
              isMobile && "min-h-[56px]"
            )}
            aria-label={label}
          >
            <Camera className="w-5 h-5" />
            {label}
          </button>

          {!hasCamera && (
            <button
              onClick={handleManualInput}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg",
                "text-xs text-muted-foreground hover:bg-muted",
                isMobile && "min-h-[44px]"
              )}
            >
              <ScanLine className="w-3.5 h-3.5" />
              Code manuell eingeben
            </button>
          )}
        </div>
      )}

      {/* Scanner view */}
      {isScanning && (
        <div className={cn(
          "relative rounded-xl overflow-hidden bg-black",
          fullscreen ? "fixed inset-0 z-50" : "aspect-video"
        )}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scan overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-48 relative">
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br" />

              {/* Scanning line animation */}
              <div className="absolute left-1 right-1 h-0.5 bg-primary animate-pulse"
                style={{ top: "50%", boxShadow: "0 0 8px rgba(var(--primary), 0.5)" }}
              />
            </div>
          </div>

          {/* Hint text */}
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <p className="text-xs text-white/80 bg-black/40 px-3 py-1.5 rounded-full inline-block">
              {hint}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={stopScanning}
            className={cn(
              "absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white",
              "hover:bg-black/70 transition-colors",
              isMobile && "min-w-[44px] min-h-[44px] flex items-center justify-center"
            )}
            aria-label="Scanner schließen"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Loading indicator */}
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/50 rounded-full px-3 py-1.5">
            <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            <span className="text-[10px] text-white">Scanne...</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/20">
          <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <span className="text-xs text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Last result */}
      {lastResult && !isScanning && (
        <div className="mt-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-xs font-medium text-green-700 dark:text-green-400">
              {lastResult.type === "qr" ? "QR-Code" : "Barcode"} erkannt
            </span>
          </div>
          {lastResult.parsed && Object.keys(lastResult.parsed).length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {Object.entries(lastResult.parsed).map(([key, value]) => (
                <p key={key} className="text-[10px] text-muted-foreground">
                  <span className="font-medium capitalize">{key}:</span> {value}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
