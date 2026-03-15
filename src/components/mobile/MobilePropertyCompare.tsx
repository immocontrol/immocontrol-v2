/**
 * MOB6-15: Mobile Property Compare
 * Side-by-side property comparison with radar chart visualization.
 * Swipeable on mobile to compare multiple properties.
 */
import { useState, useCallback, useMemo, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ArrowLeftRight, X, Plus, ChevronLeft, ChevronRight,
  TrendingUp, Home, MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CompareProperty {
  id: string;
  name: string;
  image?: string;
  address?: string;
  metrics: Record<string, { value: number; unit: string; label: string }>;
}

interface MobilePropertyCompareProps {
  /** Properties to compare */
  properties: CompareProperty[];
  /** Handler to add a property */
  onAddProperty?: () => void;
  /** Handler to remove a property */
  onRemoveProperty?: (id: string) => void;
  /** Max properties to compare */
  maxProperties?: number;
  /** Show radar chart */
  showRadar?: boolean;
  /** Additional class */
  className?: string;
}

function normalizeMetric(value: number, allValues: number[]): number {
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

export const MobilePropertyCompare = memo(function MobilePropertyCompare({
  properties,
  onAddProperty,
  onRemoveProperty,
  maxProperties = 4,
  showRadar = true,
  className,
}: MobilePropertyCompareProps) {
  const isMobile = useIsMobile();
  const [activeIndex, setActiveIndex] = useState(0);
  const [highlightMetric, setHighlightMetric] = useState<string | null>(null);

  // Get all unique metric keys
  const metricKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const prop of properties) {
      for (const key of Object.keys(prop.metrics)) {
        keys.add(key);
      }
    }
    return Array.from(keys);
  }, [properties]);

  // Find best value per metric
  const bestValues = useMemo(() => {
    const best: Record<string, { propertyId: string; value: number }> = {};
    for (const key of metricKeys) {
      let bestVal = -Infinity;
      let bestId = "";
      for (const prop of properties) {
        const metric = prop.metrics[key];
        if (metric && metric.value > bestVal) {
          bestVal = metric.value;
          bestId = prop.id;
        }
      }
      best[key] = { propertyId: bestId, value: bestVal };
    }
    return best;
  }, [properties, metricKeys]);

  // Radar chart data
  const radarData = useMemo(() => {
    if (!showRadar || metricKeys.length < 3) return null;

    const allNormalized: Array<{ property: CompareProperty; points: number[] }> = [];
    for (const prop of properties) {
      const points = metricKeys.map(key => {
        const allValues = properties.map(p => p.metrics[key]?.value || 0);
        return normalizeMetric(prop.metrics[key]?.value || 0, allValues);
      });
      allNormalized.push({ property: prop, points });
    }
    return allNormalized;
  }, [properties, metricKeys, showRadar]);

  const radarColors = useMemo(() => ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b"], []);

  // SVG radar chart
  const renderRadar = useCallback(() => {
    if (!radarData || metricKeys.length < 3) return null;

    const size = isMobile ? 200 : 250;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 30;
    const angleStep = (2 * Math.PI) / metricKeys.length;

    return (
      <svg width={size} height={size} className="mx-auto">
        {/* Grid circles */}
        {[0.25, 0.5, 0.75, 1].map(r => (
          <circle
            key={r}
            cx={cx}
            cy={cy}
            r={radius * r}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        ))}

        {/* Axis lines and labels */}
        {metricKeys.map((key, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          const labelX = cx + Math.cos(angle) * (radius + 18);
          const labelY = cy + Math.sin(angle) * (radius + 18);

          return (
            <g key={key}>
              <line
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.15}
                strokeWidth={1}
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground"
                fontSize={8}
              >
                {properties[0]?.metrics[key]?.label || key}
              </text>
            </g>
          );
        })}

        {/* Data polygons */}
        {radarData.map((data, di) => {
          const points = data.points.map((val, i) => {
            const angle = i * angleStep - Math.PI / 2;
            return {
              x: cx + Math.cos(angle) * radius * val,
              y: cy + Math.sin(angle) * radius * val,
            };
          });
          const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

          return (
            <g key={data.property.id}>
              <path
                d={pathD}
                fill={radarColors[di % radarColors.length]}
                fillOpacity={0.15}
                stroke={radarColors[di % radarColors.length]}
                strokeWidth={1.5}
              />
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={3}
                  fill={radarColors[di % radarColors.length]}
                />
              ))}
            </g>
          );
        })}
      </svg>
    );
  }, [radarData, metricKeys, isMobile, properties, radarColors]);

  if (properties.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <ArrowLeftRight className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Wählen Sie Immobilien zum Vergleichen</p>
        {onAddProperty && (
          <button
            onClick={onAddProperty}
            className={cn(
              "mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg mx-auto",
              "bg-primary text-primary-foreground text-sm hover:bg-primary/90",
              isMobile && "min-h-[44px]"
            )}
          >
            <Plus className="w-4 h-4" />
            Immobilie hinzufügen
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4" />
          Vergleich ({properties.length})
        </h2>
        {onAddProperty && properties.length < maxProperties && (
          <button
            onClick={onAddProperty}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border",
              "hover:bg-muted transition-colors",
              isMobile && "min-h-[36px]"
            )}
          >
            <Plus className="w-3 h-3" />
            Hinzufügen
          </button>
        )}
      </div>

      {/* Property cards (mobile: swipeable, desktop: side-by-side) */}
      {isMobile ? (
        <div>
          {/* Navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setActiveIndex(prev => Math.max(0, prev - 1))}
              disabled={activeIndex === 0}
              className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex gap-1">
              {properties.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-colors",
                    i === activeIndex ? "bg-primary" : "bg-muted-foreground/20"
                  )}
                />
              ))}
            </div>
            <button
              onClick={() => setActiveIndex(prev => Math.min(properties.length - 1, prev + 1))}
              disabled={activeIndex === properties.length - 1}
              className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Active property card */}
          {properties[activeIndex] && (
            <div className="border rounded-xl p-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {properties[activeIndex].image ? (
                    <img src={properties[activeIndex].image} alt={properties[activeIndex].name || "Objekt"} className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Home className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold">{properties[activeIndex].name}</p>
                    {properties[activeIndex].address && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {properties[activeIndex].address}
                      </p>
                    )}
                  </div>
                </div>
                {onRemoveProperty && (
                  <button
                    onClick={() => onRemoveProperty(properties[activeIndex].id)}
                    className="p-1 rounded hover:bg-muted"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Metrics */}
              <div className="space-y-1.5 mt-3">
                {metricKeys.map(key => {
                  const metric = properties[activeIndex].metrics[key];
                  if (!metric) return null;
                  const isBest = bestValues[key]?.propertyId === properties[activeIndex].id;

                  return (
                    <div key={key} className="flex items-center justify-between py-1">
                      <span className="text-[10px] text-muted-foreground">{metric.label}</span>
                      <span className={cn(
                        "text-xs font-medium",
                        isBest && "text-green-600"
                      )}>
                        {metric.value.toLocaleString("de-DE")} {metric.unit}
                        {isBest && <TrendingUp className="w-3 h-3 inline ml-1" />}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Desktop: side-by-side table */
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="py-2 px-2 text-left font-medium text-muted-foreground w-32">Merkmal</th>
                {properties.map(prop => (
                  <th key={prop.id} className="py-2 px-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="font-semibold">{prop.name}</span>
                      {onRemoveProperty && (
                        <button onClick={() => onRemoveProperty(prop.id)} className="p-0.5 rounded hover:bg-muted">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricKeys.map(key => (
                <tr
                  key={key}
                  className={cn(
                    "border-b hover:bg-muted/50 transition-colors",
                    highlightMetric === key && "bg-primary/5"
                  )}
                  onMouseEnter={() => setHighlightMetric(key)}
                  onMouseLeave={() => setHighlightMetric(null)}
                >
                  <td className="py-2 px-2 font-medium text-muted-foreground">
                    {properties[0]?.metrics[key]?.label || key}
                  </td>
                  {properties.map(prop => {
                    const metric = prop.metrics[key];
                    const isBest = bestValues[key]?.propertyId === prop.id;
                    return (
                      <td key={prop.id} className={cn("py-2 px-2 text-center", isBest && "font-semibold text-green-600")}>
                        {metric ? `${metric.value.toLocaleString("de-DE")} ${metric.unit}` : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Radar Chart */}
      {showRadar && radarData && metricKeys.length >= 3 && (
        <div className="mt-4">
          <h3 className="text-xs font-medium text-center mb-2">Vergleichs-Radar</h3>
          {renderRadar()}
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {properties.map((prop, i) => (
              <div key={prop.id} className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: radarColors[i % radarColors.length] }}
                />
                <span className="text-[10px]">{prop.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
