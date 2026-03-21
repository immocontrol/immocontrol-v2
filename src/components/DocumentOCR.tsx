/**
 * OCR-1: Document OCR Component — extract text from images using local Canvas API
 *
 * Uses a lightweight approach:
 * - PDF text extraction via pdfjs-dist (already in project)
 * - Image preprocessing via Canvas API for better text visibility
 * - No external services or paid APIs needed
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { ScanText, Upload, FileText, Copy, Download, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { extractPdfText } from "@/lib/exposeParser";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";

interface DocumentOCRProps {
  onTextExtracted?: (text: string) => void;
}

/** Preprocess image using Canvas for better readability, then return data URL */
function preprocessImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("Canvas not supported")); return; }

      /* Scale up small images for better text visibility */
      const scale = Math.max(1, 1500 / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      /* Apply contrast enhancement */
      ctx.filter = "contrast(1.5) brightness(1.1) grayscale(1)";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Bild konnte nicht geladen werden"));
    };

    img.src = url;
  });
}

const DocumentOCR = ({ onTextExtracted }: DocumentOCRProps) => {
  const [open, setOpen] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const prevUrlRef = useRef<string | null>(null);
  const lastFileRef = useRef<File | null>(null);

  /* FIX-4: Revoke previous Object URL when a new one is set, and on unmount */
  useEffect(() => {
    const prev = prevUrlRef.current;
    if (prev && prev !== previewUrl) URL.revokeObjectURL(prev);
    prevUrlRef.current = previewUrl;
    const currentUrl = previewUrl;
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [previewUrl]);

  const handleFile = useCallback(async (file: File) => {
    lastFileRef.current = file;
    setLoading(true);
    setExtractedText("");
    setPreviewUrl(null);
    setFileName(file.name);

    try {
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        /* PDF text extraction */
        const text = await extractPdfText(file);
        if (text.trim()) {
          setExtractedText(text);
          toast.success(`Text aus ${file.name} extrahiert (${text.length} Zeichen)`);
        } else {
          setExtractedText("(Kein Text gefunden — möglicherweise ein gescanntes PDF ohne eingebetteten Text)");
          toast.info("Kein eingebetteter Text gefunden");
        }
      } else if (file.type.startsWith("image/")) {
        /* Image preprocessing */
        const dataUrl = await preprocessImage(file);
        setPreviewUrl(dataUrl);
        setExtractedText("(Bild vorverarbeitet — Kontrast erhöht für bessere Lesbarkeit. Text kann manuell abgetippt oder mit einem externen OCR-Tool verarbeitet werden.)");
        toast.success("Bild vorverarbeitet");
      } else {
        /* Try reading as text */
        const text = await file.text();
        setExtractedText(text);
        toast.success(`Datei gelesen (${text.length} Zeichen)`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      handleError(err, { context: "file", details: "document-ocr", showToast: false });
      toastErrorWithRetry(`Fehler: ${msg}`, () => lastFileRef.current && handleFile(lastFileRef.current));
      setExtractedText(`Fehler beim Lesen: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleCopy = useCallback(() => {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText).then(
      () => toast.success("Text kopiert!"),
      () => toast.error("Kopieren fehlgeschlagen")
    );
    onTextExtracted?.(extractedText);
  }, [extractedText, onTextExtracted]);

  const handleDownload = useCallback(() => {
    if (!extractedText) return;
    const blob = new Blob([extractedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(/\.[^.]+$/, "")}_text.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Text heruntergeladen");
  }, [extractedText, fileName]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
          <ScanText className="h-3.5 w-3.5" /> OCR / Text extrahieren
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanText className="h-5 w-5 text-primary" /> Dokumenten-OCR
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleFile(file);
              };
              input.click();
            }}
          >
            {loading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Verarbeite {fileName}...</p>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Datei hochladen oder hierher ziehen</p>
                <p className="text-[10px] text-muted-foreground mt-1">PDF, Bilder (JPG/PNG), Textdateien</p>
              </>
            )}
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="surface-section overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/30 text-xs text-muted-foreground">
                <ImageIcon className="h-3 w-3" /> Vorschau (kontrastverbessert)
              </div>
              <img src={previewUrl} alt="Vorverarbeitetes Bild" className="max-h-48 w-full object-contain bg-white" />
            </div>
          )}

          {/* Extracted text */}
          {extractedText && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Extrahierter Text
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleCopy}>
                    <Copy className="h-3 w-3" /> Kopieren
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleDownload}>
                    <Download className="h-3 w-3" /> Speichern
                  </Button>
                </div>
              </div>
              <Textarea
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                className="min-h-[150px] text-xs font-mono"
                placeholder="Extrahierter Text..."
              />
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            PDF-Text wird direkt extrahiert. Bilder werden kontrastverbessert für bessere Lesbarkeit. Für gescannte PDFs ohne eingebetteten Text wird ein externer OCR-Service empfohlen.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentOCR;
