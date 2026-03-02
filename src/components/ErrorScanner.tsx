import { useState, useEffect, useCallback, useRef } from "react";
import { Bug, Download, Trash2, RefreshCw, FileText, AlertTriangle, Info, AlertCircle, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import jsPDF from "jspdf";

/* Error severity levels */
type ErrorSeverity = "error" | "warning" | "info";

interface AppError {
  id: string;
  timestamp: string;
  severity: ErrorSeverity;
  message: string;
  source: string;
  stack?: string;
  count: number;
  lastSeen: string;
}

const STORAGE_KEY = "immocontrol_error_log";
const MAX_ERRORS = 500;

function loadErrors(): AppError[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as AppError[]) : [];
  } catch {
    return [];
  }
}

function saveErrors(errors: AppError[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(errors.slice(0, MAX_ERRORS)));
  } catch { /* storage full */ }
}

function errorId(msg: string, source: string): string {
  let hash = 0;
  const str = msg + source;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return "err_" + Math.abs(hash).toString(36);
}

const severityIcon: Record<ErrorSeverity, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const severityColor: Record<ErrorSeverity, string> = {
  error: "text-destructive",
  warning: "text-gold",
  info: "text-muted-foreground",
};

const severityBadge: Record<ErrorSeverity, string> = {
  error: "bg-destructive/10 text-destructive border-destructive/20",
  warning: "bg-gold/10 text-gold border-gold/20",
  info: "bg-secondary text-muted-foreground border-border",
};

/* Global error interception — runs once at app root, never cleaned up */
function addErrorToStore(severity: ErrorSeverity, message: string, source: string, stack?: string): void {
  const id = errorId(message, source);
  const now = new Date().toISOString();
  const errors = loadErrors();
  const existIdx = errors.findIndex(e => e.id === id);
  if (existIdx >= 0) {
    errors[existIdx] = { ...errors[existIdx], count: errors[existIdx].count + 1, lastSeen: now };
  } else {
    errors.unshift({
      id, timestamp: now, severity,
      message: message.slice(0, 500), source,
      stack: stack?.slice(0, 1000),
      count: 1, lastSeen: now,
    });
  }
  saveErrors(errors.slice(0, MAX_ERRORS));
}

let _intercepted = false;

/** Mount this component once at the App root to capture errors app-wide */
export function ErrorInterceptor() {
  useEffect(() => {
    if (_intercepted) return;
    _intercepted = true;

    const origError = console.error;
    console.error = (...args: unknown[]) => {
      origError.apply(console, args);
      const msg = args.map(a => { if (typeof a === "object" && a !== null) { try { return JSON.stringify(a); } catch { return String(a); } } return String(a); }).join(" ");
      if (!msg.includes("immocontrol_error_log")) {
        addErrorToStore("error", msg, "console.error");
      }
    };

    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      origWarn.apply(console, args);
      const msg = args.map(a => { if (typeof a === "object" && a !== null) { try { return JSON.stringify(a); } catch { return String(a); } } return String(a); }).join(" ");
      addErrorToStore("warning", msg, "console.warn");
    };

    const onError = (event: ErrorEvent) => {
      addErrorToStore("error", event.message, event.filename || "unknown", event.error?.stack);
    };
    window.addEventListener("error", onError);

    const onRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason instanceof Error ? event.reason.message : String(event.reason);
      const stack = event.reason instanceof Error ? event.reason.stack : undefined;
      addErrorToStore("error", msg, "unhandledrejection", stack);
    };
    window.addEventListener("unhandledrejection", onRejection);

    /* Never clean up — interception stays active for the entire app lifetime */
  }, []);

  return null;
}

