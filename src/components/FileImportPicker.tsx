/* BUG-11: Mobile file import picker — shows app selection menu on mobile
 * Allows importing files from OneDrive, Google Drive, iCloud, Telegram, WhatsApp etc.
 * On desktop, falls back to the native file picker.
 * Used by all file upload components (PDF, CSV, images). */
import { useState, useRef, useCallback } from "react";
import { Upload, Cloud, Smartphone, FileText, X, FolderOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FileImportPickerProps {
  /** File accept types, e.g. ".pdf,.csv" */
  accept?: string;
  /* IMPROVE-16: Support multiple files + disabled state (usable across all import menus) */
  /** Allow selecting multiple files */
  multiple?: boolean;
  /** Called when user selects a single file (default) */
  onFile: (file: File) => void;
  /** Called when user selects multiple files (optional) */
  onFiles?: (files: File[]) => void;
  /** Button label */
  label?: string;
  /** Button variant */
  variant?: "default" | "outline" | "ghost";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Additional className for the trigger button */
  className?: string;
  /** Disable the trigger */
  disabled?: boolean;
  /** Icon to show on trigger button */
  icon?: React.ReactNode;
  /** Max file size in bytes (default 30MB) */
  maxSize?: number;
  /** Children to render as trigger (overrides default button) */
  children?: React.ReactNode;
}

/* BUG-11: Cloud storage sources for mobile import — ordered by popularity on iOS/Android */
const CLOUD_SOURCES = [
  { id: "device", label: "Vom Gerät", description: "Fotos, Kamera & lokale Dateien", icon: Smartphone, color: "text-primary" },
  { id: "icloud", label: "iCloud", description: "Apple iCloud Drive", icon: Cloud, color: "text-gray-500" },
  { id: "gdrive", label: "Google Drive", description: "Google Drive Dateien", icon: Cloud, color: "text-green-500" },
  { id: "onedrive", label: "OneDrive", description: "Microsoft OneDrive", icon: Cloud, color: "text-blue-500" },
  { id: "dropbox", label: "Dropbox", description: "Dropbox Dateien", icon: Cloud, color: "text-blue-600" },
  { id: "files", label: "Andere App", description: "Telegram, WhatsApp, E-Mail", icon: FolderOpen, color: "text-orange-500" },
] as const;

/** Detect if running on a mobile device */
const isMobileDevice = (): boolean => {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || ("ontouchstart" in window && window.innerWidth < 768);
};

export function FileImportPicker({
  accept = "*",
  multiple = false,
  onFile,
  onFiles,
  label = "Datei importieren",
  variant = "outline",
  size = "sm",
  className = "",
  disabled = false,
  icon,
  maxSize = 30 * 1024 * 1024,
  children,
}: FileImportPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files;
    if (!picked || picked.length === 0) return;

    const files = Array.from(picked);

    for (const file of files) {
      if (file.size > maxSize) {
        const maxMB = Math.round(maxSize / (1024 * 1024));
        alert(`Datei ist zu groß (max. ${maxMB} MB)`);
        return;
      }
    }

    if (multiple && onFiles) {
      onFiles(files);
    } else {
      onFile(files[0]);
    }

    setShowPicker(false);
    // Reset input so the same file can be selected again
    if (inputRef.current) inputRef.current.value = "";
  }, [onFile, onFiles, maxSize, multiple]);

  const handleTriggerClick = useCallback(() => {
    if (disabled) return;
    /* BUG-11: On mobile, show the app picker dialog.
     * On desktop, directly open the native file picker. */
    if (isMobileDevice()) {
      setShowPicker(true);
    } else {
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleSourceSelect = useCallback((sourceId: string) => {
    /* BUG-11: All sources ultimately use the native file picker,
     * but with the `capture` attribute removed so the OS shows
     * the full "Open from" menu including cloud apps.
     * On iOS/Android, when you click the file input without capture,
     * the OS presents the document picker which includes
     * OneDrive, Google Drive, iCloud, Dropbox, Telegram, WhatsApp etc. */
    setShowPicker(false);
    // Small delay to ensure dialog closes before file picker opens
    setTimeout(() => {
      inputRef.current?.click();
    }, 100);
  }, []);

  return (
    <>
      {/* Hidden file input — no `capture` attribute so OS shows all sources */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Trigger */}
      {children ? (
        <span onClick={handleTriggerClick} className="cursor-pointer">
          {children}
        </span>
      ) : (
        <Button
          variant={variant}
          size={size}
          className={`gap-1.5 ${className}`}
          onClick={handleTriggerClick}
          disabled={disabled}
        >
          {icon || <Upload className="h-3.5 w-3.5" />}
          {label}
        </Button>
      )}

      {/* BUG-11: Mobile app picker dialog — improved UX with better layout and hints */}
      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4 text-primary" />
              Datei importieren
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Tippe auf eine Quelle — dein Gerät öffnet dann die passende App zum Auswählen:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CLOUD_SOURCES.map((source) => (
              <button
                key={source.id}
                onClick={() => handleSourceSelect(source.id)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 active:scale-95 transition-all text-center group"
              >
                <source.icon className={`h-6 w-6 ${source.color} group-hover:scale-110 transition-transform`} />
                <span className="text-xs font-medium">{source.label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{source.description}</span>
              </button>
            ))}
          </div>
          <div className="bg-secondary/50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground">
              <strong>Tipp:</strong> Auf dem iPhone wähle &quot;Durchsuchen&quot; im Datei-Dialog,
              um auf iCloud, Google Drive, OneDrive und Dropbox zuzugreifen.
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            PDF, CSV, Bilder, Dokumente · Max. {Math.round(maxSize / (1024 * 1024))} MB
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default FileImportPicker;
