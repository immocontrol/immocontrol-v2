/**
 * Small Level/Streak chip in the nav – links to /erfolge.
 */
import { Link } from "react-router-dom";
import { Flame, Trophy } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { useUserActivity } from "@/hooks/useUserActivity";
import { getLevelForPoints } from "@/lib/achievements";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function GamificationNavChip() {
  const { stats } = useProperties();
  const { streak } = useUserActivity();

  const points = stats.totalUnits * 1 + stats.propertyCount * 2;
  const level = getLevelForPoints(points);

  return (
    <Link
      to={ROUTES.ERFOLGE}
      className={cn(
        "hidden sm:inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium",
        "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50",
        "transition-colors"
      )}
      aria-label="Erfolge anzeigen"
    >
      <span aria-hidden>{level.emoji}</span>
      <span className="max-w-[72px] truncate">{level.title}</span>
      {streak > 0 && (
        <>
          <span className="text-border">|</span>
          <Flame className={cn("h-3 w-3 shrink-0", "text-amber-500")} />
          <span>{streak}</span>
        </>
      )}
    </Link>
  );
}
