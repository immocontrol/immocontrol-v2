/**
 * ViewingCard — Extrahiert aus Besichtigungen für bessere Wartbarkeit
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { ROUTES, dealsWithId } from "@/lib/routes";
import { MapPin, Calendar, Star, Image, Link2, Store } from "lucide-react";
import { formatDate, relativeTime } from "@/lib/formatters";

export interface ViewingCardRecord {
  id: string;
  title: string;
  address: string | null;
  deal_id: string | null;
  visited_at: string | null;
  rating: number | null;
  created_at: string;
  pro_points?: string | null;
  contra_points?: string | null;
}

export function viewingScore(v: ViewingCardRecord): number {
  const r = v.rating ?? 0;
  const proLen = (v.pro_points || "").length;
  const contraLen = (v.contra_points || "").length;
  const proBonus = Math.min(2, Math.floor(proLen / 50));
  const contraPenalty = Math.min(-2, -Math.floor(contraLen / 80));
  return Math.max(1, Math.min(10, r * 2 + proBonus + contraPenalty + 5));
}

interface ViewingCardProps {
  viewing: ViewingCardRecord;
  mediaCount: number;
  onClick: () => void;
}

export function ViewingCard({ viewing, mediaCount, onClick }: ViewingCardProps) {
  const score = viewingScore(viewing);
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
      role="listitem"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      aria-label={`Besichtigung: ${viewing.title}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-start justify-between gap-2">
          <span className="truncate" title={viewing.title}>{viewing.title}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded" title="Vergleichs-Score">
              {score}/10
            </span>
            {viewing.deal_id && (
              <Link to={dealsWithId(viewing.deal_id)} onClick={(e) => e.stopPropagation()} className="shrink-0">
                <Badge variant="outline" className="text-[10px] gap-0.5 hover:bg-primary/10 cursor-pointer" title="Zum Deal">
                  <Link2 className="h-2.5 w-2.5" />
                  Deal
                </Badge>
              </Link>
            )}
            {viewing.rating != null && viewing.rating > 0 && (
              <span className="flex items-center gap-0.5 text-amber-500" aria-label={`Bewertung ${viewing.rating} von 5`}>
                <Star className="h-4 w-4 fill-current" />
                {viewing.rating}
              </span>
            )}
          </div>
        </CardTitle>
        {viewing.address && (
          <>
            <p className="text-sm text-muted-foreground flex items-center gap-1 truncate" title={viewing.address}>
              <MapPin className="h-3.5 w-3 shrink-0" />
              {viewing.address}
            </p>
            <Link
              to={`${ROUTES.CRM_SCOUT}&q=${encodeURIComponent(viewing.address.trim())}`}
              className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5 w-fit mt-0.5"
              onClick={(e) => e.stopPropagation()}
              aria-label="WGH in Umgebung suchen"
            >
              <Store className="h-2.5 w-2.5 shrink-0" /> WGH in Umgebung
            </Link>
          </>
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          {viewing.visited_at && (
            <Badge variant="secondary" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              {formatDate(viewing.visited_at)}
            </Badge>
          )}
          {mediaCount > 0 && (
            <Badge variant="secondary" className="text-xs gap-0.5">
              <Image className="h-3 w-3" />
              {mediaCount}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{relativeTime(viewing.created_at)}</span>
        </div>
      </CardHeader>
    </Card>
  );
}
