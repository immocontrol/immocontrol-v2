import { Badge } from "@/components/ui/badge";

/** IMP-134: Reusable status badge with color coding */
type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusBadgeProps {
  status: StatusVariant;
  label: string;
  size?: "sm" | "md";
}

const variantStyles: Record<StatusVariant, string> = {
  success: "bg-profit/10 text-profit border-profit/20",
  warning: "bg-gold/10 text-gold border-gold/20",
  danger: "bg-loss/10 text-loss border-loss/20",
  info: "bg-primary/10 text-primary border-primary/20",
  neutral: "bg-secondary text-muted-foreground border-border",
};

const StatusBadge = ({ status, label, size = "sm" }: StatusBadgeProps) => (
  <Badge variant="outline" className={`${variantStyles[status]} ${size === "sm" ? "text-[10px] h-5" : "text-xs h-6"}`}>
    {label}
  </Badge>
);

export default StatusBadge;
