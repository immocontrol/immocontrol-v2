/**
 * MOB6-6: Mobile Multi-Step Upload
 * Batch upload with progress, thumbnail preview, drag-to-reorder and auto-categorization.
 * Optimized for mobile with touch-friendly controls.
 */
import { useState, useCallback, useRef, useEffect, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Upload, X, FileText, Image, File, Check, Loader2,
  GripVertical, Trash2, Tag, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  preview?: string;
  category?: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

interface MobileMultiStepUploadProps {
  /** Upload handler — should upload a single file and return URL */
  onUpload: (file: File, category?: string) => Promise<string>;
  /** Called when all uploads are complete */
  onComplete?: (files: Array<{ name: string; url: string; category?: string }>) => void;
  /** Accepted file types */
  accept?: string;
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Maximum number of files */
  maxFiles?: number;
  /** Available categories for auto-categorization */
  categories?: string[];
  /** Additional class */
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="w-4 h-4" />;
  if (type.includes("pdf")) return <FileText className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
}

function guessCategory(fileName: string, categories: string[]): string | undefined {
  const lower = fileName.toLowerCase();
  const categoryMap: Record<string, string[]> = {
    "Mietvertrag": ["mietvertrag", "vertrag", "contract", "lease"],
    "Rechnung": ["rechnung", "invoice", "bill"],
    "Grundbuch": ["grundbuch", "land", "register"],
    "Protokoll": ["protokoll", "protocol", "minutes"],
    "Energieausweis": ["energieausweis", "energy", "epc"],
    "Foto": ["foto", "photo", "bild", "image", "img"],
    "Exposé": ["expose", "exposé", "listing"],
    "Nebenkostenabrechnung": ["nebenkosten", "nk", "utility"],
    "Übergabeprotokoll": ["übergabe", "handover"],
    "Gutachten": ["gutachten", "appraisal", "assessment"],
  };

  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (categories.includes(category) && keywords.some(k => lower.includes(k))) {
      return category;
    }
  }
  return undefined;
}

let nextId = 0;

