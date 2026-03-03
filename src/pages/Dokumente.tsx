import { useState, useCallback, useMemo, useEffect } from "react";
import { FileText, Upload, Trash2, Download, FolderOpen, Image, FileSpreadsheet, File, Search, Eye, X, Filter, ScanText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { toast } from "sonner";
import { formatFileSize, formatDate } from "@/lib/formatters";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import FileImportPicker from "@/components/FileImportPicker";
import DocumentOCR from "@/components/DocumentOCR";

interface DocEntry {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string | null;
  category: string;
  property_id: string | null;
  ocr_text: string | null;
  created_at: string;
}

const CATEGORIES = [
  "Mietvertrag", "Grundbuchauszug", "Nebenkostenabrechnung", "Versicherung",
  "Gutachten", "Steuer", "Rechnung", "Bescheid", "Protokoll", "Sonstiges",
];

const getFileIcon = (fileType: string | null, fileName: string) => {
  if (fileType?.startsWith("image/")) return <Image className="h-5 w-5 text-blue-400" />;
  if (fileType?.includes("spreadsheet") || fileName.match(/\.(xlsx?|csv)$/i)) return <FileSpreadsheet className="h-5 w-5 text-green-400" />;
  if (fileType?.includes("pdf") || fileName.match(/\.pdf$/i)) return <FileText className="h-5 w-5 text-red-400" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
};

/** Feature 2: Auto-categorize documents based on filename keywords */
const autoDetectCategory = (fileName: string): string => {
  const lower = fileName.toLowerCase();
  if (lower.includes("mietvertrag") || lower.includes("mietv")) return "Mietvertrag";
  if (lower.includes("grundbuch")) return "Grundbuchauszug";
  if (lower.includes("nebenkost") || lower.includes("nk-abrechnung") || lower.includes("betriebskost")) return "Nebenkostenabrechnung";
  if (lower.includes("versicher") || lower.includes("police")) return "Versicherung";
  if (lower.includes("gutachten") || lower.includes("bewertung")) return "Gutachten";
  if (lower.includes("steuer") || lower.includes("anlage") || lower.includes("finanzamt")) return "Steuer";
  if (lower.includes("rechnung") || lower.includes("invoice")) return "Rechnung";
  if (lower.includes("bescheid")) return "Bescheid";
  if (lower.includes("protokoll") || lower.includes("übergabe")) return "Protokoll";
  return "Sonstiges";
};

/** Feature 2: Extract text from PDF using PDF.js for OCR-like text extraction */
const extractPdfText = async (file: File): Promise<string> => {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    /* IMP-1: Use local worker file instead of CDN to avoid fetch errors */
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item: { str?: string }) => item.str || "").join(" ");
      pages.push(text);
    }
    return pages.join("\n\n");
  } catch {
    return "";
  }
};

