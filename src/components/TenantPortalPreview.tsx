import { useState } from "react";
import { Eye, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  unit_label: string;
  monthly_rent: number;
  deposit: number;
  move_in_date: string | null;
  property_name: string;
  property_address: string;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

const TenantPortalPreview = ({ tenant }: { tenant: Tenant }) => {
  const [open, setOpen] = useState(false);

  const moveInDate = tenant.move_in_date ? new Date(tenant.move_in_date) : null;
  const monthsSinceMoveIn = moveInDate ? Math.floor((Date.now() - moveInDate.getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" title="Portal-Vorschau">
          <Eye className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4" /> Mieterportal-Vorschau
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {/* Simulated tenant view */}
          <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
            <p className="text-sm font-medium text-primary mb-1">Ansicht für:</p>
            <p className="text-lg font-bold">{tenant.first_name} {tenant.last_name}</p>
            <p className="text-xs text-muted-foreground">{tenant.email || "Keine E-Mail"}</p>
          </div>

          {/* Property */}
          <div className="gradient-card rounded-xl border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground mb-1">WOHNUNG</h3>
            <p className="font-semibold">{tenant.property_name}</p>
            <p className="text-sm text-muted-foreground">{tenant.property_address}</p>
            {tenant.unit_label && (
              <span className="text-xs bg-secondary px-2 py-0.5 rounded mt-1 inline-block">{tenant.unit_label}</span>
            )}
          </div>

          {/* Key figures */}
          <div className="grid grid-cols-2 gap-2">
            <div className="gradient-card rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Kaltmiete</div>
              <div className="text-lg font-bold">{formatCurrency(tenant.monthly_rent)}</div>
            </div>
            <div className="gradient-card rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Kaution</div>
              <div className="text-lg font-bold">{formatCurrency(tenant.deposit)}</div>
            </div>
            <div className="gradient-card rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Einzug</div>
              <div className="text-sm font-bold">
                {moveInDate ? moveInDate.toLocaleDateString("de-DE") : "–"}
              </div>
            </div>
            <div className="gradient-card rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Wohndauer</div>
              <div className="text-sm font-bold">{monthsSinceMoveIn > 0 ? `${monthsSinceMoveIn} Monate` : "–"}</div>
            </div>
          </div>

          {/* Tabs preview */}
          <div className="text-xs text-muted-foreground text-center py-2 bg-secondary/50 rounded-lg">
            Der Mieter sieht: Übersicht · Nachrichten · Dokumente · Zahlungen · Profil
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TenantPortalPreview;