export const MobileMultiStepUpload = memo(function MobileMultiStepUpload({
  onUpload,
  onComplete,
  accept = "*/*",
  maxFileSize = 20 * 1024 * 1024, // 20 MB
  maxFiles = 10,
  categories = ["Mietvertrag", "Rechnung", "Foto", "Protokoll", "Sonstiges"],
  className,
}: MobileMultiStepUploadProps) {
  const isMobile = useIsMobile();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);

  // Cleanup object URLs on unmount to prevent memory leaks (capture ref so cleanup sees current URLs)
  useEffect(() => {
    const urlsRef = objectUrlsRef;
    return () => {
      urlsRef.current.forEach(url => URL.revokeObjectURL(url));
      urlsRef.current = [];
    };
  }, []);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const remaining = maxFiles - files.length;
    const toAdd = fileArray.slice(0, remaining);

    const uploadFiles: UploadFile[] = toAdd.map(file => {
      const id = `file-${++nextId}`;
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      if (preview) objectUrlsRef.current.push(preview);
      const category = guessCategory(file.name, categories);

      return {
        id,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        preview,
        category,
        progress: 0,
        status: file.size > maxFileSize ? "error" : "pending",
        error: file.size > maxFileSize ? `Datei zu groß (max. ${formatFileSize(maxFileSize)})` : undefined,
      };
    });

    setFiles(prev => [...prev, ...uploadFiles]);
  }, [files.length, maxFiles, maxFileSize, categories]);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const updateCategory = useCallback((id: string, category: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, category } : f));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
    setDragOverIndex(null);
  }, [addFiles]);

  const handleStartUpload = useCallback(async () => {
    const pendingFiles = files.filter(f => f.status === "pending");
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    const results: Array<{ name: string; url: string; category?: string }> = [];

    for (const uploadFile of pendingFiles) {
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id ? { ...f, status: "uploading" as const, progress: 10 } : f
      ));

      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          setFiles(prev => prev.map(f =>
            f.id === uploadFile.id && f.progress < 90
              ? { ...f, progress: f.progress + 10 }
              : f
          ));
        }, 200);

        const url = await onUpload(uploadFile.file, uploadFile.category);

        clearInterval(progressInterval);
        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id ? { ...f, status: "done" as const, progress: 100 } : f
        ));
        results.push({ name: uploadFile.name, url, category: uploadFile.category });
      } catch (err) {
        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id
            ? { ...f, status: "error" as const, error: err instanceof Error ? err.message : "Upload fehlgeschlagen" }
            : f
        ));
      }
    }

    setIsUploading(false);
    if (results.length > 0) {
      onComplete?.(results);
    }
  }, [files, onUpload, onComplete]);

  const allDone = files.length > 0 && files.every(f => f.status === "done" || f.status === "error");
  const pendingCount = files.filter(f => f.status === "pending").length;

  return (
    <div className={cn("w-full space-y-3", className)}>
      {/* Drop zone / Add files button */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOverIndex(-1); }}
        onDragLeave={() => setDragOverIndex(null)}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer",
          dragOverIndex === -1 ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/40",
          files.length >= maxFiles && "opacity-50 pointer-events-none"
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          className="hidden"
        />
        <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium">Dateien auswählen</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Max. {maxFiles} Dateien, je {formatFileSize(maxFileSize)}
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((file, index) => (
            <div
              key={file.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg border",
                "transition-all",
                file.status === "error" && "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20",
                file.status === "done" && "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20",
                dragOverIndex === index && "ring-2 ring-primary"
              )}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", String(index))}
              onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
              onDrop={(e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
                if (!isNaN(fromIndex) && fromIndex !== index) {
                  setFiles(prev => {
                    const copy = [...prev];
                    const [moved] = copy.splice(fromIndex, 1);
                    copy.splice(index, 0, moved);
                    return copy;
                  });
                }
                setDragOverIndex(null);
              }}
            >
              {/* Drag handle */}
              <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0 cursor-grab" />

              {/* Thumbnail / icon */}
              {file.preview ? (
                <img src={file.preview} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                  {getFileIcon(file.type)}
                </div>
              )}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{file.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</span>
                  {file.status === "uploading" && (
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}
                  {file.error && (
                    <span className="text-[10px] text-red-600">{file.error}</span>
                  )}
                </div>
              </div>

              {/* Category selector */}
              {file.status === "pending" && (
                <div className="relative shrink-0">
                  <select
                    value={file.category || ""}
                    onChange={(e) => updateCategory(file.id, e.target.value)}
                    className={cn(
                      "text-[10px] px-2 py-1 rounded border bg-background appearance-none pr-5",
                      isMobile && "min-h-[32px]"
                    )}
                  >
                    <option value="">Kategorie</option>
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-muted-foreground" />
                </div>
              )}

              {/* Status / Remove */}
              {file.status === "done" ? (
                <Check className="w-4 h-4 text-green-600 shrink-0" />
              ) : file.status === "uploading" ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
              ) : (
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-1 rounded hover:bg-muted shrink-0"
                  aria-label="Entfernen"
                >
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {pendingCount > 0 && (
        <button
          onClick={handleStartUpload}
          disabled={isUploading}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl",
            "bg-primary text-primary-foreground font-medium text-sm",
            "hover:bg-primary/90 disabled:opacity-50 transition-colors",
            isMobile && "min-h-[48px]"
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Wird hochgeladen...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              {pendingCount} {pendingCount === 1 ? "Datei" : "Dateien"} hochladen
            </>
          )}
        </button>
      )}

      {/* Summary */}
      {allDone && (
        <div className="text-center py-2">
          <Check className="w-6 h-6 text-green-600 mx-auto mb-1" />
          <p className="text-xs font-medium text-green-700 dark:text-green-400">
            Alle Uploads abgeschlossen
          </p>
        </div>
      )}
    </div>
  );
});
