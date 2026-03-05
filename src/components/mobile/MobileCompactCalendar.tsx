/**
 * MOB5-8: Mobile Compact Calendar
 * Compact month calendar for maintenance dates, deadlines, and appointments.
 * Touch-optimized with swipe between months and dot indicators for events.
 */
import { useState, useCallback, useMemo, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CalendarEvent {
  /** Event date (ISO string or Date) */
  date: string | Date;
  /** Event title */
  title: string;
  /** Color variant */
  color?: "red" | "blue" | "green" | "orange" | "purple";
  /** Event ID */
  id?: string;
}

interface MobileCompactCalendarProps {
  /** Events to display */
  events?: CalendarEvent[];
  /** Selected date */
  selectedDate?: Date;
  /** Date selection handler */
  onDateSelect?: (date: Date) => void;
  /** Month change handler */
  onMonthChange?: (year: number, month: number) => void;
  /** Additional class */
  className?: string;
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

const eventColorMap: Record<string, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
};

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function getMonthDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  // Monday = 0, Sunday = 6 (ISO week)
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (Date | null)[] = [];

  // Padding for days before month start
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }

  // Actual days
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, month, d));
  }

  return days;
}

export const MobileCompactCalendar = memo(function MobileCompactCalendar({
  events = [],
  selectedDate,
  onDateSelect,
  onMonthChange,
  className,
}: MobileCompactCalendarProps) {
  const isMobile = useIsMobile();
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(() => selectedDate || today);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = useMemo(() => getMonthDays(year, month), [year, month]);

  // Group events by date key
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const d = new Date(event.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const existing = map.get(key) || [];
      existing.push(event);
      map.set(key, existing);
    }
    return map;
  }, [events]);

  const goToPrevMonth = useCallback(() => {
    setViewDate(prev => {
      const next = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      onMonthChange?.(next.getFullYear(), next.getMonth());
      return next;
    });
  }, [onMonthChange]);

  const goToNextMonth = useCallback(() => {
    setViewDate(prev => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      onMonthChange?.(next.getFullYear(), next.getMonth());
      return next;
    });
  }, [onMonthChange]);

  const goToToday = useCallback(() => {
    setViewDate(today);
    onMonthChange?.(today.getFullYear(), today.getMonth());
  }, [today, onMonthChange]);

  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goToPrevMonth}
          className={cn(
            "p-2 rounded-full hover:bg-muted active:bg-muted/80 transition-colors",
            isMobile && "min-w-[44px] min-h-[44px] flex items-center justify-center"
          )}
          aria-label="Vorheriger Monat"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          onClick={goToToday}
          className="text-sm font-semibold hover:text-primary transition-colors"
        >
          {MONTHS[month]} {year}
        </button>

        <button
          onClick={goToNextMonth}
          className={cn(
            "p-2 rounded-full hover:bg-muted active:bg-muted/80 transition-colors",
            isMobile && "min-w-[44px] min-h-[44px] flex items-center justify-center"
          )}
          aria-label="Nächster Monat"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {WEEKDAYS.map(day => (
          <div
            key={day}
            className="text-center text-[10px] font-medium text-muted-foreground py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0">
        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const dateKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
          const dayEvents = eventsByDate.get(dateKey) || [];
          const isToday = isSameDay(day, today);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <button
              key={dateKey}
              onClick={() => onDateSelect?.(day)}
              className={cn(
                "aspect-square flex flex-col items-center justify-center rounded-lg relative",
                "text-xs transition-colors",
                isMobile && "min-h-[36px]",
                isSelected
                  ? "bg-primary text-primary-foreground font-semibold"
                  : isToday
                    ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/30"
                    : "hover:bg-muted active:bg-muted/80",
                isWeekend && !isSelected && !isToday && "text-muted-foreground"
              )}
              aria-label={`${day.getDate()}. ${MONTHS[day.getMonth()]} ${day.getFullYear()}${dayEvents.length > 0 ? `, ${dayEvents.length} Termin${dayEvents.length > 1 ? "e" : ""}` : ""}`}
            >
              <span>{day.getDate()}</span>

              {/* Event dots */}
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 3).map((event, i) => (
                    <span
                      key={i}
                      className={cn(
                        "w-1 h-1 rounded-full",
                        isSelected
                          ? "bg-primary-foreground"
                          : eventColorMap[event.color || "blue"] || "bg-blue-500"
                      )}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date events */}
      {selectedDate && (
        <div className="mt-3 pt-3 border-t">
          {(() => {
            const selectedKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
            const selectedEvents = eventsByDate.get(selectedKey) || [];
            if (selectedEvents.length === 0) {
              return (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Keine Termine am {selectedDate.getDate()}. {MONTHS[selectedDate.getMonth()]}
                </p>
              );
            }
            return (
              <div className="space-y-1.5">
                {selectedEvents.map((event, i) => (
                  <div
                    key={event.id || i}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50"
                  >
                    <span className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      eventColorMap[event.color || "blue"] || "bg-blue-500"
                    )} />
                    <span className="text-xs">{event.title}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
});
