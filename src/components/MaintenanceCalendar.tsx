/**
 * FEATURE-6: Wartungsplaner Kalenderansicht
 *
 * Month-grid calendar view for maintenance items.
 * Shows planned maintenance tasks on their due dates with color-coded priority.
 */

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";

interface CalendarItem {
  id: string;
  title: string;
  planned_date: string;
  priority: "high" | "medium" | "low";
  category: string;
  estimated_cost: number;
  completed: boolean;
  property_name?: string;
}

interface MaintenanceCalendarProps {
  items: CalendarItem[];
  onItemClick?: (item: CalendarItem) => void;
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const priorityColors: Record<string, string> = {
  high: "bg-loss/20 text-loss border-loss/30",
  medium: "bg-gold/20 text-gold border-gold/30",
  low: "bg-primary/20 text-primary border-primary/30",
};

const priorityDot: Record<string, string> = {
  high: "bg-loss",
  medium: "bg-gold",
  low: "bg-primary",
};

const MaintenanceCalendar = ({ items, onItemClick }: MaintenanceCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
    const totalDays = lastDay.getDate();

    const days: Array<{ date: number; isCurrentMonth: boolean; dateStr: string }> = [];

    // Previous month padding
    const prevMonthLast = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevMonthLast - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      days.push({ date: d, isCurrentMonth: false, dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      days.push({
        date: d,
        isCurrentMonth: true,
        dateStr: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      });
    }

    // Next month padding to fill grid
    const remaining = 42 - days.length; // 6 rows x 7 cols
    for (let d = 1; d <= remaining; d++) {
      const m = month + 2 > 12 ? 1 : month + 2;
      const y = month + 2 > 12 ? year + 1 : year;
      days.push({ date: d, isCurrentMonth: false, dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
    }

    return days;
  }, [year, month]);

  // Map items to dates
  const itemsByDate = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    for (const item of items) {
      if (!item.planned_date) continue;
      const key = item.planned_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [items]);

  const today = new Date().toISOString().slice(0, 10);

  // Monthly stats
  const monthItems = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    return items.filter(i => i.planned_date?.startsWith(prefix));
  }, [items, year, month]);

  const monthCost = monthItems.reduce((s, i) => s + (i.estimated_cost || 0), 0);
  const monthOverdue = monthItems.filter(i => !i.completed && i.planned_date < today).length;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Wartungskalender</h3>
          {monthItems.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {monthItems.length} Eintr.
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={prevMonth} className="h-7 w-7 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button onClick={goToday} className="text-sm font-medium px-2 hover:text-primary transition-colors min-w-[140px] text-center">
            {MONTHS_DE[month]} {year}
          </button>
          <Button variant="ghost" size="sm" onClick={nextMonth} className="h-7 w-7 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Month stats */}
      {monthItems.length > 0 && (
        <div className="flex items-center gap-4 mb-3 text-[10px] text-muted-foreground">
          <span>Geplante Kosten: <strong className="text-foreground">{formatCurrency(monthCost)}</strong></span>
          {monthOverdue > 0 && (
            <span className="text-loss">Überfällig: <strong>{monthOverdue}</strong></span>
          )}
        </div>
      )}

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-[10px] text-muted-foreground text-center font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {calendarDays.map((day, idx) => {
          const dayItems = itemsByDate[day.dateStr] || [];
          const isToday = day.dateStr === today;
          const isOverdue = dayItems.some(i => !i.completed && day.dateStr < today);

          return (
            <div
              key={idx}
              className={`min-h-[56px] p-1 rounded-lg border transition-colors ${
                !day.isCurrentMonth
                  ? "bg-muted/30 border-transparent"
                  : isToday
                    ? "bg-primary/5 border-primary/20"
                    : dayItems.length > 0
                      ? "bg-secondary/50 border-border hover:bg-secondary/80"
                      : "border-transparent hover:bg-secondary/30"
              }`}
            >
              <div className={`text-[10px] font-medium mb-0.5 ${
                !day.isCurrentMonth ? "text-muted-foreground/40" :
                isToday ? "text-primary font-bold" :
                isOverdue ? "text-loss" : ""
              }`}>
                {day.date}
              </div>
              <div className="space-y-0.5">
                {dayItems.slice(0, 2).map(item => (
                  <button
                    key={item.id}
                    onClick={() => onItemClick?.(item)}
                    className={`w-full text-left text-[9px] leading-tight px-1 py-0.5 rounded truncate border ${
                      item.completed
                        ? "bg-profit/10 text-profit/70 border-profit/20 line-through"
                        : priorityColors[item.priority]
                    } hover:opacity-80 transition-opacity`}
                    title={`${item.title} — ${item.property_name || ""} (${formatCurrency(item.estimated_cost)})`}
                  >
                    <span className={`inline-block w-1 h-1 rounded-full mr-0.5 ${item.completed ? "bg-profit" : priorityDot[item.priority]}`} />
                    {item.title}
                  </button>
                ))}
                {dayItems.length > 2 && (
                  <div className="text-[8px] text-muted-foreground text-center">
                    +{dayItems.length - 2}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MaintenanceCalendar;
