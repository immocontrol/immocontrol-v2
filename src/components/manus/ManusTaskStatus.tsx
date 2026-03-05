/**
 * ManusTaskStatus — Reusable component showing Manus task polling state
 */
import { Loader2, CheckCircle2, AlertCircle, Clock, Bot } from "lucide-react";
import type { ManusTaskStatus as TaskStatus } from "@/lib/manusAgent";

interface ManusTaskStatusProps {
  status: TaskStatus | "idle" | "submitting";
  label?: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { icon: typeof Loader2; color: string; text: string }> = {
  idle: { icon: Clock, color: "text-muted-foreground", text: "Bereit" },
  submitting: { icon: Loader2, color: "text-blue-500", text: "Wird gesendet..." },
  pending: { icon: Clock, color: "text-amber-500", text: "In Warteschlange..." },
  running: { icon: Bot, color: "text-blue-500", text: "Manus arbeitet..." },
  completed: { icon: CheckCircle2, color: "text-emerald-500", text: "Fertig" },
  failed: { icon: AlertCircle, color: "text-red-500", text: "Fehlgeschlagen" },
};

export const ManusTaskStatusIndicator = ({ status, label, className = "" }: ManusTaskStatusProps) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const Icon = config.icon;
  const isAnimating = status === "submitting" || status === "running" || status === "pending";

  return (
    <div className={`flex items-center gap-2 text-xs ${config.color} ${className}`}>
      <Icon className={`h-3.5 w-3.5 ${isAnimating ? "animate-spin" : ""}`} />
      <span className="font-medium">{label || config.text}</span>
      {isAnimating && (
        <span className="flex gap-0.5">
          <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
          <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
          <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
        </span>
      )}
    </div>
  );
};
