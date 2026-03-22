/**
 * Settings Page-Splitting — Biometric Authentication section extracted from Settings.tsx
 * Nutzt Face ID / Touch ID (Plattform-Authenticator), nicht Passkey/QR/Sicherheitsschlüssel.
 * Bei Aktivierung wird automatisch eine Face-ID/Touch-ID-Credential angelegt.
 */
import { useState, useEffect } from "react";
import { Fingerprint, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SettingsToggleRow } from "@/components/ui/settings-toggle-row";
import { registerBiometricCredential, isBiometricSupported } from "@/lib/biometric";

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
  const [registering, setRegistering] = useState(false);

  const [isNativeIos, setIsNativeIos] = useState(false);
  useEffect(() => {
    const check = async () => {
      try {
        const { isNativeIos: isIos } = await import("@/integrations/nativeBiometric");
        const nativeIos = await isIos();
        setIsNativeIos(nativeIos);
        const supported = await isBiometricSupported();
        setBiometricSupported(supported);
      } catch {
        setBiometricSupported(false);
      }
    };
    check();
  }, []);

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      if (!biometricSupported) {
        toast.error("Dein Gerät unterstützt keine biometrische Authentifizierung (Face ID / Touch ID)");
        return;
      }
      if (!user) {
        toast.error("Bitte zuerst anmelden");
        return;
      }
      setRegistering(true);
      try {
        const ok = await registerBiometricCredential(
          user.id,
          user.email ?? "",
          displayName || user.email || "User",
        );
        if (ok) {
          setBiometricEnabled(true);
          localStorage.setItem("immocontrol_biometric_enabled", "true");
          toast.success("Face ID / Touch ID aktiviert! Beim nächsten App-Start wird biometrisch entsperrt.");
        } else {
          toast.error("Face ID / Touch ID konnte nicht eingerichtet werden. Bitte erneut versuchen.");
        }
      } catch {
        toast.error("Fehler beim Einrichten von Face ID / Touch ID");
      } finally {
        setRegistering(false);
      }
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
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1 p-3 rounded-lg bg-secondary/30 border border-border">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {isNativeIos
              ? "Dein Gerät unterstützt keine biometrische Authentifizierung. Stelle sicher, dass Face ID in den iOS-Einstellungen aktiviert ist."
              : "Face ID / Touch ID ist nur in der nativen iPhone-App verfügbar — nicht im Browser."}
          </p>
        </div>
      ) : (
        <SettingsToggleRow
          label="Face ID / Touch ID für Login"
          description={
            registering
              ? "Face ID wird eingerichtet…"
              : biometricEnabled
                ? "Face ID / Touch ID beim App-Start"
                : "Aktiviere — Face ID wird einmalig eingerichtet"
          }
          checked={biometricEnabled}
          onCheckedChange={handleToggle}
          disabled={registering}
          ariaLabel="Face ID / Touch ID ein oder aus"
        />
      )}
    </div>
  );
}
