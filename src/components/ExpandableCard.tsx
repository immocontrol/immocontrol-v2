/**
 * Reusable expandable card: title + trigger to expand/collapse content.
 * Uses Radix Collapsible for a11y; reduces duplicate expand state across widgets.
 */
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface ExpandableCardProps {
  title: React.ReactNode;
  /** Default expanded (default: true) */
  defaultOpen?: boolean;
  /** Extra class for the card */
  className?: string;
  /** Badge or extra content next to title */
  badge?: React.ReactNode;
  children: React.ReactNode;
  /** Trigger button class (e.g. h-6 w-6) */
  triggerClassName?: string;
}

export function ExpandableCard({
  title,
  defaultOpen = true,
  className,
  badge,
  children,
  triggerClassName = "h-6 w-6",
}: ExpandableCardProps) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {title}
              {badge}
            </div>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("group shrink-0", triggerClassName)}
                aria-label="Bereich aufklappen oder einklappen"
              >
                <ChevronDown className="h-3 w-3 group-data-[state=open]:hidden" />
                <ChevronUp className="h-3 w-3 hidden group-data-[state=open]:block" />
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
