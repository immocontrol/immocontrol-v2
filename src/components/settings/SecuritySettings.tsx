/**
 * #1: Page-Splitting — Security section (2FA, Passkeys, Biometric) extracted from Settings.tsx
 */
import { Shield, Fingerprint, Copy, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsToggleRow } from "@/components/ui/settings-toggle-row";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";

interface SecuritySettingsProps {
  totpEnabled: boolean;
  totpLoading: boolean;
  totpSetupOpen: boolean;
  totpQrUri: string;
  totpSecret: string;
  totpVerifyCode: string;
  backupCodes: string[];
  showBackupCodes: boolean;
  passkeySupported: boolean;
  passkeys: Array<{ id: string; name: string; createdAt: string }>;
  passkeyLoading: boolean;
  biometricSupported: boolean;
  biometricEnabled: boolean;
  onStartTotpSetup: () => void;
  onDisableTotp: () => void;
  onVerifyTotp: () => void;
  onTotpCodeChange: (code: string) => void;
  onTotpSetupOpenChange: (open: boolean) => void;
  onShowBackupCodesChange: (show: boolean) => void;
  onRegisterPasskey: () => void;
  onRemovePasskey: (id: string) => void;
  onBiometricToggle: (enabled: boolean) => void;
}

export function SecuritySettings({
  totpEnabled, totpLoading, totpSetupOpen, totpQrUri, totpSecret,
  totpVerifyCode, backupCodes, showBackupCodes,
  passkeySupported, passkeys, passkeyLoading,
  biometricSupported, biometricEnabled,
  onStartTotpSetup, onDisableTotp, onVerifyTotp,
  onTotpCodeChange, onTotpSetupOpenChange, onShowBackupCodesChange,
  onRegisterPasskey, onRemovePasskey, onBiometricToggle,
}: SecuritySettingsProps) {
  const [copied, setCopied] = useState(false);

  const copySecret = () => {
    navigator.clipboard.writeText(totpSecret).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Secret kopiert!");
      },
      () => toast.error("Kopieren fehlgeschlagen")
    );
  };

  return (
    <>
      {/* 2FA Section */}
      <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in scroll-mt-20">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" /> Zwei-Faktor-Authentifizierung
        </h2>
        {totpEnabled ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-profit">
              <Check className="h-4 w-4" /> 2FA ist aktiviert
            </div>
            <Button variant="outline" size="sm" onClick={onDisableTotp} disabled={totpLoading}>
              2FA deaktivieren
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={onStartTotpSetup} disabled={totpLoading}>
            {totpLoading ? "Wird eingerichtet..." : "2FA aktivieren"}
          </Button>
        )}
      </div>

      {/* TOTP Setup Dialog */}
      <Dialog open={totpSetupOpen} onOpenChange={onTotpSetupOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>2FA einrichten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {totpQrUri && (
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCodeSVG value={totpQrUri} size={180} />
              </div>
            )}
            {totpSecret && (
              <div className="space-y-1">
                <Label className="text-xs">Oder manuell eingeben:</Label>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-secondary p-2 rounded flex-1 break-all">{totpSecret}</code>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copySecret}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Bestätigungscode</Label>
              <Input
                value={totpVerifyCode}
                onChange={(e) => onTotpCodeChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-stelliger Code"
                className="h-9 text-sm text-center tracking-widest"
                maxLength={6}
              />
            </div>
            <Button className="w-full" onClick={onVerifyTotp} disabled={totpVerifyCode.length !== 6 || totpLoading}>
              Bestätigen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={showBackupCodes} onOpenChange={onShowBackupCodesChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Backup-Codes</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Bewahre diese Codes sicher auf. Jeder Code kann nur einmal verwendet werden.</p>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, i) => (
                <code key={i} className="text-xs bg-secondary p-2 rounded text-center font-mono">{code}</code>
              ))}
            </div>
            <Button className="w-full" onClick={() => onShowBackupCodesChange(false)}>
              Verstanden
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Passkeys Section */}
      {passkeySupported && (
        <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in scroll-mt-20">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-muted-foreground" /> Passkeys
          </h2>
          {passkeys.length > 0 && (
            <div className="space-y-2">
              {passkeys.map((pk) => (
                <div key={pk.id} className="flex items-center justify-between text-xs p-2 bg-secondary/30 rounded">
                  <span>{pk.name}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-loss" onClick={() => onRemovePasskey(pk.id)}>
                    Entfernen
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button size="sm" onClick={onRegisterPasskey} disabled={passkeyLoading}>
            {passkeyLoading ? "Wird registriert..." : "Passkey hinzufügen"}
          </Button>
        </div>
      )}

      {/* Biometric Section */}
      {biometricSupported && (
        <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in scroll-mt-20">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-muted-foreground" /> Biometrische Authentifizierung
          </h2>
          <SettingsToggleRow
            label="Face ID / Touch ID / Fingerabdruck"
            description="Schneller Login mit biometrischer Authentifizierung"
            checked={biometricEnabled}
            onCheckedChange={onBiometricToggle}
            ariaLabel="Biometrie ein oder aus"
          />
        </div>
      )}
    </>
  );
}
