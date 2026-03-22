/**
 * MOB2-15: Biometrische Schnellaktionen
 * After biometric authentication, quick access to frequent actions.
 * Nur in nativer iOS-App — verwendet isBiometricSupported (kein WebAuthn im Browser).
 */
import { memo, useState, useCallback, useEffect } from "react";
import { Fingerprint, Building2, FileText, Euro, Users, Shield, Lock, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";
import { isBiometricSupported } from "@/lib/biometric";
import { verifyWithNativeBiometric } from "@/integrations/nativeBiometric";

interface QuickActionItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  onClick: () => void;
  /** Whether this action requires biometric auth */
  requiresAuth?: boolean;
}

interface MobileBiometricQuickActionsProps {
  /** Actions to show after authentication */
  actions?: QuickActionItem[];
  /** Whether biometric auth is available on this device */
  biometricAvailable?: boolean;
  /** Called when user successfully authenticates */
  onAuthenticated?: () => void;
  className?: string;
}

const DEFAULT_ACTIONS: QuickActionItem[] = [
  { id: "portfolio", label: "Portfolio-Übersicht", description: "Alle Immobilien auf einen Blick", icon: <Building2 className="h-5 w-5" />, onClick: () => {}, requiresAuth: false },
  { id: "documents", label: "Vertrauliche Dokumente", description: "Geschützte Unterlagen öffnen", icon: <FileText className="h-5 w-5" />, onClick: () => {}, requiresAuth: true },
  { id: "finances", label: "Finanzdaten", description: "Konten und Transaktionen", icon: <Euro className="h-5 w-5" />, onClick: () => {}, requiresAuth: true },
  { id: "tenants", label: "Mieterdaten", description: "Persönliche Mieterdaten einsehen", icon: <Users className="h-5 w-5" />, onClick: () => {}, requiresAuth: true },
];


export const MobileBiometricQuickActions = memo(function MobileBiometricQuickActions({
  actions = DEFAULT_ACTIONS, biometricAvailable: biometricProp, onAuthenticated, className,
}: MobileBiometricQuickActionsProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [authenticated, setAuthenticated] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState<boolean | null>(biometricProp ?? null);

  // Check availability on mount (nur native iOS)
  useEffect(() => {
    if (biometricProp !== undefined) return;
    isBiometricSupported().then(setBiometricSupported).catch(() => setBiometricSupported(false));
  }, [biometricProp]);

  const handleAuth = useCallback(async (): Promise<boolean> => {
    setAuthenticating(true);
    haptic.medium();

    const success = await verifyWithNativeBiometric("Schnellaktionen entsperren");

    if (success) {
      haptic.success();
      setAuthenticated(true);
      onAuthenticated?.();
    } else {
      haptic.error();
    }
    setAuthenticating(false);
    return success;
  }, [haptic, onAuthenticated]);

  const handleAction = useCallback(async (action: QuickActionItem) => {
    if (action.requiresAuth && !authenticated) {
      const success = await handleAuth();
      if (!success) return; // Don't execute action if auth failed
      haptic.tap();
      action.onClick();
    } else {
      haptic.tap();
      action.onClick();
    }
  }, [authenticated, handleAuth, haptic]);

  if (!isMobile) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Auth status header */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-secondary/30">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
          authenticated
            ? "bg-profit/10 text-profit"
            : "bg-primary/10 text-primary",
        )}>
          {authenticated ? <Shield className="h-5 w-5" /> : <Fingerprint className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {authenticated ? "Verifiziert" : "Biometrische Authentifizierung"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {authenticated
              ? "Schnellzugriff auf geschützte Bereiche"
              : biometricSupported === false
                ? "Nicht verfügbar auf diesem Gerät"
                : "Tippe zum Entsperren geschützter Aktionen"}
          </p>
        </div>
        {!authenticated && biometricSupported !== false && (
          <button
            onClick={handleAuth}
            disabled={authenticating}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95",
              authenticating
                ? "bg-primary/20 text-primary animate-pulse"
                : "bg-primary text-primary-foreground",
            )}
          >
            {authenticating ? "..." : "Entsperren"}
          </button>
        )}
      </div>

      {/* Quick actions */}
      <div className="space-y-1">
        {actions.map((action) => {
          const isLocked = action.requiresAuth && !authenticated;
          return (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              disabled={isLocked && biometricSupported === false}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-border transition-all active:scale-[0.98]",
                isLocked ? "opacity-60" : "hover:bg-secondary/50",
              )}
            >
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                isLocked ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-primary",
              )}>
                {isLocked ? <Lock className="h-4 w-4" /> : action.icon}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">{action.label}</p>
                {action.description && (
                  <p className="text-[10px] text-muted-foreground truncate">{action.description}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
});
