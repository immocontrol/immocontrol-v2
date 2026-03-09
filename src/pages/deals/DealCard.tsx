/**
 * Deals page — single deal card (Kanban/list), extracted for smaller Deals.tsx.
 */
import { memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, AlertTriangle, Share2, Store, MessageSquare, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateDealScore } from "@/lib/dealScoring";
import { ROUTES, propertyDetail } from "@/lib/routes";
import { DealToPropertyConverter } from "@/components/DealToPropertyConverter";
import { getDealAgeColor, formatDealCurrency } from "./dealUtils";
import type { DealRecord } from "./DealTypes";

const fmt = formatDealCurrency;

interface DealCardProps {
  deal: DealRecord;
  onClick: () => void;
  onShare?: (deal: DealRecord) => void;
  onConverted?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}

export const DealCard = memo(function DealCard({
  deal,
  onClick,
  onShare,
  onConverted,
  draggable,
  onDragStart,
  onDragEnd,
}: DealCardProps) {
  const dealAge = Math.floor((Date.now() - new Date(deal.created_at).getTime()) / 86400000);
  const isStale = dealAge > 30 && deal.stage !== "abgeschlossen" && deal.stage !== "abgelehnt";
  const isTelegram = deal.source?.toLowerCase().includes("telegram");

  return (
    <Card
      className={cn(
        "cursor-pointer hover:shadow-md transition-all duration-200",
        isStale && "border-yellow-500/40",
        draggable && "active:scale-[0.98]",
      )}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      role="button"
      aria-label={`Deal: ${deal.title}`}
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter") onClick(); }}
    >
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-1">
          <p className="font-medium text-sm truncate flex-1" title={deal.title}>{deal.title}</p>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className="text-[9px] h-5 px-1" title="Deal-Score (Priorisierung)">
              {calculateDealScore(deal)}%
            </Badge>
            {onShare && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onShare(deal); }}
                className="p-1 rounded hover:bg-secondary transition-colors"
                aria-label="Deal teilen"
              >
                <Share2 className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
            {isStale && <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />}
          </div>
        </div>
        {deal.address && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 shrink-0" /> {deal.address}
          </p>
        )}
        {deal.address && (
          <Link
            to={`${ROUTES.CRM_SCOUT}&q=${encodeURIComponent(deal.address)}`}
            className="text-[10px] text-primary hover:underline flex items-center gap-1 w-fit"
            onClick={(e) => e.stopPropagation()}
            aria-label="WGH in Umgebung suchen"
          >
            <Store className="h-3 w-3 shrink-0" /> WGH in Umgebung
          </Link>
        )}
        <div className="flex items-center justify-between flex-wrap gap-1">
          {(deal.purchase_price ?? 0) > 0 && <span className="text-xs font-medium">{fmt(deal.purchase_price!)}</span>}
          {(() => {
            const price = deal.purchase_price ?? 0;
            const rent = deal.expected_rent ?? 0;
            const yieldPct = price > 0 && rent > 0 ? (rent * 12 / price) * 100 : deal.expected_yield ?? 0;
            return yieldPct > 0 ? (
              <Badge variant="outline" className="text-[10px]">{yieldPct.toFixed(1)}% Brutto</Badge>
            ) : null;
          })()}
        </div>
        {(deal.purchase_price ?? 0) > 0 && (deal.sqm ?? 0) > 0 && (
          <p className="text-[10px] text-muted-foreground">{fmt(Math.round(deal.purchase_price! / deal.sqm!))} / m²</p>
        )}
        {(deal.expected_rent ?? 0) > 0 && !((deal.purchase_price ?? 0) > 0 && (deal.sqm ?? 0) > 0) && (
          <p className="text-[10px] text-muted-foreground">{fmt((deal.expected_rent ?? 0) * 12)} J/Miete</p>
        )}
        <div className="flex items-center justify-between">
          {deal.contact_name && (
            <p className="text-[10px] text-muted-foreground truncate">{deal.contact_name}</p>
          )}
          {isTelegram && (
            <Badge variant="secondary" className="text-[10px] h-4 gap-0.5">
              <MessageSquare className="h-2.5 w-2.5" /> Telegram
            </Badge>
          )}
        </div>
        <p className={cn("text-[10px] flex items-center gap-1", getDealAgeColor(dealAge))}>
          <Clock className="h-2.5 w-2.5" /> {dealAge}d
        </p>
        {deal.property_id && (
          <Link
            to={propertyDetail(deal.property_id)}
            className="text-[10px] text-primary hover:underline flex items-center gap-1 w-fit mt-1"
            onClick={e => e.stopPropagation()}
            aria-label="Zum Objekt"
          >
            <Home className="h-3 w-3 shrink-0" /> Zum Objekt
          </Link>
        )}
        {deal.stage === "abgeschlossen" && (
          <div className="pt-2 border-t border-border mt-2" onClick={e => e.stopPropagation()}>
            <DealToPropertyConverter
              deal={{
                id: deal.id,
                title: deal.title,
                address: deal.address,
                purchase_price: deal.purchase_price,
                expected_rent: deal.expected_rent,
                sqm: deal.sqm,
                units: deal.units,
                property_type: deal.property_type,
              }}
              onConverted={onConverted}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
});