export function ErrorScanner() {
  const [errors, setErrors] = useState<AppError[]>(loadErrors);
  const [filter, setFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState<ErrorSeverity | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  /* Refresh errors from localStorage periodically so we see app-wide captures */
  useEffect(() => {
    const interval = setInterval(() => {
      setErrors(loadErrors());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const runScan = useCallback(() => {
    setScanning(true);
    const now = new Date().toISOString();
    const newErrors: AppError[] = [];

    const imgs = document.querySelectorAll("img:not([alt])");
    if (imgs.length > 0) {
      newErrors.push({ id: errorId("images-no-alt", "scanner"), timestamp: now, severity: "warning", message: `${imgs.length} Bild(er) ohne Alt-Text (Barrierefreiheit)`, source: "Accessibility Scanner", count: imgs.length, lastSeen: now });
    }

    const btns = document.querySelectorAll("button");
    let emptyBtns = 0;
    btns.forEach(b => { if (!b.textContent?.trim() && !b.getAttribute("aria-label") && !b.querySelector("svg")) emptyBtns++; });
    if (emptyBtns > 0) {
      newErrors.push({ id: errorId("buttons-no-label", "scanner"), timestamp: now, severity: "warning", message: `${emptyBtns} Button(s) ohne Text oder aria-label`, source: "Accessibility Scanner", count: emptyBtns, lastSeen: now });
    }

    const inputs = document.querySelectorAll("input:not([type='hidden'])");
    let unlabeled = 0;
    inputs.forEach(inp => {
      const id = inp.getAttribute("id");
      if (id && !document.querySelector(`label[for="${id}"]`) && !inp.getAttribute("aria-label")) unlabeled++;
    });
    if (unlabeled > 0) {
      newErrors.push({ id: errorId("inputs-no-label", "scanner"), timestamp: now, severity: "info", message: `${unlabeled} Input-Feld(er) ohne zugeordnetes Label`, source: "Accessibility Scanner", count: unlabeled, lastSeen: now });
    }

    let storageBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) storageBytes += (localStorage.getItem(key) || "").length * 2;
    }
    if (storageBytes > 4 * 1024 * 1024) {
      newErrors.push({ id: errorId("storage-high", "scanner"), timestamp: now, severity: "warning", message: `Hoher LocalStorage-Verbrauch: ${(storageBytes / 1024 / 1024).toFixed(1)} MB`, source: "Performance Scanner", count: 1, lastSeen: now });
    }

    setErrors(prev => {
      const merged = [...prev];
      for (const ne of newErrors) {
        const existIdx = merged.findIndex(e => e.id === ne.id);
        if (existIdx >= 0) merged[existIdx] = { ...merged[existIdx], count: ne.count, lastSeen: now };
        else merged.unshift(ne);
      }
      const result = merged.slice(0, MAX_ERRORS);
      saveErrors(result);
      return result;
    });

    setTimeout(() => {
      setScanning(false);
      toast.success(`Scan abgeschlossen — ${newErrors.length} neue Eintr\u00e4ge`);
    }, 800);
  }, []);

  const clearErrors = () => { setErrors([]); localStorage.removeItem(STORAGE_KEY); toast.success("Fehlerprotokoll gel\u00f6scht"); };

  const filteredErrors = errors.filter(e => {
    if (severityFilter !== "all" && e.severity !== severityFilter) return false;
    if (filter && !e.message.toLowerCase().includes(filter.toLowerCase()) && !e.source.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const exportCSV = () => {
    const headers = ["Zeitstempel", "Schwere", "Nachricht", "Quelle", "Anzahl", "Zuletzt gesehen"];
    const rows = filteredErrors.map(e => [e.timestamp, e.severity, `"${e.message.replace(/"/g, '""')}"`, e.source, String(e.count), e.lastSeen]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `immocontrol-errors-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportiert");
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(16);
    doc.text("ImmoControl \u2014 Fehlerprotokoll", 14, 15);
    doc.setFontSize(8);
    doc.text(`Exportiert: ${new Date().toLocaleString("de-DE")}`, 14, 22);
    doc.text(`Eintr\u00e4ge: ${filteredErrors.length}`, 14, 26);
    let y = 34;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("Zeitstempel", 14, y);
    doc.text("Schwere", 65, y);
    doc.text("Nachricht", 90, y);
    doc.text("Quelle", 220, y);
    doc.text("#", 260, y);
    y += 2;
    doc.line(14, y, 280, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    for (const e of filteredErrors) {
      if (y > 190) { doc.addPage(); y = 15; }
      doc.text(new Date(e.timestamp).toLocaleString("de-DE"), 14, y);
      doc.text(e.severity, 65, y);
      doc.text(e.message.slice(0, 80), 90, y);
      doc.text(e.source.slice(0, 25), 220, y);
      doc.text(String(e.count), 260, y);
      y += 5;
    }
    doc.save(`immocontrol-errors-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF exportiert");
  };

  const errorCount = errors.filter(e => e.severity === "error").length;
  const warningCount = errors.filter(e => e.severity === "warning").length;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:125ms]" role="region" aria-label="Error Scanner">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Bug className="h-4 w-4 text-muted-foreground" /> Error Scanner
          {errorCount > 0 && <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">{errorCount} Fehler</Badge>}
          {warningCount > 0 && <Badge variant="outline" className="text-[10px] bg-gold/10 text-gold border-gold/20">{warningCount} Warnungen</Badge>}
        </h2>
        <div className="flex items-center gap-1">
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={runScan} disabled={scanning}><RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} /></Button></TooltipTrigger><TooltipContent>App scannen</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={exportCSV} disabled={filteredErrors.length === 0}><FileText className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>CSV exportieren</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={exportPDF} disabled={filteredErrors.length === 0}><Download className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>PDF exportieren</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={clearErrors} disabled={errors.length === 0}><Trash2 className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Alle l\u00f6schen</TooltipContent></Tooltip>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Intelligenter Bot der Fehler, Warnungen und Performance-Probleme erkennt und protokolliert.</p>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Fehler durchsuchen..." className="h-8 text-xs pl-8" />
        </div>
        <div className="flex gap-1">
          {(["all", "error", "warning", "info"] as const).map(s => (
            <Button key={s} variant={severityFilter === s ? "default" : "outline"} size="sm" className="h-8 text-[10px] px-2" onClick={() => setSeverityFilter(s)}>
              {s === "all" ? "Alle" : s === "error" ? "Fehler" : s === "warning" ? "Warnung" : "Info"}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {filteredErrors.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            <Bug className="h-8 w-8 mx-auto mb-2 opacity-30" />
            {errors.length === 0 ? "Keine Fehler erkannt \u2014 alles l\u00e4uft!" : "Keine Ergebnisse f\u00fcr den Filter"}
          </div>
        ) : (
          filteredErrors.slice(0, 50).map(err => {
            const Icon = severityIcon[err.severity];
            const isExpanded = expanded === err.id;
            return (
              <div key={err.id} className="group p-2.5 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition-colors cursor-pointer border border-transparent hover:border-border" onClick={() => setExpanded(isExpanded ? null : err.id)}>
                <div className="flex items-start gap-2">
                  <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${severityColor[err.severity]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{err.message}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">{err.source}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(err.lastSeen).toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</span>
                      {err.count > 1 && <Badge variant="outline" className={`text-[9px] h-4 px-1 ${severityBadge[err.severity]}`}>\u00d7{err.count}</Badge>}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />}
                </div>
                {isExpanded && err.stack && (
                  <pre className="mt-2 text-[10px] text-muted-foreground bg-background rounded p-2 overflow-x-auto max-h-[120px] font-mono whitespace-pre-wrap break-all">{err.stack}</pre>
                )}
              </div>
            );
          })
        )}
        {filteredErrors.length > 50 && <p className="text-[10px] text-muted-foreground text-center py-2">+ {filteredErrors.length - 50} weitere Eintr\u00e4ge (exportiere als CSV/PDF)</p>}
      </div>
    </div>
  );
}

export default ErrorScanner;
