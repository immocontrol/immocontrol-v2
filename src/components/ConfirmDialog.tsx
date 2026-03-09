import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/** IMP-133: Reusable confirm dialog for destructive actions. Callers should show toast.success after onConfirm for clear feedback. */
interface ConfirmDialogProps {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  variant?: "destructive" | "default";
}

const ConfirmDialog = ({ trigger, title, description, confirmLabel = "Bestätigen", onConfirm, variant = "destructive" }: ConfirmDialogProps) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="touch-target min-h-[44px]">Abbrechen</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} className={cn("touch-target min-h-[44px]", variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}>
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default ConfirmDialog;
