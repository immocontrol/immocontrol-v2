import { useEffect, useRef, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Info, Loader2, MapPin } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { queryKeys } from "@/lib/queryKeys";
import { fetchLatestInvestorMapSnapshot } from "@/integrations/news/investorMapSnapshot";
import type { InvestorMapBlEntry } from "@/integrations/news/investorMapSnapshot";
import { Button } from "@/components/ui/button";

const loadLeaflet = (): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const w = window as unknown as { L?: unknown };
    if (w.L) {
      resolve(w.L);
      return;
    }

    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve((window as unknown as { L: unknown }).L);
    script.onerror = reject;
    document.head.appendChild(script);
  });

function scoreHue(score: number, maxScore: number): string {
  if (maxScore <= 0) return "210 40% 45%";
  const t = Math.min(1, Math.max(0, score / maxScore));
  const hue = 200 - t * 95;
  const sat = 35 + t * 35;
  const light = 42 - t * 10;
  return `${hue} ${sat}% ${light}%`;
}

const NewsInvestorMapPage = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<{ remove: () => void } | null>(null);
  const layerRef = useRef<{ clearLayers: () => void } | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const { data: snapshot, isLoading, error, isError } = useQuery({
    queryKey: queryKeys.newsInvestorMap.latest,
    queryFn: fetchLatestInvestorMapSnapshot,
    staleTime: 30 * 60_000,
  });

  const entries = useMemo(() => {
    if (!snapshot?.payload?.bundeslaender) return [];
    return Object.values(snapshot.payload.bundeslaender).sort((a, b) => b.score - a.score);
  }, [snapshot]);

  const maxScore = snapshot?.payload.maxScore ?? 1;

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    loadLeaflet().then((LUnknown) => {
      if (cancelled || !mapRef.current) return;
      const L = LUnknown as {
        map: (el: HTMLElement, opts?: object) => { remove: () => void };
        tileLayer: (u: string, o?: object) => { addTo: (m: unknown) => unknown };
        layerGroup: () => { addTo: (m: unknown) => unknown; clearLayers: () => void };
      };

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const map = L.map(mapRef.current, {
        center: [51.1657, 10.4515],
        zoom: 6,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const group = L.layerGroup();
      group.addTo(map);
      layerRef.current = group;
      mapInstanceRef.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !layerRef.current || !snapshot || entries.length === 0) return;
    const L = (window as unknown as { L: {
      circleMarker: (latlng: [number, number], o?: object) => { addTo: (m: unknown) => unknown; bindPopup: (c: string) => unknown };
    } }).L;
    if (!L) return;

    const group = layerRef.current;
    group.clearLayers();

    for (const bl of entries) {
      const r = Math.max(8, Math.min(42, 10 + (bl.score / Math.max(maxScore, 0.01)) * 32));
      const hsl = scoreHue(bl.score, maxScore);
      const cm = L.circleMarker([bl.lat, bl.lng], {
        radius: r,
        fillColor: `hsl(${hsl})`,
        color: "hsl(var(--border))",
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.75,
      });
      const popup = [
        `<strong class="text-wrap-safe">${escapeHtml(bl.label)}</strong>`,
        `<div class="text-sm mt-1">Score: ${bl.score} · Artikel: ${bl.articleCount}</div>`,
        bl.sampleTitles.length
          ? `<ul class="text-xs mt-2 list-disc pl-4 space-y-1">${bl.sampleTitles.map((t) => `<li class="text-wrap-safe">${escapeHtml(t)}</li>`).join("")}</ul>`
          : "",
      ].join("");
      cm.bindPopup(popup);
      cm.addTo(group as unknown);
    }
  }, [mapReady, snapshot, entries, maxScore]);

  return (
    <div id="main-content" className="container max-w-5xl mx-auto px-4 py-6 space-y-6 min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="shrink-0">
          <Link to={ROUTES.HOME} className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Newsticker
          </Link>
        </Button>
        <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2 min-w-0 text-wrap-safe">
          <MapPin className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden />
          Investor-News-Landkarte (Deutschland)
        </h1>
      </div>

      <p className="text-sm text-muted-foreground text-wrap-safe max-w-3xl">
        Heuristik aus Immo- und Wirtschafts-RSS: Positive Signale (Ansiedlung, Infrastruktur, Standort, Jobs&nbsp;…) werden
        pro Bundesland gewichtet. <strong>Keine Anlageberatung.</strong> Daten werden serverseitig maximal 1× pro Tag
        aktualisiert (wenn der Cron/Deploy aktiv ist).
      </p>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground" role="status">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Karte wird geladen…
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-wrap-safe">
          {error instanceof Error ? error.message : "Daten konnten nicht geladen werden."}
        </div>
      )}

      {!isLoading && !snapshot && !isError && (
        <div className="rounded-lg border border-border bg-card/50 px-4 py-6 flex gap-3 text-wrap-safe">
          <Info className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
          <div className="space-y-2 text-sm">
            <p className="font-medium">Noch kein Snapshot vorhanden</p>
            <p className="text-muted-foreground">
              Sobald die Edge Function <code className="text-xs bg-muted px-1 rounded">news-daily-aggregate</code>{" "}
              (Cron) gelaufen ist, erscheint hier die Karte. Admin: siehe{" "}
              <span className="font-mono text-xs">docs/OPERATIONS.md</span>.
            </p>
          </div>
        </div>
      )}

      {snapshot && (
        <div className="space-y-2 text-sm text-muted-foreground text-wrap-safe">
          <p>
            Stand:{" "}
            <time dateTime={snapshot.day}>
              {new Date(snapshot.day + "T12:00:00").toLocaleDateString("de-DE", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
            {" · "}
            Feeds ok: {snapshot.payload.meta.feedsOk}/{snapshot.payload.meta.feedsAttempted} · Eindeutige Titel:{" "}
            {snapshot.payload.meta.uniqueItems}
          </p>
        </div>
      )}

      <div
        ref={mapRef}
        className="w-full rounded-xl border border-border overflow-hidden min-h-[min(70vh,520px)] max-h-[80vh] z-0 bg-muted/30"
        aria-label="Karte Deutschland mit Bundesland-Markern"
      />

      {snapshot && entries.length > 0 && (
        <div className="gradient-card rounded-xl border border-border p-5 space-y-3">
          <h2 className="text-sm font-semibold">Ranking (höchster Score zuerst)</h2>
          <ol className="space-y-3 list-decimal list-inside text-sm">
            {entries.map((bl: InvestorMapBlEntry) => (
              <li key={bl.code} className="marker:font-medium">
                <span className="font-medium">{bl.label}</span>
                <span className="text-muted-foreground"> — Score {bl.score}, {bl.articleCount} Zuordnung(en)</span>
                {bl.sampleTitles.length > 0 && (
                  <ul className="mt-1 ml-6 list-disc text-xs text-muted-foreground space-y-1">
                    {bl.sampleTitles.map((t, i) => (
                      <li key={`${bl.code}-${i}`} className="text-wrap-safe">
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default NewsInvestorMapPage;
