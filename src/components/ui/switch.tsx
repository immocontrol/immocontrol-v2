import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-0 transition-all duration-300 ease-out",
      "data-[state=unchecked]:bg-muted-foreground/25 hover:data-[state=unchecked]:bg-muted-foreground/30",
      "data-[state=checked]:bg-primary data-[state=checked]:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.2)]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-6 w-6 rounded-full ring-0 transition-all duration-300 ease-out",
        "shadow-[0_2px_8px_rgba(0,0,0,0.15)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]",
        "bg-white dark:bg-white",
        "data-[state=unchecked]:translate-x-0.5 data-[state=checked]:translate-x-[22px]",
        "data-[state=checked]:shadow-[0_2px_8px_hsl(var(--primary)/0.35)]",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
