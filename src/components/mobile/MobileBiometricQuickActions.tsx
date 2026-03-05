/**
 * MOB2-15: Biometrische Schnellaktionen
 * After biometric authentication, quick access to frequent actions.
 * Uses Web Authentication API (WebAuthn) for biometric verification.
 */
import { memo, useState, useCallback } from "react";
import { Fingerprint, Building2, FileText, Euro, Users, Shield, Lock, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

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

/** Check if biometric authentication is available */
async function checkBiometricAvailability(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) return false;
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch { return false; }
}

/** Trigger biometric authentication */
async function requestBiometricAuth(): Promise<boolean> {
  try {
    // Use a simple challenge for biometric verification
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "ImmoControl", id: window.location.hostname },
        user: {
          id: new Uint8Array(16),
          name: "user@immocontrol.de",
          displayName: "ImmoControl User",
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
      },
    });
    return !!credential;
  } catch {
    return false;
  }
}

export const MobileBiometricQuickActions = memo(function MobileBiometricQuickActions({
  actions = DEFAULT_ACTIONS, biometricAvailable: biometricProp, onAuthenticated, className,
}: MobileBiometricQuickActionsProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [authenticated, setAuthenticated] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState<boolean | null>(biometricProp ?? null);

  // Check availability on first render
  useState(() => {
    if (biometricProp !== undefined) return;
    checkBiometricAvailability().then(setBiometricSupported);
  });

  const handleAuth = useCallback(async () => {
    setAuthenticating(true);
    haptic.medium();

    const success = await requestBiometricAuth();

    if (success) {
      haptic.success();
      setAuthenticated(true);
      onAuthenticated?.();
    } else {
      haptic.error();
    }
    setAuthenticating(false);
  }, [haptic, onAuthenticated]);

  const handleAction = useCallback((action: QuickActionItem) => {
    if (action.requiresAuth && !authenticated) {
      handleAuth().then(() => {
        haptic.tap();
        action.onClick();
      });
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
