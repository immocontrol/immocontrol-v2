import { LucideIcon } from "lucide-react";

/** IMP-132: Reusable empty state component */
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
      <Icon className="h-7 w-7 text-muted-foreground/50" />
    </div>
    <h3 className="text-base font-semibold mb-1.5">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
    {action}
  </div>
);

export default EmptyState;
