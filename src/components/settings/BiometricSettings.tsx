/**
 * Settings Page-Splitting — Biometric Authentication section extracted from Settings.tsx
 * Einheitliches Toggle-Zeilen-Layout wie alle anderen Einstellungen.
 */
import { useState, useEffect } from "react";
import { Fingerprint, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

interface BiometricSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
  displayName: string;
}

export function BiometricSettings({ sectionRef }: BiometricSettingsProps) {
  const [biometricEnabled, setBiometricEnabled] = useState(() => {
    try { return localStorage.getItem("immocontrol_biometric_enabled") === "true"; } catch { return false; }
  });
  const [biometricSupported, setBiometricSupported] = useState(false);

  useEffect(() => {
    const check = async () => {
      const supported = typeof window !== "undefined" &&
        !!window.PublicKeyCredential &&
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function";
      if (supported && window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
        try {
          const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setBiometricSupported(available);
        } catch { setBiometricSupported(false); }
      }
    };
    check();
  }, []);

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      if (!biometricSupported) {
        toast.error("Dein Gerät unterstützt keine biometrische Authentifizierung");
        return;
      }
      setBiometricEnabled(true);
      localStorage.setItem("immocontrol_biometric_enabled", "true");
      toast.success("Biometrische Authentifizierung aktiviert!");
    } else {
      setBiometricEnabled(false);
      localStorage.removeItem("immocontrol_biometric_enabled");
      localStorage.removeItem("immocontrol_biometric_credential_id");
      toast.success("Biometrische Authentifizierung deaktiviert");
    }
  };

  return (
    <div id="biometric" ref={sectionRef} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:109ms] scroll-mt-20">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Fingerprint className="h-4 w-4 text-muted-foreground" /> Biometrische Authentifizierung
      </h2>
      <p className="text-xs text-muted-foreground">
        Nutze Face ID, Touch ID oder deinen Fingerabdruck für schnelleren Login.
      </p>
      {!biometricSupported ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1 p-3 rounded-lg bg-secondary/30 border border-border">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Dein Gerät unterstützt keine biometrische Authentifizierung
        </p>
      ) : (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
          <div className="min-w-0">
            <p className="text-xs font-medium">Biometrie für Login nutzen</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {biometricEnabled ? "Face ID / Touch ID wird für den Login verwendet" : "Aktiviere biometrischen Login"}
            </p>
          </div>
          <Switch checked={biometricEnabled} onCheckedChange={handleToggle} aria-label="Biometrie ein oder aus" />
        </div>
      )}
    </div>
  );
}
