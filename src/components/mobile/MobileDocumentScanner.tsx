/**
 * MOB2-14: Mobile Dokument-Scanner Workflow
 * Photo → Auto-Crop → OCR-Preview → Category → Upload workflow.
 * Step-by-step fullscreen scanner experience on mobile.
 */
import { memo, useState, useCallback, useRef } from "react";
import { Camera, Crop, FileText, Tag, Upload, X, RotateCcw, Check, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

type ScanStep = "capture" | "crop" | "preview" | "categorize" | "upload";

interface DocumentCategory {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface MobileDocumentScannerProps {
  open: boolean;
  onClose: () => void;
  onComplete: (result: {
    imageData: string;
    ocrText: string;
    category: string;
  }) => void;
  /** Available document categories */
  categories?: DocumentCategory[];
  className?: string;
}

const DEFAULT_CATEGORIES: DocumentCategory[] = [
  { id: "mietvertrag", label: "Mietvertrag" },
  { id: "nebenkostenabrechnung", label: "Nebenkostenabrechnung" },
  { id: "rechnung", label: "Rechnung" },
  { id: "versicherung", label: "Versicherung" },
  { id: "protokoll", label: "Protokoll" },
  { id: "grundbuch", label: "Grundbuchauszug" },
  { id: "steuer", label: "Steuerbescheid" },
  { id: "sonstiges", label: "Sonstiges" },
];

const STEP_CONFIG: Record<ScanStep, { label: string; icon: React.ReactNode; index: number }> = {
  capture: { label: "Foto aufnehmen", icon: <Camera className="h-4 w-4" />, index: 0 },
  crop: { label: "Zuschneiden", icon: <Crop className="h-4 w-4" />, index: 1 },
  preview: { label: "OCR-Vorschau", icon: <FileText className="h-4 w-4" />, index: 2 },
  categorize: { label: "Kategorie", icon: <Tag className="h-4 w-4" />, index: 3 },
  upload: { label: "Hochladen", icon: <Upload className="h-4 w-4" />, index: 4 },
};

export const MobileDocumentScanner = memo(function MobileDocumentScanner({
  open, onClose, onComplete, categories = DEFAULT_CATEGORIES, className,
}: MobileDocumentScannerProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [step, setStep] = useState<ScanStep>("capture");
  const [imageData, setImageData] = useState<string>("");
  const [ocrText, setOcrText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("capture");
    setImageData("");
    setOcrText("");
    setSelectedCategory("");
    setUploading(false);
  }, []);

  const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    haptic.medium();
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageData(result);
      // Skip crop step for now, go to preview
      setStep("preview");
      // Simulate OCR text extraction
      setOcrText("Dokument wird analysiert...\n\nText wird automatisch erkannt.");
    };
    reader.readAsDataURL(file);
  }, [haptic]);

  const handleCategorize = useCallback((categoryId: string) => {
    haptic.tap();
    setSelectedCategory(categoryId);
  }, [haptic]);

  const handleUpload = useCallback(async () => {
    if (!selectedCategory) {
      haptic.error();
      return;
    }
    setUploading(true);
    haptic.medium();
    setStep("upload");

    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    haptic.success();
    onComplete({
      imageData,
      ocrText,
      category: selectedCategory,
    });
    reset();
    onClose();
  }, [selectedCategory, imageData, ocrText, haptic, onComplete, onClose, reset]);

  if (!open || !isMobile) return null;

  const currentStepConfig = STEP_CONFIG[step];
  const progress = ((currentStepConfig.index + 1) / 5) * 100;

  return (
    <div className={cn("fixed inset-0 z-[300] bg-background flex flex-col", className)}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={() => { reset(); onClose(); }} className="p-2 -ml-2 rounded-lg hover:bg-secondary">
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-sm font-semibold">
          {currentStepConfig.icon}
          {currentStepConfig.label}
        </div>
        <span className="text-xs text-muted-foreground">
          {currentStepConfig.index + 1}/5
        </span>
      </div>

      {/* Progress bar */}
      <div className="shrink-0 h-1 bg-secondary">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        {/* Step: Capture */}
        {step === "capture" && (
          <div className="flex flex-col items-center justify-center h-full px-6 gap-6">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Dokument scannen</h3>
              <p className="text-sm text-muted-foreground">
                Nehmen Sie ein Foto des Dokuments auf oder wählen Sie ein Bild aus der Galerie.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCapture}
              className="hidden"
            />
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <Camera className="h-5 w-5" /> Foto aufnehmen
              </button>
              <button
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = (e) => handleCapture(e as unknown as React.ChangeEvent<HTMLInputElement>);
                  input.click();
                }}
                className="w-full py-3 rounded-xl bg-secondary text-foreground font-medium text-sm active:scale-[0.98] transition-transform"
              >
                Aus Galerie wählen
              </button>
            </div>
          </div>
        )}

        {/* Step: Preview (OCR) */}
        {step === "preview" && (
          <div className="p-4 space-y-4">
            {imageData && (
              <div className="rounded-xl overflow-hidden border border-border">
                <img src={imageData} alt="Gescanntes Dokument" className="w-full max-h-[40vh] object-contain bg-secondary" />
              </div>
            )}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" /> Erkannter Text
              </h4>
              <div className="rounded-xl border border-border bg-secondary/30 p-3">
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{ocrText}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-medium flex items-center justify-center gap-1"
              >
                <RotateCcw className="h-4 w-4" /> Neu aufnehmen
              </button>
              <button
                onClick={() => { haptic.tap(); setStep("categorize"); }}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1"
              >
                Weiter <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step: Categorize */}
        {step === "categorize" && (
          <div className="p-4 space-y-4">
            <h4 className="text-sm font-semibold">Dokumentkategorie wählen</h4>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategorize(cat.id)}
                  className={cn(
                    "p-3 rounded-xl border text-left text-sm font-medium transition-all active:scale-[0.97]",
                    selectedCategory === cat.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-secondary/50",
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="flex flex-col items-center justify-center h-full px-6 gap-4">
            {uploading ? (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">Dokument wird hochgeladen...</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-profit/10 flex items-center justify-center">
                  <Check className="h-8 w-8 text-profit" />
                </div>
                <p className="text-sm font-semibold">Dokument erfolgreich hochgeladen</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom action for categorize step */}
      {step === "categorize" && (
        <div className="shrink-0 px-4 py-4 border-t border-border"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            onClick={handleUpload}
            disabled={!selectedCategory || uploading}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            <Upload className="h-5 w-5" /> Hochladen
          </button>
        </div>
      )}
    </div>
  );
});
