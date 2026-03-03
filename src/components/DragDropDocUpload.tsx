/**
 * #12: Drag & Drop Dokumenten-Upload — Documents per Drag & Drop auf ein Objekt ziehen
 */
import { useState, useCallback, useRef } from "react";
import { Upload, FileText, X, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/formatters";

interface DragDropDocUploadProps {
  propertyId: string;
  onUploaded?: () => void;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function DragDropDocUpload({ propertyId, onUploaded }: DragDropDocUploadProps) {
  const { user } = useAuth();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<{ name: string; size: number; status: "pending" | "uploading" | "done" | "error" }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
    if (!user) return;
    const validFiles = Array.from(fileList).filter(f => {
      if (!ALLOWED_TYPES.includes(f.type)) {
        toast.error(`${f.name}: Dateityp nicht erlaubt`);
        return false;
      }
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name}: Datei zu groß (max. 10MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    setFiles(validFiles.map(f => ({ name: f.name, size: f.size, status: "pending" })));

    let successCount = 0;
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "uploading" } : f));

      try {
        const ext = file.name.split(".").pop() || "pdf";
        const path = `${user.id}/${propertyId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(path, file, { upsert: true });

        if (uploadError) throw uploadError;

        // Save document record
        await supabase.from("property_documents").insert({
          property_id: propertyId,
          user_id: user.id,
          name: file.name,
          file_path: path,
          file_type: ext,
          file_size: file.size,
        } as never);

        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "done" } : f));
        successCount++;
      } catch {
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "error" } : f));
      }
    }

    setUploading(false);
    if (successCount > 0) {
      toast.success(`${successCount} Dokument${successCount > 1 ? "e" : ""} hochgeladen`);
      onUploaded?.();
    }
  }, [user, propertyId, onUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }, [uploadFiles]);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
  }, [uploadFiles]);

  return (
    <div className="space-y-2">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragOver
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/30 hover:bg-secondary/30"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.csv,.doc,.docx"
          onChange={handleFileChange}
          className="hidden"
        />
        <Upload className={`h-8 w-8 mx-auto mb-2 ${isDragOver ? "text-primary" : "text-muted-foreground"}`} />
        <p className="text-sm font-medium">
          {isDragOver ? "Hier ablegen" : "Dokumente hierher ziehen"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, Bilder, Excel, Word · Max. 10 MB
        </p>
      </div>

      {/* File upload progress */}
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 text-xs">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{f.name}</span>
              <span className="text-muted-foreground shrink-0">{formatFileSize(f.size)}</span>
              {f.status === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
              {f.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-profit shrink-0" />}
              {f.status === "error" && <X className="h-3.5 w-3.5 text-loss shrink-0" />}
            </div>
          ))}
          {!uploading && (
            <button
              onClick={() => setFiles([])}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Liste leeren
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default DragDropDocUpload;
