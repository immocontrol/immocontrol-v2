/**
 * UX-14: Loading States on Save Buttons
 * Button with integrated loading spinner and disabled state during async operations.
 */
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
}

export function LoadingButton({
  loading = false,
  loadingText,
  children,
  disabled,
  className,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      disabled={loading || disabled}
      className={cn("relative", className)}
      {...props}
    >
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      )}
      {loading && loadingText ? loadingText : children}
    </Button>
  );
}