const Dokumente = () => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("Sonstiges");
  const [propertyId, setPropertyId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterProperty, setFilterProperty] = useState("all");
  const [dragActive, setDragActive] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocEntry | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  const { data: documents = [], isLoading } = useQuery<DocEntry[]>({
    queryKey: ["all_documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as DocEntry[];
    },
    enabled: !!user,
  });

  /* IMP-8: Document title */
  /* IMP-42: Dynamic document title */
  useEffect(() => { document.title = `Dokumente (${documents.length}) – ImmoControl`; }, [documents.length]);

  const filteredDocs = useMemo(() => {
    let docs = documents;
    if (filterCategory !== "all") docs = docs.filter(d => d.category === filterCategory);
    if (filterProperty !== "all") docs = docs.filter(d => d.property_id === filterProperty);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter(d =>
        d.file_name.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        (d.ocr_text && d.ocr_text.toLowerCase().includes(q))
      );
    }
    return docs;
  }, [documents, filterCategory, filterProperty, searchQuery]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    documents.forEach(d => { stats[d.category] = (stats[d.category] || 0) + 1; });
    return stats;
  }, [documents]);

  const totalSize = useMemo(() => documents.reduce((s, d) => s + d.file_size, 0), [documents]);

  /* IMPROVE-5: Document count by file type for quick overview */
  const fileTypeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    documents.forEach(d => {
      const ext = d.file_name.split(".").pop()?.toLowerCase() || "other";
      stats[ext] = (stats[ext] || 0) + 1;
    });
    return stats;
  }, [documents]);

  const propMap = useMemo(() => new Map(properties.map(p => [p.id, p.name])), [properties]);

  const uploadFile = async (file: File) => {
    if (!user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Maximale Dateigröße: 10 MB");
      return;
    }

    setUploading(true);
    const detectedCategory = category === "Sonstiges" ? autoDetectCategory(file.name) : category;
    const filePath = `${user.id}/documents/${Date.now()}_${file.name}`;

    // Extract text from PDF
    let ocrText = "";
    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      setExtracting(true);
      ocrText = await extractPdfText(file);
      setExtracting(false);
    }

    const { error: uploadError } = await supabase.storage
      .from("property-documents")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Upload fehlgeschlagen: " + uploadError.message);
      setUploading(false);
      return;
    }

    const insertData: Record<string, unknown> = {
      user_id: user.id,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      file_type: file.type || null,
      category: detectedCategory,
      property_id: propertyId !== "all" ? propertyId : null,
    };
    // Only add ocr_text if we have it (column may not exist)
    if (ocrText) {
      insertData.ocr_text = ocrText.slice(0, 10000);
    }

    const { error: dbError } = await supabase.from("property_documents").insert(insertData as Record<string, unknown>);

    if (dbError) {
      toast.error("Metadaten konnten nicht gespeichert werden");
    } else {
      toast.success(`„${file.name}" hochgeladen${ocrText ? " (Text extrahiert)" : ""}`);
      qc.invalidateQueries({ queryKey: ["all_documents"] });
    }
    setUploading(false);
  };

  /* BUG-11: Support mobile app picker for document uploads */
  const handleUpload = async (files: File[]) => {
    for (const file of files) {
      await uploadFile(file);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files) {
      for (const file of Array.from(files)) {
        await uploadFile(file);
      }
    }
  }, [user, propertyId, category]);

  const deleteMutation = useMutation({
    mutationFn: async (doc: DocEntry) => {
      await supabase.storage.from("property-documents").remove([doc.file_path]);
      await supabase.from("property_documents").delete().eq("id", doc.id);
    },
    onSuccess: () => {
      toast.success("Dokument gelöscht");
      qc.invalidateQueries({ queryKey: ["all_documents"] });
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  const handleDownload = async (doc: DocEntry) => {
    const { data, error } = await supabase.storage.from("property-documents").download(doc.file_path);
    if (error || !data) { toast.error("Download fehlgeschlagen"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.file_name;
    a.click();
    URL.revokeObjectURL(url);
    /* IMPROVE-6: Show success toast after download */
    toast.success(`"${doc.file_name}" heruntergeladen`);
  };

  return (
    /* IMP-14: ARIA landmark for Dokumente page */
    <div className="space-y-6 animate-fade-in" role="main" aria-label="Dokumenten-Management">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dokumenten-Management</h1>
          <p className="text-sm text-muted-foreground">
            {documents.length} Dokumente · {formatFileSize(totalSize)} gesamt
            {extracting && <span className="ml-2 text-primary animate-pulse">Text wird extrahiert...</span>}
          </p>
        </div>
      </div>

      {/* Stats */}
      {/* UPD-5: Add stagger animation to document stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 card-stagger-enter">
        <div className="gradient-card rounded-xl border border-border p-4">
          <div className="text-[10px] text-muted-foreground uppercase">Gesamt</div>
          <div className="text-xl font-bold">{documents.length}</div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4">
          <div className="text-[10px] text-muted-foreground uppercase">Speicher</div>
          <div className="text-xl font-bold">{formatFileSize(totalSize)}</div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4">
          <div className="text-[10px] text-muted-foreground uppercase">Kategorien</div>
          <div className="text-xl font-bold">{Object.keys(categoryStats).length}</div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4">
          <div className="text-[10px] text-muted-foreground uppercase">Mit Text</div>
          <div className="text-xl font-bold">{documents.filter(d => d.ocr_text).length}</div>
        </div>
      </div>

      {/* Upload Area */}
      {/* IMPROVE-19: Use FileImportPicker (multi-file) for mobile-friendly uploads */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 transition-colors text-center ${
          dragActive ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
        }`}
      >
        <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium mb-2">Dokumente hochladen</p>
        <p className="text-xs text-muted-foreground mb-4">PDF, Bilder, Excel – max. 10 MB · Drag & Drop oder klicken</p>
        <div className="flex flex-wrap items-center gap-3 justify-center">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Kategorie" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Objekt" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Kein Objekt</SelectItem>
              {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <FileImportPicker
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv"
            multiple
            onFile={(file) => handleUpload([file])}
            onFiles={handleUpload}
            label={uploading ? "Lädt..." : "Hochladen"}
            variant="default"
            size="sm"
            icon={<Upload className="h-4 w-4 mr-1.5" />}
            disabled={uploading}
          />
        </div>
        <div className="flex items-center justify-center gap-3 mt-3">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <ScanText className="h-3 w-3" /> PDFs werden automatisch nach Text durchsucht (OCR)
          </p>
          <DocumentOCR />
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Dokumente durchsuchen (auch extrahierter Text)..."
            className="pl-9 h-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[160px] h-10">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c} ({categoryStats[c] || 0})</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProperty} onValueChange={setFilterProperty}>
          <SelectTrigger className="w-[160px] h-10">
            <SelectValue placeholder="Objekt" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Objekte</SelectItem>
            {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Document List */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-12 animate-pulse">Dokumente werden geladen...</div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {documents.length === 0 ? "Noch keine Dokumente hochgeladen" : "Keine Dokumente gefunden"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDocs.map(doc => (
            <div key={doc.id} className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors group">
              <div className="shrink-0">{getFileIcon(doc.file_type, doc.file_name)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{doc.file_name}</span>
                  {doc.ocr_text && (
                    <Badge variant="secondary" className="text-[10px] h-4 gap-0.5">
                      <ScanText className="h-2.5 w-2.5" /> Text
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                  <span>{doc.category}</span>
                  <span>·</span>
                  <span>{formatFileSize(doc.file_size)}</span>
                  <span>·</span>
                  <span>{formatDate(doc.created_at)}</span>
                  {doc.property_id && propMap.get(doc.property_id) && (
                    <>
                      <span>·</span>
                      <span>{propMap.get(doc.property_id)}</span>
                    </>
                  )}
                </div>
              </div>
              {/* UI-UPDATE-18: Keep doc action icons visible on mobile (no hover) */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mobile-action-row">
                {(doc.file_type?.includes("pdf") || doc.file_name.endsWith(".pdf")) && (
                  // UI-UPDATE-19: Tooltip on PDF preview action
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={async () => {
                          const { data } = await supabase.storage.from("property-documents").download(doc.file_path);
                          if (data) {
                            const url = URL.createObjectURL(data);
                            setPdfPreviewUrl(url);
                            setPreviewDoc(doc);
                          }
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>PDF Vorschau</TooltipContent>
                  </Tooltip>
                )}
                {doc.ocr_text && !doc.file_type?.includes("pdf") && (
                  // UI-UPDATE-20: Tooltip on extracted text preview action
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setPdfPreviewUrl(null);
                          setPreviewDoc(doc);
                        }}
                      >
                        <ScanText className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Text anzeigen</TooltipContent>
                  </Tooltip>
                )}
                {/* UI-UPDATE-21: Tooltip on download action */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Herunterladen</TooltipContent>
                </Tooltip>
                {/* UI-UPDATE-22: Tooltip on delete action */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-loss"
                      onClick={() => deleteMutation.mutate(doc)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Löschen</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PDF Preview + OCR Text Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => { setPreviewDoc(null); if (pdfPreviewUrl) { URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pdfPreviewUrl ? <FileText className="h-5 w-5" /> : <ScanText className="h-5 w-5" />}
              {pdfPreviewUrl ? "PDF Vorschau" : "Extrahierter Text"}
            </DialogTitle>
          </DialogHeader>
          {previewDoc && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{previewDoc.file_name}</p>
              {pdfPreviewUrl ? (
                <iframe
                  src={pdfPreviewUrl}
                  className="w-full h-[70vh] rounded-lg border border-border"
                  title={`PDF Vorschau: ${previewDoc.file_name}`}
                />
              ) : (
                <div className="bg-secondary/50 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-[50vh] overflow-y-auto font-mono text-xs leading-relaxed">
                  {previewDoc.ocr_text || "Kein Text extrahiert"}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dokumente;
