/**
 * MOB6-19: Mobile Smart Reminders
 * Location and time-based reminders for property visits and tasks.
 * Uses Geolocation API for proximity alerts and scheduled notifications.
 */
import { useState, useCallback, useMemo, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Bell, MapPin, Clock, Plus, Trash2, Check, Edit2,
  Navigation, X, ChevronDown, ChevronUp,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SmartReminder {
  id: string;
  title: string;
  description?: string;
  /** Reminder type */
  type: "time" | "location" | "both";
  /** Time trigger (ISO date) */
  triggerDate?: string;
  /** Recurring pattern */
  recurring?: "daily" | "weekly" | "monthly" | "yearly" | null;
  /** Location trigger */
  location?: {
    lat: number;
    lng: number;
    address: string;
    /** Radius in meters */
    radius: number;
  };
  /** Is completed */
  isCompleted: boolean;
  /** Is active */
  isActive: boolean;
  /** Related property ID */
  propertyId?: string;
  /** Created date */
  createdAt: string;
}

interface MobileSmartRemindersProps {
  /** Reminders list */
  reminders: SmartReminder[];
  /** Add reminder handler */
  onAddReminder?: (reminder: Omit<SmartReminder, "id" | "createdAt">) => void;
  /** Toggle reminder completion */
  onToggleComplete?: (id: string) => void;
  /** Toggle reminder active state */
  onToggleActive?: (id: string) => void;
  /** Delete reminder */
  onDeleteReminder?: (id: string) => void;
  /** Edit reminder */
  onEditReminder?: (reminder: SmartReminder) => void;
  /** Show location-based reminders */
  enableLocation?: boolean;
  /** Current user position */
  userPosition?: { lat: number; lng: number } | null;
  /** Additional class */
  className?: string;
}

const recurringLabels: Record<string, string> = {
  daily: "Täglich",
  weekly: "Wöchentlich",
  monthly: "Monatlich",
  yearly: "Jährlich",
};

function formatReminderTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);

  if (diffDays < 0) return `Überfällig (${Math.abs(diffDays)} Tage)`;
  if (diffDays === 0) return "Heute";
  if (diffDays === 1) return "Morgen";
  if (diffDays < 7) return `In ${diffDays} Tagen`;
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
}

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const MobileSmartReminders = memo(function MobileSmartReminders({
  reminders,
  onAddReminder,
  onToggleComplete,
  onToggleActive,
  onDeleteReminder,
  onEditReminder,
  enableLocation = true,
  userPosition,
  className,
}: MobileSmartRemindersProps) {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<SmartReminder["type"]>("time");
  const [newDate, setNewDate] = useState("");
  const [newRecurring, setNewRecurring] = useState<SmartReminder["recurring"]>(null);

  // Sort and filter reminders
  const filteredReminders = useMemo(() => {
    let result = [...reminders];

    if (filter === "active") result = result.filter(r => !r.isCompleted && r.isActive);
    else if (filter === "completed") result = result.filter(r => r.isCompleted);

    // Sort: overdue first, then by date
    result.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      const dateA = a.triggerDate ? new Date(a.triggerDate).getTime() : Infinity;
      const dateB = b.triggerDate ? new Date(b.triggerDate).getTime() : Infinity;
      return dateA - dateB;
    });

    return result;
  }, [reminders, filter]);

  // Nearby reminders
  const nearbyReminders = useMemo(() => {
    if (!userPosition || !enableLocation) return [];
    return reminders.filter(r => {
      if (!r.location || r.isCompleted) return false;
      const distKm = getDistanceKm(userPosition.lat, userPosition.lng, r.location.lat, r.location.lng);
      return distKm * 1000 <= r.location.radius * 2; // Within 2x radius
    });
  }, [reminders, userPosition, enableLocation]);

  const handleAddReminder = useCallback(() => {
    if (!newTitle.trim() || !onAddReminder) return;

    onAddReminder({
      title: newTitle.trim(),
      type: newType,
      triggerDate: newDate || undefined,
      recurring: newRecurring,
      isCompleted: false,
      isActive: true,
    });

    setNewTitle("");
    setNewDate("");
    setNewRecurring(null);
    setShowAddForm(false);
  }, [newTitle, newType, newDate, newRecurring, onAddReminder]);

  const activeCount = reminders.filter(r => !r.isCompleted && r.isActive).length;
  const overdueCount = reminders.filter(r => {
    if (r.isCompleted || !r.triggerDate) return false;
    return new Date(r.triggerDate).getTime() < Date.now();
  }).length;

  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          <h2 className="text-sm font-semibold">Erinnerungen</h2>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium">
              {activeCount}
            </span>
          )}
          {overdueCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-medium">
              {overdueCount} überfällig
            </span>
          )}
        </div>
        {onAddReminder && (
          <button
            onClick={() => setShowAddForm(prev => !prev)}
            className={cn(
              "p-2 rounded-lg hover:bg-muted transition-colors",
              showAddForm && "bg-muted",
              isMobile && "min-w-[44px] min-h-[44px] flex items-center justify-center"
            )}
            aria-label="Erinnerung hinzufügen"
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Nearby alerts */}
      {nearbyReminders.length > 0 && (
        <div className="mb-3 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-1.5 mb-1">
            <Navigation className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-400">In der Nähe</span>
          </div>
          {nearbyReminders.map(r => (
            <p key={r.id} className="text-[10px] text-blue-600 dark:text-blue-400">
              📍 {r.title} — {r.location?.address}
            </p>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="mb-3 p-3 rounded-xl border bg-muted/30 space-y-2 animate-in slide-in-from-top-2 duration-200">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Woran erinnern?"
            className={cn(
              "w-full px-3 py-2 rounded-lg border bg-background text-sm",
              isMobile && "min-h-[44px]"
            )}
            autoFocus
          />

          <div className="flex gap-1.5">
            {(["time", "location", "both"] as const).map(type => (
              <button
                key={type}
                onClick={() => setNewType(type)}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-[10px] font-medium border transition-colors",
                  newType === type ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                )}
              >
                {type === "time" ? "⏰ Zeit" : type === "location" ? "📍 Ort" : "⏰📍 Beides"}
              </button>
            ))}
          </div>

          {(newType === "time" || newType === "both") && (
            <input
              type="datetime-local"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-xs"
            />
          )}

          <div className="flex gap-1.5">
            {(["daily", "weekly", "monthly"] as const).map(rec => (
              <button
                key={rec}
                onClick={() => setNewRecurring(prev => prev === rec ? null : rec)}
                className={cn(
                  "px-2 py-1 rounded-lg text-[10px] border transition-colors",
                  newRecurring === rec ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted"
                )}
              >
                {recurringLabels[rec]}
              </button>
            ))}
          </div>

          <button
            onClick={handleAddReminder}
            disabled={!newTitle.trim()}
            className={cn(
              "w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium",
              "hover:bg-primary/90 disabled:opacity-50 transition-colors",
              isMobile && "min-h-[44px]"
            )}
          >
            Erinnerung erstellen
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-3">
        {(["active", "all", "completed"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors",
              filter === f ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
            )}
          >
            {f === "active" ? "Aktiv" : f === "all" ? "Alle" : "Erledigt"}
          </button>
        ))}
      </div>

      {/* Reminders list */}
      {filteredReminders.length === 0 ? (
        <div className="text-center py-8">
          <Bell className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">Keine Erinnerungen</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredReminders.map(reminder => {
            const isOverdue = reminder.triggerDate && !reminder.isCompleted &&
              new Date(reminder.triggerDate).getTime() < Date.now();
            const isExpanded = expandedId === reminder.id;
            const distance = userPosition && reminder.location
              ? getDistanceKm(userPosition.lat, userPosition.lng, reminder.location.lat, reminder.location.lng)
              : null;

            return (
              <div
                key={reminder.id}
                className={cn(
                  "rounded-lg border transition-all",
                  reminder.isCompleted && "opacity-60",
                  isOverdue && "border-red-200 dark:border-red-800"
                )}
              >
                <div className={cn(
                  "flex items-start gap-2 px-3 py-2.5",
                  isMobile && "min-h-[48px]"
                )}>
                  {/* Checkbox */}
                  <button
                    onClick={() => onToggleComplete?.(reminder.id)}
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                      reminder.isCompleted
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-muted-foreground/30 hover:border-primary"
                    )}
                  >
                    {reminder.isCompleted && <Check className="w-3 h-3" />}
                  </button>

                  {/* Content */}
                  <button
                    onClick={() => setExpandedId(prev => prev === reminder.id ? null : reminder.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className={cn(
                      "text-xs font-medium",
                      reminder.isCompleted && "line-through"
                    )}>
                      {reminder.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {reminder.triggerDate && (
                        <span className={cn(
                          "flex items-center gap-0.5 text-[10px]",
                          isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"
                        )}>
                          <Clock className="w-2.5 h-2.5" />
                          {formatReminderTime(reminder.triggerDate)}
                        </span>
                      )}
                      {reminder.location && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <MapPin className="w-2.5 h-2.5" />
                          {distance !== null ? `${distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}` : reminder.location.address}
                        </span>
                      )}
                      {reminder.recurring && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Repeat className="w-2.5 h-2.5" />
                          {recurringLabels[reminder.recurring]}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-3 pb-2.5 border-t space-y-2 animate-in slide-in-from-top-1 duration-200">
                    {reminder.description && (
                      <p className="text-[10px] text-muted-foreground pt-2">{reminder.description}</p>
                    )}
                    {reminder.location && (
                      <p className="text-[10px] text-muted-foreground">
                        📍 {reminder.location.address} (Radius: {reminder.location.radius}m)
                      </p>
                    )}
                    <div className="flex gap-1.5">
                      {onEditReminder && (
                        <button
                          onClick={() => onEditReminder(reminder)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] hover:bg-muted"
                        >
                          <Edit2 className="w-2.5 h-2.5" /> Bearbeiten
                        </button>
                      )}
                      {onToggleActive && (
                        <button
                          onClick={() => onToggleActive(reminder.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] hover:bg-muted"
                        >
                          {reminder.isActive ? "⏸ Pausieren" : "▶ Aktivieren"}
                        </button>
                      )}
                      {onDeleteReminder && (
                        <button
                          onClick={() => onDeleteReminder(reminder.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                          <Trash2 className="w-2.5 h-2.5" /> Löschen
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
