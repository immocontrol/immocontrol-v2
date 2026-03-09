/**
 * When biometric unlock is enabled, requires Face ID / Touch ID before showing the app.
 * Shown after login (session exists) so "beim Login" the user is asked for biometrics.
 */
import { useState, useCallback, useEffect } from "react";
import { Fingerprint } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  requestBiometricVerification,
  isBiometricUnlockEnabled,
  setBiometricVerifiedThisSession,
  isBiometricVerifiedThisSession,
} from "@/lib/biometric";

/** Re-read session verification on mount (e.g. new tab) */
function readVerified(): boolean {
  return isBiometricVerifiedThisSession();
}

interface BiometricGateProps {
  children: React.ReactNode;
}

export function BiometricGate({ children }: BiometricGateProps) {
  const { user } = useAuth();
  const [verified, setVerified] = useState(readVerified);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const biometricEnabled = isBiometricUnlockEnabled();

  /* Auto-trigger biometric prompt when gate is shown (e.g. after login / app open) */
  useEffect(() => {
    if (!user || !biometricEnabled || verified) return;
    const t = setTimeout(runVerification, 400);
    return () => clearTimeout(t);
  }, [user, biometricEnabled, verified, runVerification]);

  const runVerification = useCallback(async () => {
    setError(null);
    setChecking(true);
    try {
      const ok = await requestBiometricVerification();
      if (ok) {
        setBiometricVerifiedThisSession();
        setVerified(true);
      } else {
        setError("Entsperren fehlgeschlagen oder abgebrochen.");
      }
    } catch {
      setError("Biometrie ist nicht verfügbar.");
    } finally {
      setChecking(false);
    }
  }, []);

  if (!user || !biometricEnabled) {
    return <>{children}</>;
  }
  if (verified) {
    return <>{children}</>;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="biometric-gate-title"
      aria-describedby="biometric-gate-desc"
    >
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="rounded-full bg-primary/10 p-4">
          <Fingerprint className="h-12 w-12 text-primary" aria-hidden />
        </div>
        <h1 id="biometric-gate-title" className="text-lg font-semibold">
          App entsperren
        </h1>
        <p id="biometric-gate-desc" className="text-sm text-muted-foreground">
          Biometrie ist aktiviert. Bitte bestätige mit Face ID oder Touch ID.
        </p>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button
          onClick={runVerification}
          disabled={checking}
          className="gap-2"
          size="lg"
        >
          <Fingerprint className="h-5 w-5" />
          {checking ? "Wird geprüft…" : "Mit Face ID / Touch ID entsperren"}
        </Button>
      </div>
    </div>
  );
}
