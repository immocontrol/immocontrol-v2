/**
 * MOB6-16: Mobile Maintenance Timeline
 * Maintenance/repair history with photo documentation and cost tracking.
 * Timeline view with expandable entries and photo gallery.
 */
import { useState, useCallback, useMemo, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Wrench, Camera, Euro, Calendar, ChevronDown, ChevronUp,
  Clock, CheckCircle2, AlertCircle, Timer,
  Plus, ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface MaintenanceEntry {
  id: string;
  title: string;
  description?: string;
  /** ISO date string */
  date: string;
  /** Completion date if finished */
  completedDate?: string;
  /** Cost in EUR */
  cost?: number;
  /** Status */
  status: "geplant" | "in_arbeit" | "abgeschlossen" | "storniert";
  /** Category */
  category: "reparatur" | "wartung" | "modernisierung" | "notfall";
  /** Photo URLs */
  photos?: string[];
  /** Contractor name */
  contractor?: string;
  /** Property/unit reference */
  property?: string;
  /** Notes */
  notes?: string;
}

interface MobileMaintenanceTimelineProps {
  /** Maintenance entries */
  entries: MaintenanceEntry[];
  /** Add entry handler */
  onAddEntry?: () => void;
  /** Entry click handler */
  onEntryClick?: (entry: MaintenanceEntry) => void;
  /** Photo click handler */
  onPhotoClick?: (photo: string, entry: MaintenanceEntry) => void;
  /** Show cost summary */
  showCostSummary?: boolean;
  /** Additional class */
  className?: string;
}

const statusIcons: Record<MaintenanceEntry["status"], React.ReactNode> = {
  geplant: <Clock className="w-3.5 h-3.5" />,
  in_arbeit: <Timer className="w-3.5 h-3.5" />,
  abgeschlossen: <CheckCircle2 className="w-3.5 h-3.5" />,
  storniert: <AlertCircle className="w-3.5 h-3.5" />,
};

const statusColors: Record<MaintenanceEntry["status"], string> = {
  geplant: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_arbeit: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  abgeschlossen: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  storniert: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const statusLabels: Record<MaintenanceEntry["status"], string> = {
  geplant: "Geplant",
  in_arbeit: "In Arbeit",
  abgeschlossen: "Abgeschlossen",
  storniert: "Storniert",
};

const categoryLabels: Record<MaintenanceEntry["category"], string> = {
  reparatur: "Reparatur",
  wartung: "Wartung",
  modernisierung: "Modernisierung",
  notfall: "Notfall",
};

const categoryColors: Record<MaintenanceEntry["category"], string> = {
  reparatur: "border-l-blue-500",
  wartung: "border-l-green-500",
  modernisierung: "border-l-purple-500",
  notfall: "border-l-red-500",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

export const MobileMaintenanceTimeline = memo(function MobileMaintenanceTimeline({
  entries,
  onAddEntry,
  onEntryClick,
  onPhotoClick,
  showCostSummary = true,
  className,
}: MobileMaintenanceTimelineProps) {
  const isMobile = useIsMobile();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<MaintenanceEntry["status"] | "all">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filteredEntries = useMemo(() => {
    let result = [...entries];
    if (filterStatus !== "all") {
      result = result.filter(e => e.status === filterStatus);
    }
    result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
    return result;
  }, [entries, filterStatus, sortOrder]);

  const costSummary = useMemo(() => {
    const total = entries.reduce((sum, e) => sum + (e.cost || 0), 0);
    const completed = entries.filter(e => e.status === "abgeschlossen").reduce((sum, e) => sum + (e.cost || 0), 0);
    const planned = entries.filter(e => e.status === "geplant" || e.status === "in_arbeit").reduce((sum, e) => sum + (e.cost || 0), 0);
    return { total, completed, planned };
  }, [entries]);

  // Group by year
  const groupedByYear = useMemo(() => {
    const groups = new Map<string, MaintenanceEntry[]>();
    for (const entry of filteredEntries) {
      const year = new Date(entry.date).getFullYear().toString();
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year)!.push(entry);
    }
    return groups;
  }, [filteredEntries]);

  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Wrench className="w-4 h-4" />
          Wartungs-Timeline
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSortOrder(prev => prev === "newest" ? "oldest" : "newest")}
            className={cn(
              "p-2 rounded-lg hover:bg-muted transition-colors",
              isMobile && "min-w-[44px] min-h-[44px] flex items-center justify-center"
            )}
            aria-label="Sortierung"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
          {onAddEntry && (
            <button
              onClick={onAddEntry}
              className={cn(
                "p-2 rounded-lg hover:bg-muted transition-colors text-primary",
                isMobile && "min-w-[44px] min-h-[44px] flex items-center justify-center"
              )}
              aria-label="Eintrag hinzufügen"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Cost summary */}
      {showCostSummary && entries.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Gesamt</p>
            <p className="text-xs font-semibold">{formatCurrency(costSummary.total)}</p>
          </div>
          <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Abgeschlossen</p>
            <p className="text-xs font-semibold text-green-700 dark:text-green-400">{formatCurrency(costSummary.completed)}</p>
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Geplant</p>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{formatCurrency(costSummary.planned)}</p>
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex flex-wrap gap-1 mb-3">
        <button
          onClick={() => setFilterStatus("all")}
          className={cn(
            "px-2 py-1 rounded-full text-[10px] font-medium border transition-colors",
            filterStatus === "all" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
          )}
        >
          Alle
        </button>
        {(Object.keys(statusLabels) as MaintenanceEntry["status"][]).map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={cn(
              "px-2 py-1 rounded-full text-[10px] font-medium border transition-colors",
              filterStatus === status ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
            )}
          >
            {statusLabels[status]}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {filteredEntries.length === 0 ? (
        <div className="text-center py-8">
          <Wrench className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">Keine Einträge gefunden</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />

          {Array.from(groupedByYear).map(([year, yearEntries]) => (
            <div key={year}>
              {/* Year label */}
              <div className="relative flex items-center mb-2 mt-4 first:mt-0">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center z-10 text-[9px] font-bold">
                  {year.slice(2)}
                </div>
                <span className="ml-2 text-xs font-semibold">{year}</span>
              </div>

              {/* Entries */}
              {yearEntries.map(entry => {
                const isExpanded = expandedIds.has(entry.id);

                return (
                  <div key={entry.id} className="relative ml-3 pl-4 pb-3">
                    {/* Timeline dot */}
                    <div className={cn(
                      "absolute -left-[5px] top-3 w-2.5 h-2.5 rounded-full border-2 border-background z-10",
                      entry.status === "abgeschlossen" ? "bg-green-500" :
                      entry.status === "in_arbeit" ? "bg-amber-500" :
                      entry.status === "storniert" ? "bg-gray-400" : "bg-blue-500"
                    )} />

                    {/* Entry card */}
                    <div className={cn(
                      "rounded-lg border-l-2 border bg-background",
                      categoryColors[entry.category]
                    )}>
                      <button
                        onClick={() => {
                          toggleExpanded(entry.id);
                          onEntryClick?.(entry);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2.5 flex items-start gap-2",
                          isMobile && "min-h-[48px]"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-medium">{entry.title}</span>
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-medium",
                              statusColors[entry.status]
                            )}>
                              {statusLabels[entry.status]}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Calendar className="w-2.5 h-2.5" />
                              {formatDate(entry.date)}
                            </span>
                            {entry.cost !== undefined && (
                              <span className="flex items-center gap-0.5">
                                <Euro className="w-2.5 h-2.5" />
                                {formatCurrency(entry.cost)}
                              </span>
                            )}
                            {entry.photos && entry.photos.length > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Camera className="w-2.5 h-2.5" />
                                {entry.photos.length}
                              </span>
                            )}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-2 border-t animate-in slide-in-from-top-1 duration-200">
                          {entry.description && (
                            <p className="text-[10px] text-muted-foreground pt-2">{entry.description}</p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
                            <span><strong>Kategorie:</strong> {categoryLabels[entry.category]}</span>
                            {entry.contractor && <span><strong>Firma:</strong> {entry.contractor}</span>}
                            {entry.property && <span><strong>Objekt:</strong> {entry.property}</span>}
                            {entry.completedDate && <span><strong>Fertig:</strong> {formatDate(entry.completedDate)}</span>}
                          </div>
                          {entry.notes && (
                            <p className="text-[10px] bg-muted/50 rounded p-1.5 italic">{entry.notes}</p>
                          )}
                          {/* Photos */}
                          {entry.photos && entry.photos.length > 0 && (
                            <div className="flex gap-1.5 overflow-x-auto pb-1">
                              {entry.photos.map((photo, i) => (
                                <button
                                  key={i}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onPhotoClick?.(photo, entry);
                                  }}
                                  className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border hover:ring-2 hover:ring-primary transition-all"
                                >
                                  <img src={photo} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
