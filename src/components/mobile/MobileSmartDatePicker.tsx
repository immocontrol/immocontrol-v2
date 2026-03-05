/**
 * MOB4-4: Mobile Smart Date Picker
 * Native-like date picker with calendar scroll and quick selections.
 * Optimized for touch with large tap targets.
 */
import { useState, useCallback, useMemo, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface MobileSmartDatePickerProps {
  value?: string;
  onChange: (date: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Min date (ISO string) */
  min?: string;
  /** Max date (ISO string) */
  max?: string;
  /** Additional class names */
  className?: string;
  /** Label for the field */
  label?: string;
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

interface QuickOption {
  label: string;
  getDate: () => Date;
}

const QUICK_OPTIONS: QuickOption[] = [
  { label: "Heute", getDate: () => new Date() },
  { label: "Morgen", getDate: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; } },
  { label: "Nächste Woche", getDate: () => { const d = new Date(); d.setDate(d.getDate() + 7); return d; } },
  { label: "In 2 Wochen", getDate: () => { const d = new Date(); d.setDate(d.getDate() + 14); return d; } },
  { label: "Nächster Monat", getDate: () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; } },
  { label: "In 3 Monaten", getDate: () => { const d = new Date(); d.setMonth(d.getMonth() + 3); return d; } },
];

function formatDateDE(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Convert to Monday-based
}

export const MobileSmartDatePicker = memo(function MobileSmartDatePicker({
  value,
  onChange,
  placeholder = "Datum wählen",
  min,
  max,
  className,
  label,
}: MobileSmartDatePickerProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const today = useMemo(() => new Date(), []);

  const selectedDate = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  const [viewYear, setViewYear] = useState(() => selectedDate?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => selectedDate?.getMonth() ?? today.getMonth());

  const isDateDisabled = useCallback((date: Date): boolean => {
    if (min && date < new Date(min)) return true;
    if (max && date > new Date(max)) return true;
    return false;
  }, [min, max]);

  const handleSelect = useCallback((date: Date) => {
    if (!isDateDisabled(date)) {
      onChange(toISO(date));
      setIsOpen(false);
    }
  }, [onChange, isDateDisabled]);

  const handleQuickSelect = useCallback((option: QuickOption) => {
    const date = option.getDate();
    if (!isDateDisabled(date)) {
      onChange(toISO(date));
      setIsOpen(false);
    }
  }, [onChange, isDateDisabled]);

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  }, [viewMonth]);

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
    const days: (Date | null)[] = [];

    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(viewYear, viewMonth, d));
    }

    return days;
  }, [viewYear, viewMonth]);

  const displayValue = selectedDate ? formatDateDE(selectedDate) : "";

  // On non-mobile, use native input
  if (!isMobile) {
    return (
      <div className={cn("space-y-1", className)}>
        {label && <label className="text-sm font-medium text-foreground">{label}</label>}
        <input
          type="date"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder={placeholder}
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-11 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted/50 active:bg-muted transition-colors"
      >
        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className={displayValue ? "text-foreground" : "text-muted-foreground"}>
          {displayValue || placeholder}
        </span>
      </button>

      {/* Bottom sheet calendar */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-label="Datum wählen">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsOpen(false)}
          />

          {/* Sheet */}
          <div className="relative w-full bg-background rounded-t-2xl shadow-xl animate-in slide-in-from-bottom duration-300 pb-safe">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Quick options */}
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
              {QUICK_OPTIONS.map((opt) => (
                <Button
                  key={opt.label}
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-xs h-8"
                  onClick={() => handleQuickSelect(opt)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>

            {/* Month navigation */}
            <div className="flex items-center justify-between px-4 py-2">
              <button
                onClick={prevMonth}
                className="p-2 rounded-full hover:bg-muted active:bg-muted/80 transition-colors"
                aria-label="Vorheriger Monat"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-semibold">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button
                onClick={nextMonth}
                className="p-2 rounded-full hover:bg-muted active:bg-muted/80 transition-colors"
                aria-label="Nächster Monat"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-0 px-4">
              {WEEKDAYS.map((day) => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0 px-4 pb-4">
              {calendarDays.map((date, idx) => {
                if (!date) {
                  return <div key={`empty-${idx}`} className="aspect-square" />;
                }

                const isSelected = selectedDate &&
                  date.getDate() === selectedDate.getDate() &&
                  date.getMonth() === selectedDate.getMonth() &&
                  date.getFullYear() === selectedDate.getFullYear();
                const isToday =
                  date.getDate() === today.getDate() &&
                  date.getMonth() === today.getMonth() &&
                  date.getFullYear() === today.getFullYear();
                const disabled = isDateDisabled(date);

                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => handleSelect(date)}
                    disabled={disabled}
                    className={cn(
                      "aspect-square flex items-center justify-center rounded-full text-sm font-medium transition-colors",
                      "min-h-[44px]", // Touch target
                      isSelected && "bg-primary text-primary-foreground",
                      !isSelected && isToday && "bg-primary/10 text-primary font-bold",
                      !isSelected && !isToday && !disabled && "hover:bg-muted active:bg-muted/80",
                      disabled && "text-muted-foreground/30 cursor-not-allowed"
                    )}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Clear button */}
            {value && (
              <div className="px-4 pb-4">
                <Button
                  variant="ghost"
                  className="w-full text-destructive"
                  onClick={() => { onChange(""); setIsOpen(false); }}
                >
                  Datum entfernen
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
