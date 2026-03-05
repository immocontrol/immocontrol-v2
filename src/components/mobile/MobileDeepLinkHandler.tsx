/**
 * MOB6-2: Mobile Deep Link Handler
 * Universal/deep link router for push notifications, Telegram links, and QR codes.
 * Parses incoming URLs and navigates to the correct page with context.
 */
import { useEffect, useCallback, useState, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link2, ExternalLink, AlertCircle, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DeepLinkRoute {
  /** URL pattern (supports :param placeholders) */
  pattern: string;
  /** Handler function receiving parsed params */
  handler: (params: Record<string, string>) => void;
  /** Display label for the route */
  label?: string;
}

interface DeepLinkResult {
  matched: boolean;
  route?: DeepLinkRoute;
  params?: Record<string, string>;
  originalUrl: string;
}

interface MobileDeepLinkHandlerProps {
  /** Registered routes */
  routes: DeepLinkRoute[];
  /** Fallback handler for unmatched links */
  onUnmatched?: (url: string) => void;
  /** Base URL for the app */
  baseUrl?: string;
  /** Enable clipboard link detection */
  enableClipboardDetection?: boolean;
  /** Additional class */
  className?: string;
}

function matchRoute(url: string, pattern: string): Record<string, string> | null {
  const urlParts = url.replace(/^\/+|\/+$/g, "").split("/");
  const patternParts = pattern.replace(/^\/+|\/+$/g, "").split("/");

  if (urlParts.length !== patternParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = urlParts[i];
    } else if (patternParts[i] !== urlParts[i]) {
      return null;
    }
  }
  return params;
}

export function useDeepLinkRouter(routes: DeepLinkRoute[], onUnmatched?: (url: string) => void) {
  const resolveLink = useCallback((url: string): DeepLinkResult => {
    // Strip base URL/protocol
    let path = url;
    try {
      const parsed = new URL(url);
      path = parsed.pathname;
    } catch {
      // Already a path
    }

    // Try matching against registered routes
    for (const route of routes) {
      const params = matchRoute(path, route.pattern);
      if (params) {
        return { matched: true, route, params, originalUrl: url };
      }
    }

    return { matched: false, originalUrl: url };
  }, [routes]);

  const handleLink = useCallback((url: string) => {
    const result = resolveLink(url);
    if (result.matched && result.route && result.params) {
      result.route.handler(result.params);
    } else if (onUnmatched) {
      onUnmatched(url);
    }
    return result;
  }, [resolveLink, onUnmatched]);

  return { resolveLink, handleLink };
}

/** Visual component for displaying/handling a deep link */
export const MobileDeepLinkHandler = memo(function MobileDeepLinkHandler({
  routes,
  onUnmatched,
  baseUrl = window.location.origin,
  enableClipboardDetection = false,
  className,
}: MobileDeepLinkHandlerProps) {
  const isMobile = useIsMobile();
  const { handleLink, resolveLink } = useDeepLinkRouter(routes, onUnmatched);
  const [clipboardLink, setClipboardLink] = useState<string | null>(null);
  const [clipboardResult, setClipboardResult] = useState<DeepLinkResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Listen for app link events (e.g., from push notifications)
  useEffect(() => {
    const handleAppLink = (e: CustomEvent<{ url: string }>) => {
      handleLink(e.detail.url);
    };

    window.addEventListener("app-deep-link" as string, handleAppLink as EventListener);
    return () => {
      window.removeEventListener("app-deep-link" as string, handleAppLink as EventListener);
    };
  }, [handleLink]);

  // Handle URL hash changes for in-app deep links
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#/")) {
        handleLink(hash.slice(1));
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [handleLink]);

  // Clipboard detection
  useEffect(() => {
    if (!enableClipboardDetection || !isMobile) return;

    const checkClipboard = async () => {
      try {
        if (!navigator.clipboard?.readText) return;
        const text = await navigator.clipboard.readText();
        if (text && (text.startsWith(baseUrl) || text.startsWith("/"))) {
          const result = resolveLink(text);
          if (result.matched) {
            setClipboardLink(text);
            setClipboardResult(result);
          }
        }
      } catch {
        // Clipboard access denied
      }
    };

    // Check on focus
    const handleFocus = () => checkClipboard();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [enableClipboardDetection, isMobile, baseUrl, resolveLink]);

  const handleCopyLink = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(`${baseUrl}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed
    }
  }, [baseUrl]);

  const handleDismissClipboard = useCallback(() => {
    setClipboardLink(null);
    setClipboardResult(null);
  }, []);

  return (
    <div className={cn("w-full", className)}>
      {/* Clipboard link banner */}
      {clipboardLink && clipboardResult?.matched && (
        <div className={cn(
          "rounded-xl border bg-primary/5 p-3 mb-3",
          "animate-in slide-in-from-top-2 fade-in duration-300"
        )}>
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Link2 className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">Link erkannt</p>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {clipboardResult.route?.label || clipboardLink}
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    handleLink(clipboardLink);
                    handleDismissClipboard();
                  }}
                  className={cn(
                    "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    isMobile && "min-h-[36px]"
                  )}
                >
                  <ExternalLink className="w-3 h-3" />
                  Öffnen
                </button>
                <button
                  onClick={handleDismissClipboard}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted",
                    isMobile && "min-h-[36px]"
                  )}
                >
                  Ignorieren
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate shareable link button */}
      <button
        onClick={() => handleCopyLink(window.location.pathname)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
          "hover:bg-muted active:bg-muted/80 transition-colors border",
          isMobile && "min-h-[44px] w-full"
        )}
        aria-label="Link kopieren"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-green-600 font-medium">Link kopiert!</span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4 text-muted-foreground" />
            <span>Link zu dieser Seite kopieren</span>
          </>
        )}
      </button>

      {/* Unmatched link info */}
      {!clipboardResult?.matched && clipboardLink && (
        <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="text-[10px] text-amber-700 dark:text-amber-400">
            Link konnte nicht zugeordnet werden
          </span>
        </div>
      )}
    </div>
  );
});
