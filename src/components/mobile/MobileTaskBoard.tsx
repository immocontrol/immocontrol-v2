/**
 * MOB6-18: Mobile Task Board
 * Kanban board with drag & drop, optimized for touch devices.
 * Supports column-based task management with status transitions.
 */
import { useState, useCallback, useRef, useMemo, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Plus, MoreVertical, ChevronLeft, ChevronRight, User, Calendar,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: "low" | "medium" | "high";
  assignee?: string;
  dueDate?: string;
  tags?: string[];
}

export interface TaskColumn {
  id: string;
  title: string;
  color: string;
  icon?: React.ReactNode;
  maxItems?: number;
}

interface MobileTaskBoardProps {
  /** Columns definition */
  columns: TaskColumn[];
  /** All tasks */
  tasks: TaskItem[];
  /** Move task to new status */
  onMoveTask?: (taskId: string, newStatus: string) => void;
  /** Add new task */
  onAddTask?: (status: string) => void;
  /** Task click handler */
  onTaskClick?: (task: TaskItem) => void;
  /** Delete task handler */
  onDeleteTask?: (taskId: string) => void;
  /** Additional class */
  className?: string;
}

const priorityColors: Record<string, string> = {
  low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const priorityLabels: Record<string, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
};

export const MobileTaskBoard = memo(function MobileTaskBoard({
  columns,
  tasks,
  onMoveTask,
  onAddTask,
  onTaskClick,
  onDeleteTask,
  className,
}: MobileTaskBoardProps) {
  const isMobile = useIsMobile();
  const [activeColumn, setActiveColumn] = useState(0);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const touchStartRef = useRef({ x: 0, y: 0 });

  // Group tasks by column
  const tasksByColumn = useMemo(() => {
    const grouped = new Map<string, TaskItem[]>();
    for (const col of columns) {
      grouped.set(col.id, []);
    }
    for (const task of tasks) {
      const col = grouped.get(task.status);
      if (col) col.push(task);
    }
    return grouped;
  }, [columns, tasks]);

  // Mobile swipe between columns
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartRef.current.y);
    if (Math.abs(dx) > 50 && dy < 50) {
      if (dx < 0 && activeColumn < columns.length - 1) {
        setActiveColumn(prev => prev + 1);
      } else if (dx > 0 && activeColumn > 0) {
        setActiveColumn(prev => prev - 1);
      }
    }
  }, [activeColumn, columns.length]);

  // Drag handlers
  const handleDragStart = useCallback((taskId: string) => {
    setDraggedTask(taskId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  }, []);

  const handleDrop = useCallback((columnId: string) => {
    if (draggedTask && onMoveTask) {
      onMoveTask(draggedTask, columnId);
    }
    setDraggedTask(null);
    setDragOverColumn(null);
  }, [draggedTask, onMoveTask]);

  // Quick move task via menu
  const handleQuickMove = useCallback((taskId: string, newStatus: string) => {
    onMoveTask?.(taskId, newStatus);
    setShowMenu(null);
  }, [onMoveTask]);

  const renderTask = (task: TaskItem) => (
    <div
      key={task.id}
      draggable
      onDragStart={() => handleDragStart(task.id)}
      className={cn(
        "rounded-lg border bg-background p-2.5 shadow-sm",
        "hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing",
        draggedTask === task.id && "opacity-50"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <button
          onClick={() => onTaskClick?.(task)}
          className="flex-1 text-left min-w-0"
        >
          <p className="text-xs font-medium line-clamp-2">{task.title}</p>
        </button>
        <div className="relative shrink-0">
          <button
            onClick={() => setShowMenu(prev => prev === task.id ? null : task.id)}
            className="p-0.5 rounded hover:bg-muted"
          >
            <MoreVertical className="w-3 h-3" />
          </button>
          {showMenu === task.id && (
            <div className="absolute right-0 top-5 z-20 min-w-[140px] animate-in fade-in zoom-in-95 rounded-xl border border-border/80 bg-background/95 py-1 shadow-md backdrop-blur-sm duration-150">
              {columns.filter(c => c.id !== task.status).map(col => (
                <button
                  key={col.id}
                  onClick={() => handleQuickMove(task.id, col.id)}
                  className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-muted flex items-center gap-1.5"
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                  → {col.title}
                </button>
              ))}
              {onDeleteTask && (
                <>
                  <div className="border-t my-1" />
                  <button
                    onClick={() => { onDeleteTask(task.id); setShowMenu(null); }}
                    className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 flex items-center gap-1.5"
                  >
                    <X className="w-2.5 h-2.5" />
                    Löschen
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {task.priority && (
          <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium", priorityColors[task.priority])}>
            {priorityLabels[task.priority]}
          </span>
        )}
        {task.assignee && (
          <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
            <User className="w-2.5 h-2.5" />
            {task.assignee}
          </span>
        )}
        {task.dueDate && (
          <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
            <Calendar className="w-2.5 h-2.5" />
            {new Date(task.dueDate).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {task.tags.map(tag => (
            <span key={tag} className="px-1.5 py-0.5 rounded bg-muted text-[9px]">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );

  // Mobile: single column view with swipe
  if (isMobile) {
    const currentColumn = columns[activeColumn];
    const currentTasks = tasksByColumn.get(currentColumn?.id || "") || [];

    return (
      <div
        className={cn("w-full", className)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Column tabs */}
        <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
          {columns.map((col, i) => {
            const count = tasksByColumn.get(col.id)?.length || 0;
            return (
              <button
                key={col.id}
                onClick={() => setActiveColumn(i)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap border transition-colors shrink-0",
                  i === activeColumn
                    ? "text-white border-transparent"
                    : "hover:bg-muted",
                  isMobile && "min-h-[36px]"
                )}
                style={i === activeColumn ? { backgroundColor: col.color } : undefined}
              >
                {col.title} ({count})
              </button>
            );
          })}
        </div>

        {/* Column header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveColumn(prev => Math.max(0, prev - 1))}
              disabled={activeColumn === 0}
              className="p-1 rounded hover:bg-muted disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-semibold" style={{ color: currentColumn?.color }}>
              {currentColumn?.title}
            </h3>
            <button
              onClick={() => setActiveColumn(prev => Math.min(columns.length - 1, prev + 1))}
              disabled={activeColumn === columns.length - 1}
              className="p-1 rounded hover:bg-muted disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {onAddTask && (
            <button
              onClick={() => onAddTask(currentColumn?.id || "")}
              className="p-2 rounded-lg hover:bg-muted min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tasks */}
        <div className="space-y-2">
          {currentTasks.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground border-2 border-dashed rounded-xl">
              Keine Aufgaben
            </div>
          ) : (
            currentTasks.map(task => renderTask(task))
          )}
        </div>

        {/* Column dots */}
        <div className="flex justify-center gap-1.5 mt-3">
          {columns.map((col, i) => (
            <div
              key={col.id}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                i === activeColumn ? "bg-primary" : "bg-muted-foreground/20"
              )}
              style={i === activeColumn ? { backgroundColor: col.color } : undefined}
            />
          ))}
        </div>
      </div>
    );
  }

  // Desktop: full kanban board
  return (
    <div className={cn("flex gap-3 overflow-x-auto pb-2", className)}>
      {columns.map(column => {
        const columnTasks = tasksByColumn.get(column.id) || [];
        const isOverLimit = column.maxItems !== undefined && columnTasks.length > column.maxItems;

        return (
          <div
            key={column.id}
            className={cn(
              "flex-shrink-0 w-64 rounded-xl border bg-muted/30",
              dragOverColumn === column.id && "ring-2 ring-primary",
              isOverLimit && "ring-1 ring-amber-400"
            )}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDrop={() => handleDrop(column.id)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color }} />
                <h3 className="text-xs font-semibold">{column.title}</h3>
                <span className="text-[10px] text-muted-foreground">
                  {columnTasks.length}{column.maxItems ? `/${column.maxItems}` : ""}
                </span>
              </div>
              {onAddTask && (
                <button
                  onClick={() => onAddTask(column.id)}
                  className="p-1 rounded hover:bg-muted"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Tasks */}
            <div className="p-2 space-y-1.5 min-h-[100px]">
              {columnTasks.map(task => renderTask(task))}
            </div>
          </div>
        );
      })}
    </div>
  );
});
