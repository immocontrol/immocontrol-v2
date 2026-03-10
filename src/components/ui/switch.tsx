import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    className={cn(
      // Base
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border/60 bg-input",
      // State
      "data-[state=checked]:bg-primary data-[state=checked]:border-primary/70",
      // Hover / active
      "hover:bg-accent hover:data-[state=checked]:bg-primary/90",
      // Focus
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      // Disabled
      "disabled:cursor-not-allowed disabled:opacity-50",
      "transition-colors duration-200 ease-out",
      className,
    )}
    {...props}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm ring-0",
        "transition-transform duration-200 ease-out",
        "data-[state=unchecked]:translate-x-0.5 data-[state=checked]:translate-x-[18px]",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
