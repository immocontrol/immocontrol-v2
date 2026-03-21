/**
 * Settings Page-Splitting — 2FA/TOTP section extracted from Settings.tsx
 */
import { useState, useEffect, useRef } from "react";
import { Shield, Smartphone, Copy, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TOTP_FRIENDLY_NAME = "ImmoControl Authenticator";

/** Entfernt alle TOTP-Faktoren, die noch nicht verifiziert sind (inkl. abgebrochener Einrichtung). */
async function unenrollNonVerifiedTotpFactors(): Promise<void> {
  const { data: existingFactors, error: listErr } = await supabase.auth.mfa.listFactors();
  if (listErr) throw listErr;
  if (!existingFactors?.totp?.length) return;
  for (const factor of existingFactors.totp) {
    if (factor.status === "verified") continue;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) throw error;
  }
}

interface TwoFactorSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
}

export function TwoFactorSettings({ sectionRef }: TwoFactorSettingsProps) {
  const { user } = useAuth();
  const [totpSetupOpen, setTotpSetupOpen] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpQrUri, setTotpQrUri] = useState("");
  const [totpVerifyCode, setTotpVerifyCode] = useState("");
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupConfirmText, setBackupConfirmText] = useState("");
  const [backupCodesAcknowledged, setBackupCodesAcknowledged] = useState(false);
  /** Verhindert Cleanup direkt nach erfolgreicher Verifizierung (Dialog schließt, Faktor ist aber schon verified). */
  const justVerifiedRef = useRef(false);

  useEffect(() => {
    const checkTotp = async () => {
      try {
        const { data } = await supabase.auth.mfa.listFactors();
        if (data?.totp && data.totp.length > 0) {
          const activeFactor = data.totp.find(f => f.status === "verified");
          if (activeFactor) { setTotpEnabled(true); setTotpFactorId(activeFactor.id); }
        }
      } catch { /* MFA not available */ }
    };
    checkTotp();
  }, []);

  /** Dialog geschlossen ohne Abschluss → angelegten, unverifizierten Faktor serverseitig entfernen. */
  useEffect(() => {
    if (totpSetupOpen || totpEnabled || !totpFactorId || justVerifiedRef.current) return;
    let cancelled = false;
    const factorId = totpFactorId;
    void (async () => {
      try {
        const { error } = await supabase.auth.mfa.unenroll({ factorId });
        if (error) throw error;
        if (!cancelled) {
          setTotpFactorId(null);
          setTotpSecret("");
          setTotpQrUri("");
        }
      } catch (err: unknown) {
        if (!cancelled) {
          console.warn("2FA: Abbruch-Cleanup fehlgeschlagen", err);
          toast.error(
            err instanceof Error ? err.message : "2FA konnte nicht zurückgesetzt werden. Bitte Seite neu laden und erneut versuchen.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [totpSetupOpen, totpEnabled, totpFactorId]);

  const generateBackupCodes = (): string[] => {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const arr = new Uint8Array(4);
      crypto.getRandomValues(arr);
      const code = Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
      codes.push(code.slice(0, 4) + "-" + code.slice(4, 8));
    }
    return codes;
  };

  const startTotpSetup = async () => {
    justVerifiedRef.current = false;
    setTotpLoading(true);
    try {
      await unenrollNonVerifiedTotpFactors();
      let { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: TOTP_FRIENDLY_NAME });
      /* Doppelter friendly name (z. B. nach Race oder API-Abweichung): nochmal bereinigen und einmal wiederholen. */
      if (error?.message?.includes("already exists") || error?.message?.includes("friendly name")) {
        await unenrollNonVerifiedTotpFactors();
        const retry = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: TOTP_FRIENDLY_NAME });
        data = retry.data;
        error = retry.error;
      }
      if (error) throw error;
      if (data) { setTotpSecret(data.totp.secret); setTotpQrUri(data.totp.uri); setTotpFactorId(data.id); setTotpSetupOpen(true); }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "2FA-Einrichtung fehlgeschlagen");
    } finally { setTotpLoading(false); }
  };

  const verifyTotpSetup = async () => {
    if (!totpFactorId || totpVerifyCode.length !== 6) return;
    setTotpLoading(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactorId });
      if (challenge.error) throw challenge.error;
      const verify = await supabase.auth.mfa.verify({ factorId: totpFactorId, challengeId: challenge.data.id, code: totpVerifyCode });
      if (verify.error) throw verify.error;
      justVerifiedRef.current = true;
      setTotpEnabled(true); setTotpSetupOpen(false); setTotpVerifyCode("");
      const codes = generateBackupCodes();
      setBackupCodes(codes); setShowBackupCodes(true); setBackupCodesAcknowledged(false); setBackupConfirmText("");
      if (user) {
        localStorage.setItem(`immocontrol_2fa_enabled_${user.id}`, "true");
      }
      toast.success("2FA erfolgreich aktiviert!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Ungültiger Code");
    } finally { setTotpLoading(false); }
  };

  const disableTotp = async () => {
    if (!totpFactorId) return;
    justVerifiedRef.current = false;
    setTotpLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactorId });
      if (error) throw error;
      setTotpEnabled(false); setTotpFactorId(null);
      if (user) {
        localStorage.removeItem(`immocontrol_2fa_enabled_${user.id}`);
        localStorage.removeItem(`immocontrol_2fa_trusted_${user.id}`);
      }
      toast.success("2FA deaktiviert");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Deaktivieren");
    } finally { setTotpLoading(false); }
  };

  return (
    <>
      <div id="2fa" ref={sectionRef} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:105ms] scroll-mt-20">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" /> Zwei-Faktor-Authentifizierung (2FA)
        </h2>
        <p className="text-xs text-muted-foreground">
          Schütze dein Konto mit einer Authenticator-App (Google Authenticator, Authy, 1Password etc.)
        </p>
        {totpEnabled ? (
          <div className="flex items-center justify-between p-3 bg-profit/10 rounded-lg border border-profit/20">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-profit" />
              <div>
                <p className="text-sm font-medium text-profit">2FA ist aktiv</p>
                <p className="text-[10px] text-muted-foreground">Authenticator-App verifiziert</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-xs" onClick={disableTotp} disabled={totpLoading}>
              Deaktivieren
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={startTotpSetup} disabled={totpLoading}>
            <Smartphone className="h-3.5 w-3.5" /> 2FA einrichten
          </Button>
        )}
      </div>

      {/* TOTP Setup Dialog */}
      <Dialog
        open={totpSetupOpen}
        onOpenChange={(open) => {
          setTotpSetupOpen(open);
          if (!open) setTotpVerifyCode("");
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> 2FA einrichten
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Scanne den QR-Code mit deiner Authenticator-App oder gib den Schlüssel manuell ein.
            </p>
            {totpQrUri && (
              <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-lg">
                <QRCodeSVG value={totpQrUri} size={192} level="M" includeMargin />
              </div>
            )}
            {totpSecret && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Manueller Schlüssel</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-secondary p-2 rounded font-mono break-all select-all">{totpSecret}</code>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0"
                    onClick={() => { navigator.clipboard.writeText(totpSecret).then(() => toast.success("Schlüssel kopiert"), () => toast.error("Kopieren fehlgeschlagen")); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Bestätigungscode (6 Ziffern)</Label>
              <Input type="text" inputMode="numeric" maxLength={6} value={totpVerifyCode}
                onChange={(e) => setTotpVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000" className="h-10 text-center text-lg font-mono tracking-[0.5em]" />
            </div>
            <Button onClick={verifyTotpSetup} disabled={totpLoading || totpVerifyCode.length !== 6} className="w-full">
              {totpLoading ? "Verifiziere..." : "2FA aktivieren"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={showBackupCodes} onOpenChange={(open) => { if (backupCodesAcknowledged) setShowBackupCodes(open); }}>
        <DialogContent className="max-w-sm" onPointerDownOutside={(e) => { if (!backupCodesAcknowledged) e.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-profit" /> Backup-Codes
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gold/10 border border-gold/20 rounded-lg p-3">
              <p className="text-xs text-gold font-medium flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Speichere diese Codes sicher ab! Du siehst sie nur einmalig.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Falls du keinen Zugriff mehr auf deine Authenticator-App hast, kannst du dich mit einem dieser Codes einmalig anmelden.
            </p>
            <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/30 rounded-lg">
              {backupCodes.map((code, i) => (
                <div key={i} className="text-xs font-mono text-center py-1.5 px-2 bg-background rounded border border-border">{code}</div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 gap-1.5"
                onClick={() => {
                  const blob = new Blob([`ImmoControl 2FA Backup-Codes\n${backupCodes.join("\n")}\n\nSicher aufbewahren – nur einmal sichtbar.`], { type: "text/plain" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `immocontrol-2fa-backup-${new Date().toISOString().slice(0, 10)}.txt`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                  toast.success("Backup-Codes heruntergeladen");
                }}>
                <Copy className="h-3.5 w-3.5" /> Als .txt speichern
              </Button>
              <Button variant="outline" size="sm" className="flex-1 gap-1.5"
                onClick={() => { navigator.clipboard.writeText(backupCodes.join("\n")).then(() => toast.success("Backup-Codes kopiert!"), () => toast.error("Kopieren fehlgeschlagen")); }}>
                <Copy className="h-3.5 w-3.5" /> Kopieren
              </Button>
            </div>
            <div className="space-y-1.5 border-t border-border pt-3">
              <Label className="text-xs text-muted-foreground">Tippe "Bestätigt" um zu bestätigen</Label>
              <Input value={backupConfirmText} onChange={(e) => setBackupConfirmText(e.target.value)} placeholder="Bestätigt" className="h-9 text-sm" />
            </div>
            <Button onClick={() => { setBackupCodesAcknowledged(true); setShowBackupCodes(false); toast.success("Backup-Codes bestätigt!"); }}
              disabled={backupConfirmText !== "Bestätigt"} className="w-full">
              Codes gespeichert — Schließen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
