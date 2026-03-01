import { useState, useCallback } from "react";
import { FileText, Upload, Trash2, Download, FolderOpen, Image, FileSpreadsheet, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/formatters";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import FileImportPicker from "@/components/FileImportPicker";

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string | null;
  category: string;
  created_at: string;
}

const CATEGORIES = ["Mietvertrag", "Grundbuchauszug", "Nebenkostenabrechnung", "Versicherung", "Gutachten", "Steuer", "Sonstiges"];

const getFileIcon = (fileType: string | null, fileName: string) => {
  if (fileType?.startsWith("image/")) return <Image className="h-4 w-4 text-blue-400" />;
  if (fileType?.includes("spreadsheet") || fileType?.includes("excel") || fileName.match(/\.(xlsx?|csv)$/i)) return <FileSpreadsheet className="h-4 w-4 text-green-400" />;
  if (fileType?.includes("pdf") || fileName.match(/\.pdf$/i)) return <FileText className="h-4 w-4 text-red-400" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
};

const PropertyDocuments = ({ propertyId }: { propertyId: string }) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("Sonstiges");
  const [dragActive, setDragActive] = useState(false);
  const qc = useQueryClient();

  const { data: documents = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.documents.byProperty(propertyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_documents")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Document[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.documents.byProperty(propertyId) });
    qc.invalidateQueries({ queryKey: queryKeys.timeline.byProperty(propertyId) });
  };

  const uploadFile = async (file: File) => {
    if (!user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Maximale Dateigröße: 10 MB");
      return;
    }

    setUploading(true);
    const filePath = `${user.id}/${propertyId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("property-documents")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Upload fehlgeschlagen: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from("property_documents").insert({
      property_id: propertyId,
      user_id: user.id,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      file_type: file.type || null,
      category,
    });

    if (dbError) {
      toast.error("Metadaten konnten nicht gespeichert werden");
    } else {
      toast.success(`„${file.name}" hochgeladen`);
      invalidate();
    }

    setUploading(false);
  };


  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  }, [user, propertyId, category]);

  const deleteMutation = useMutation({
    mutationFn: async (doc: Document) => {
      const { error: storageError } = await supabase.storage
        .from("property-documents")
        .remove([doc.file_path]);
      if (storageError) throw storageError;
      await supabase.from("property_documents").delete().eq("id", doc.id);
    },
    onSuccess: (_, doc) => {
      toast.success(`„${doc.file_name}" gelöscht`);
      invalidate();
    },
    onError: () => toast.error("Datei konnte nicht gelöscht werden"),
  });

  const handleDownload = async (doc: Document) => {
    const { data, error } = await supabase.storage
      .from("property-documents")
      .download(doc.file_path);

    if (error || !data) {
      toast.error("Download fehlgeschlagen");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.file_name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in" style={{ animationDelay: "600ms" }}>
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground" /> Dokumente
        {documents.length > 0 && (
          <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-full text-muted-foreground">{documents.length}</span>
        )}
      </h2>

      {/* Upload area with drag & drop */}
      {/* IMPROVE-18: Use FileImportPicker so mobile users can import from iCloud/Drive/etc. */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-4 mb-4 transition-colors text-center ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/30"
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <FileImportPicker
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv"
            onFile={uploadFile}
            label={uploading ? "Lädt..." : "Hochladen"}
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            icon={<Upload className="h-3.5 w-3.5" />}
            disabled={uploading}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          oder Datei hierher ziehen · max. 10 MB
        </p>
      </div>

      {/* Document list */}
      {loading ? (
        <p className="text-xs text-muted-foreground">Laden...</p>
      ) : documents.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Noch keine Dokumente hochgeladen</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                {getFileIcon(doc.file_type, doc.file_name)}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.category} · {formatFileSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString("de-DE")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(doc)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-loss" onClick={() => deleteMutation.mutate(doc)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PropertyDocuments;
