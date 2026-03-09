/**
 * UX: Zuletzt angesehene Objekte — Schnellzugriff im Header.
 */
import { Link } from "react-router-dom";
import { Building2, History } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useRecentProperties } from "@/hooks/useRecentProperties";
import { propertyDetail } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function RecentPropertiesNav() {
  const { recent } = useRecentProperties();
  if (recent.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground h-8 px-2"
          aria-label="Zuletzt angesehene Objekte"
        >
          <History className="h-3.5 w-3.5" />
          <span className="hidden lg:inline text-xs">Zuletzt</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Zuletzt angesehen
        </DropdownMenuLabel>
        {recent.map((p) => (
          <DropdownMenuItem key={p.id} asChild>
            <Link
              to={propertyDetail(p.id)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className={cn("truncate")} title={p.name}>{p.name}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
