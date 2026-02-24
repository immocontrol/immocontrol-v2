import { useMemo } from "react";
import { CheckCircle2, TrendingUp, Zap, Target } from "lucide-react";

interface TodoStatsProps {
  todos: Array<{
    completed: boolean;
    completed_at: string | null;
    due_date: string | null;
    priority: number;
  }>;
}

const TodoStats = ({ todos }: TodoStatsProps) => {
  const stats = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter(t => t.completed).length;
    const pending = total - completed;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    const today = new Date().toISOString().split("T")[0];
    const completedToday = todos.filter(t =>
      t.completed && t.completed_at && t.completed_at.startsWith(today)
    ).length;

    const overdue = todos.filter(t =>
      !t.completed && t.due_date && t.due_date < today
    ).length;

    const highPriority = todos.filter(t => !t.completed && t.priority <= 2).length;

    return { total, completed, pending, completionRate, completedToday, overdue, highPriority };
  }, [todos]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      <div className="gradient-card rounded-xl border border-border p-3 text-center">
        <CheckCircle2 className="h-4 w-4 text-profit mx-auto mb-1" />
        <p className="text-xl font-bold text-profit">{stats.completionRate.toFixed(0)}%</p>
        <p className="text-[10px] text-muted-foreground">Abgeschlossen</p>
      </div>
      <div className="gradient-card rounded-xl border border-border p-3 text-center">
        <Zap className="h-4 w-4 text-gold mx-auto mb-1" />
        <p className="text-xl font-bold">{stats.completedToday}</p>
        <p className="text-[10px] text-muted-foreground">Heute erledigt</p>
      </div>
      <div className={`gradient-card rounded-xl border p-3 text-center ${stats.overdue > 0 ? "border-loss/30 bg-loss/5" : "border-border"}`}>
        <Target className={`h-4 w-4 mx-auto mb-1 ${stats.overdue > 0 ? "text-loss" : "text-muted-foreground"}`} />
        <p className={`text-xl font-bold ${stats.overdue > 0 ? "text-loss" : ""}`}>{stats.overdue}</p>
        <p className="text-[10px] text-muted-foreground">Überfällig</p>
      </div>
      <div className={`gradient-card rounded-xl border p-3 text-center ${stats.highPriority > 0 ? "border-gold/30 bg-gold/5" : "border-border"}`}>
        <TrendingUp className={`h-4 w-4 mx-auto mb-1 ${stats.highPriority > 0 ? "text-gold" : "text-muted-foreground"}`} />
        <p className={`text-xl font-bold ${stats.highPriority > 0 ? "text-gold" : ""}`}>{stats.highPriority}</p>
        <p className="text-[10px] text-muted-foreground">Hohe Priorität</p>
      </div>
    </div>
  );
};

export default TodoStats;
