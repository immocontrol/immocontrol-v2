import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/** iOS-26-Style: Pill-Track (grau/grün), weißer Knob mit weichem Schatten. */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-0",
      "bg-neutral-200 dark:bg-neutral-600",
      "data-[state=checked]:bg-[#34C759] data-[state=checked]:dark:bg-[#30D158]",
      "hover:bg-neutral-300 hover:dark:bg-neutral-500 hover:data-[state=checked]:bg-[#30D158] hover:data-[state=checked]:dark:bg-[#32D657]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "transition-colors duration-200 ease-out",
      "px-0.5",
      className,
    )}
    {...props}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-white dark:bg-white border-0 ring-0",
        "shadow-[0_2px_4px_rgba(0,0,0,0.2)] dark:shadow-[0_2px_6px_rgba(0,0,0,0.4)]",
        "transition-transform duration-200 ease-out",
        "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-[22px]",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
