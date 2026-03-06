/**
 * Settings Page-Splitting — Passkey section extracted from Settings.tsx
 */
import { useState, useEffect } from "react";
import { Fingerprint, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface PasskeySettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
  displayName: string;
}

export function PasskeySettings({ sectionRef, displayName }: PasskeySettingsProps) {
  const { user } = useAuth();
  const [passkeys, setPasskeys] = useState<Array<{ id: string; name: string; createdAt: string }>>([]);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);

  useEffect(() => {
    const supported = typeof window !== "undefined" &&
      !!window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function";
    setPasskeySupported(supported);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("immocontrol_passkeys");
      if (stored) setPasskeys(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const registerPasskey = async () => {
    if (!passkeySupported || !user) return;
    setPasskeyLoading(true);
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const userId = new TextEncoder().encode(user.id);
      /* FIX: Omit rp.id entirely — when absent the browser defaults to the current
         origin's effective domain, which is always valid. Manually setting rp.id to
         the hostname can fail on subdomains (e.g. custom app subdomains) if the
         browser rejects it as not a registrable domain suffix of the origin. */
      const excludeCredentials = passkeys.map(pk => ({
        id: Uint8Array.from(atob(pk.id.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)),
        type: "public-key" as const,
      }));
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "ImmoControl" },
          user: {
            id: userId,
            name: user.email || "user",
            displayName: displayName || user.email || "User",
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" },
          ],
          authenticatorSelection: {
            userVerification: "preferred",
            residentKey: "preferred",
          },
          excludeCredentials,
          timeout: 120000,
          attestation: "none",
        },
      }) as PublicKeyCredential | null;
      if (credential) {
        const newPasskey = {
          id: credential.id,
          name: `Passkey ${passkeys.length + 1}`,
          createdAt: new Date().toISOString(),
        };
        const updated = [...passkeys, newPasskey];
        setPasskeys(updated);
        localStorage.setItem("immocontrol_passkeys", JSON.stringify(updated));
        toast.success("Passkey erfolgreich registriert!");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        toast.error("Passkey-Registrierung abgebrochen");
      } else if (err instanceof Error && err.name === "InvalidStateError") {
        toast.error("Dieser Passkey ist bereits registriert");
      } else {
        toast.error(err instanceof Error ? err.message : "Passkey-Registrierung fehlgeschlagen");
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  const removePasskey = (id: string) => {
    const updated = passkeys.filter(p => p.id !== id);
    setPasskeys(updated);
    localStorage.setItem("immocontrol_passkeys", JSON.stringify(updated));
    toast.success("Passkey entfernt");
  };

  return (
    <div id="passkeys" ref={sectionRef} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:108ms] scroll-mt-20">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Fingerprint className="h-4 w-4 text-muted-foreground" /> Passkeys
      </h2>
      <p className="text-xs text-muted-foreground">
        Melde dich mit Fingerabdruck, Gesichtserkennung oder deinem Geräte-PIN an.
      </p>
      {!passkeySupported ? (
        <p className="text-xs text-loss flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" /> Dein Browser unterstützt keine Passkeys
        </p>
      ) : (
        <>
          {passkeys.length > 0 && (
            <div className="space-y-1.5">
              {passkeys.map((pk) => (
                <div key={pk.id} className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="h-3.5 w-3.5 text-primary" />
                    <div>
                      <p className="text-xs font-medium">{pk.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Erstellt: {new Date(pk.createdAt).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removePasskey(pk.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={registerPasskey} disabled={passkeyLoading}>
            <Fingerprint className="h-3.5 w-3.5" />
            {passkeyLoading ? "Registriere..." : "Passkey hinzufügen"}
          </Button>
        </>
      )}
    </div>
  );
}
