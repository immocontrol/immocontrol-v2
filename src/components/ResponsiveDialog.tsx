/**
 * UX-1: Responsive Dialog — Desktop: centered Dialog, Mobile: Bottom Sheet
 * Drop-in replacement for Dialog that automatically switches to a bottom Sheet on mobile.
 */
import * as React from "react";
import { useIsMobile } from "@/hooks/useMediaQuery";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function ResponsiveDialog({ open, onOpenChange, children }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl pb-8">
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Re-export header/footer/title/description that work in both contexts */
export function ResponsiveDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useIsMobile();
  if (isMobile) return <SheetHeader className={className} {...props} />;
  return <DialogHeader className={className} {...props} />;
}

export function ResponsiveDialogTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const isMobile = useIsMobile();
  if (isMobile) return <SheetTitle className={className} {...props}>{children}</SheetTitle>;
  return <DialogTitle className={className} {...props}>{children}</DialogTitle>;
}

export function ResponsiveDialogDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const isMobile = useIsMobile();
  if (isMobile) return <SheetDescription className={className} {...props}>{children}</SheetDescription>;
  return <DialogDescription className={className} {...props}>{children}</DialogDescription>;
}

export function ResponsiveDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useIsMobile();
  if (isMobile) return <SheetFooter className={className} {...props} />;
  return <DialogFooter className={className} {...props} />;
}
