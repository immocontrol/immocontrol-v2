import { useState, useCallback } from "react";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";

export function RentIncreaseLetter() {
  const [landlord, setLandlord] = useState({ name: "", address: "" });
  const [tenantName, setTenantName] = useState("");
  const [tenantAddress, setTenantAddress] = useState("");
  const [currentRent, setCurrentRent] = useState(0);
  const [newRent, setNewRent] = useState(0);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("Anpassung an die ortsübliche Vergleichsmiete gemäß § 558 BGB");
  const [mietspiegelRef, setMietspiegelRef] = useState("");

  const increase = currentRent > 0 ? ((newRent - currentRent) / currentRent * 100) : 0;
  const isOver20 = increase > 20;
  const isOver15 = increase > 15;

  const exportPDF = useCallback(() => {
    if (!tenantName || !currentRent || !newRent || !effectiveDate) {
      toast.error("Bitte alle Pflichtfelder ausfüllen");
      return;
    }

    const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<title>Mieterhöhungsverlangen</title>
<style>
body{font-family:system-ui,sans-serif;padding:40px 60px;color:#222;max-width:700px;margin:0 auto;font-size:13px;line-height:1.6}
h1{font-size:18px;margin-bottom:24px}
.header{margin-bottom:30px}
.address{margin-bottom:20px;line-height:1.4}
.date{text-align:right;margin-bottom:24px}
.highlight{background:#f0f9f4;padding:12px;border-radius:6px;margin:16px 0;border-left:3px solid #2a9d6e}
.warning{background:#fff3e0;padding:12px;border-radius:6px;margin:16px 0;border-left:3px solid #f5a623}
.sig{margin-top:60px}
.footer{margin-top:40px;font-size:10px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:12px}
</style></head><body>
<div class="header">
<div class="address">
<strong>${landlord.name || "[Vermieter Name]"}</strong><br>
${landlord.address || "[Adresse]"}
</div>
<div class="address">
${tenantName}<br>
${tenantAddress || "[Mieteradresse]"}
</div>
</div>

<div class="date">${today}</div>

<h1>Mieterhöhungsverlangen gemäß § 558 BGB</h1>

<p>Sehr geehrte/r ${tenantName},</p>

<p>hiermit erlaube ich mir, Sie um Ihre Zustimmung zur Erhöhung der Nettokaltmiete zu bitten.</p>

<div class="highlight">
<strong>Aktuelle Miete:</strong> ${formatCurrency(currentRent)} / Monat<br>
<strong>Neue Miete:</strong> ${formatCurrency(newRent)} / Monat<br>
<strong>Erhöhung:</strong> ${formatCurrency(newRent - currentRent)} (${increase.toFixed(1)}%)<br>
<strong>Wirksam ab:</strong> ${new Date(effectiveDate).toLocaleDateString("de-DE")}
</div>

<p><strong>Begründung:</strong> ${reason}</p>

${mietspiegelRef ? `<p><strong>Referenz Mietspiegel:</strong> ${mietspiegelRef}</p>` : ""}

${isOver20 ? `<div class="warning"><strong>⚠ Hinweis:</strong> Die Erhöhung überschreitet die Kappungsgrenze von 20% (§ 558 Abs. 3 BGB). In vielen Ballungsräumen gilt eine Grenze von 15%. Bitte prüfen Sie die lokale Regelung.</div>` : ""}

<p>Gemäß § 558b BGB bitte ich Sie, Ihre Zustimmung innerhalb von zwei Monaten nach Zugang dieses Schreibens zu erklären. Die erhöhte Miete wird ab dem dritten Kalendermonat nach Zugang dieses Verlangens fällig.</p>

<p>Für Rückfragen stehe ich Ihnen gerne zur Verfügung.</p>

<p>Mit freundlichen Grüßen</p>

<div class="sig">
<br><br>
_________________________________<br>
${landlord.name || "[Vermieter]"}, ${today}
</div>

<div class="footer">Erstellt mit ImmoControl · Mieterhöhungsverlangen nach § 558 BGB</div>
</body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
    toast.success("Mieterhöhungsschreiben erstellt!");
  }, [landlord, tenantName, tenantAddress, currentRent, newRent, effectiveDate, reason, mietspiegelRef, increase, isOver20]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileText className="h-3.5 w-3.5" /> Mieterhöhung
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Mieterhöhungsschreiben
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Vermieter Name</Label>
              <Input value={landlord.name} onChange={e => setLandlord({...landlord, name: e.target.value})} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vermieter Adresse</Label>
              <Input value={landlord.address} onChange={e => setLandlord({...landlord, address: e.target.value})} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mieter Name *</Label>
              <Input value={tenantName} onChange={e => setTenantName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mieter Adresse</Label>
              <Input value={tenantAddress} onChange={e => setTenantAddress(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Aktuelle Miete € *</Label>
              <Input type="number" value={currentRent || ""} onChange={e => setCurrentRent(Number(e.target.value))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Neue Miete € *</Label>
              <Input type="number" value={newRent || ""} onChange={e => setNewRent(Number(e.target.value))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Wirksam ab *</Label>
              <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          {/* Preview */}
          {currentRent > 0 && newRent > 0 && (
            <div className={`rounded-lg p-3 text-xs space-y-1 ${isOver20 ? "bg-loss/10 border border-loss/20" : isOver15 ? "bg-gold/10 border border-gold/20" : "bg-profit/10 border border-profit/20"}`}>
              <div className="flex justify-between">
                <span>Erhöhung:</span>
                <span className="font-bold">{formatCurrency(newRent - currentRent)} ({increase.toFixed(1)}%)</span>
              </div>
              {isOver20 && <p className="text-loss font-medium">⚠ Überschreitet 20% Kappungsgrenze!</p>}
              {isOver15 && !isOver20 && <p className="text-gold font-medium">⚠ Überschreitet 15% Grenze (Ballungsräume)</p>}
              {!isOver15 && <p className="text-profit font-medium">✓ Im Rahmen der Kappungsgrenze</p>}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Begründung</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} className="text-xs min-h-[60px]" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Mietspiegel-Referenz (optional)</Label>
            <Input value={mietspiegelRef} onChange={e => setMietspiegelRef(e.target.value)} className="h-9 text-sm" placeholder="z.B. Mietspiegel München 2024, Kategorie III" />
          </div>

          <Button onClick={exportPDF} className="w-full gap-1.5">
            <Download className="h-4 w-4" /> Schreiben als PDF drucken
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
