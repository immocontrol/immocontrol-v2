/**
 * MOB-13: Mobile Dokument-Kamera
 * Direct camera access for document upload on mobile.
 * "Beleg fotografieren" button prominent on the documents page.
 * Auto-capture with preview and direct upload.
 */
import { memo, useState, useCallback, useRef } from "react";
import { Camera, Upload, X, RotateCcw, Check, Image } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileDocumentCameraProps {
  /** Callback with captured file */
  onCapture: (file: File) => void;
  /** Accepted file types */
  accept?: string;
  /** Button label */
  label?: string;
  /** Show as prominent button or icon only */
  variant?: "button" | "icon" | "fab";
  className?: string;
}

export const MobileDocumentCamera = memo(function MobileDocumentCamera({
  onCapture, accept = "image/*", label = "Beleg fotografieren",
  variant = "button", className,
}: MobileDocumentCameraProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    haptic.success();
    setCapturedFile(file);

    // Generate preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    setShowOptions(false);
  }, [haptic]);

  const handleConfirm = useCallback(() => {
    if (capturedFile) {
      haptic.success();
      onCapture(capturedFile);
      setPreview(null);
      setCapturedFile(null);
    }
  }, [capturedFile, haptic, onCapture]);

  const handleRetake = useCallback(() => {
    haptic.tap();
    setPreview(null);
    setCapturedFile(null);
    fileInputRef.current?.click();
  }, [haptic]);

  const handleCancel = useCallback(() => {
    setPreview(null);
    setCapturedFile(null);
    setShowOptions(false);
  }, []);

  const openCamera = useCallback(() => {
    haptic.tap();
    fileInputRef.current?.click();
    setShowOptions(false);
  }, [haptic]);

  const openGallery = useCallback(() => {
    haptic.tap();
    galleryInputRef.current?.click();
    setShowOptions(false);
  }, [haptic]);

  // Preview modal
  if (preview) {
    return (
      <div className="fixed inset-0 z-[300] bg-black/90 flex flex-col items-center justify-center p-4 animate-fade-in">
        <div className="relative max-w-full max-h-[70vh] overflow-hidden rounded-xl">
          <img
            src={preview}
            alt="Dokumentvorschau"
            className="max-w-full max-h-[70vh] object-contain rounded-xl"
          />
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={handleCancel} className="h-12 px-6 bg-background/10 border-white/20 text-white hover:bg-white/20">
            <X className="h-5 w-5 mr-2" />
            Verwerfen
          </Button>
          <Button variant="outline" onClick={handleRetake} className="h-12 px-6 bg-background/10 border-white/20 text-white hover:bg-white/20">
            <RotateCcw className="h-5 w-5 mr-2" />
            Nochmal
          </Button>
          <Button onClick={handleConfirm} className="h-12 px-6">
            <Check className="h-5 w-5 mr-2" />
            Verwenden
          </Button>
        </div>
      </div>
    );
  }

  // Hidden file inputs
  const inputs = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        capture="environment"
        onChange={handleCapture}
        className="hidden"
        aria-hidden
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept={accept}
        onChange={handleCapture}
        className="hidden"
        aria-hidden
      />
    </>
  );

  // Option selection popup
  if (showOptions) {
    return (
      <>
        {inputs}
        <div className="fixed inset-0 z-[250] bg-black/50 flex items-end justify-center animate-fade-in" onClick={handleCancel}>
          <div className="w-full max-w-md bg-background rounded-t-2xl p-4 pb-8 space-y-2 animate-slide-up" onClick={e => e.stopPropagation()} style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-3" />
            <button
              onClick={openCamera}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-secondary transition-colors text-left"
            >
              <Camera className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-medium">Kamera</div>
                <div className="text-xs text-muted-foreground">Dokument jetzt fotografieren</div>
              </div>
            </button>
            <button
              onClick={openGallery}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-secondary transition-colors text-left"
            >
              <Image className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-medium">Galerie</div>
                <div className="text-xs text-muted-foreground">Bild aus der Bibliothek wählen</div>
              </div>
            </button>
            <button
              onClick={handleCancel}
              className="w-full flex items-center justify-center px-4 py-3 rounded-xl text-sm text-muted-foreground hover:bg-secondary transition-colors mt-2"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </>
    );
  }

  // Button variants
  if (variant === "fab") {
    return (
      <>
        {inputs}
        <button
          onClick={() => isMobile ? setShowOptions(true) : openGallery()}
          className={cn(
            "fixed z-[180] right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center active:scale-95 transition-transform md:hidden",
            className,
          )}
          style={{ bottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}
          aria-label={label}
        >
          <Camera className="h-6 w-6" />
        </button>
      </>
    );
  }

  if (variant === "icon") {
    return (
      <>
        {inputs}
        <button
          onClick={() => isMobile ? setShowOptions(true) : openGallery()}
          className={cn("p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors", className)}
          aria-label={label}
        >
          <Camera className="h-5 w-5" />
        </button>
      </>
    );
  }

  return (
    <>
      {inputs}
      <Button
        variant="outline"
        onClick={() => isMobile ? setShowOptions(true) : openGallery()}
        className={cn("gap-2", isMobile && "h-12 text-base", className)}
      >
        <Camera className="h-4 w-4" />
        {label}
      </Button>
    </>
  );
});
