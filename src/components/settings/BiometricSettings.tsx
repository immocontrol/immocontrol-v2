/**
 * Settings Page-Splitting — Biometric Authentication section extracted from Settings.tsx
 */
import { useState, useEffect } from "react";
import { Fingerprint, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface BiometricSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
  displayName: string;
}

export function BiometricSettings({ sectionRef, displayName }: BiometricSettingsProps) {
  const { user } = useAuth();
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

  /* FIX: Biometric toggle is a preference-only switch — no WebAuthn credential creation.
     WebAuthn credential creation belongs in PasskeySettings. Biometric just stores
     the user's preference to use platform biometrics (Face ID / Touch ID) at login. */
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
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" /> Dein Gerät unterstützt keine biometrische Authentifizierung
        </p>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={biometricEnabled}
          onClick={() => handleToggle(!biometricEnabled)}
          className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300 ${
            biometricEnabled
              ? "border-primary/40 bg-gradient-to-r from-primary/5 to-primary/10 shadow-sm"
              : "border-border bg-secondary/20 hover:border-muted-foreground/30 hover:bg-secondary/40"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
              biometricEnabled ? "bg-primary/15 text-primary scale-105" : "bg-secondary text-muted-foreground"
            }`}>
              <Fingerprint className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">{biometricEnabled ? "Aktiviert" : "Deaktiviert"}</p>
              <p className="text-[10px] text-muted-foreground">
                {biometricEnabled ? "Face ID / Touch ID wird für den Login verwendet" : "Aktiviere biometrischen Login"}
              </p>
            </div>
          </div>
          <div className={`relative w-12 h-7 rounded-full transition-all duration-300 ${biometricEnabled ? "bg-primary" : "bg-muted"}`}>
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${biometricEnabled ? "left-[22px]" : "left-0.5"}`} />
          </div>
        </button>
      )}
    </div>
  );
}
