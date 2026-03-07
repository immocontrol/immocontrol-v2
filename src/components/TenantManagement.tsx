import { useState, useRef } from "react";
import { Users, Plus, Mail, Calendar, Home, Trash2, Edit2, UserPlus, Send, Copy, Check, Loader2, Eye } from "lucide-react";
import AddTenantDialog from "@/components/AddTenantDialog";
import { isValidEmail } from "@/lib/validation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import TenantPortalPreview from "@/components/TenantPortalPreview";
import { formatCurrency } from "@/lib/formatters";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { CallButton } from "@/components/CallButton";

interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  unit_label: string;
  move_in_date: string | null;
  move_out_date: string | null;
  monthly_rent: number;
  deposit: number;
  is_active: boolean;
  invitation_sent_at: string | null;
  user_id: string | null;
}

const TenantManagement = ({ propertyId, propertyName, propertyAddress, onTenantsChanged }: { propertyId: string; propertyName?: string; propertyAddress?: string; onTenantsChanged?: () => void }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    unit_label: "", move_in_date: "", monthly_rent: 0, deposit: 0,
  });
  const qc = useQueryClient();
  const lastDeletedTenantIdRef = useRef<string | null>(null);

  const { data: tenants = [] } = useQuery({
    queryKey: queryKeys.tenants.byProperty(propertyId),
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("*")
        .eq("property_id", propertyId)
        .order("is_active", { ascending: false });
      return (data || []) as Tenant[];
    },
  });

  // Synergy 19: Fetch open ticket count per tenant
  const { data: tenantTicketCounts = {} } = useQuery({
    queryKey: [...queryKeys.tenants.byProperty(propertyId), "ticket-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("tenant_id, status")
        .eq("property_id", propertyId)
        .in("status", ["open", "in_progress"]);
      const counts: Record<string, number> = {};
      (data || []).forEach(t => { counts[t.tenant_id] = (counts[t.tenant_id] || 0) + 1; });
      return counts;
    },
  });

  // Synergy 20: Fetch payment status per tenant
  const { data: tenantPaymentStatus = {} } = useQuery({
    queryKey: [...queryKeys.tenants.byProperty(propertyId), "payment-status"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rent_payments")
        .select("tenant_id, status")
        .eq("property_id", propertyId)
        .in("status", ["pending", "overdue"]);
      const statuses: Record<string, { pending: number; overdue: number }> = {};
      (data || []).forEach(p => {
        if (!statuses[p.tenant_id]) statuses[p.tenant_id] = { pending: 0, overdue: 0 };
        if (p.status === "overdue") statuses[p.tenant_id].overdue++;
        else statuses[p.tenant_id].pending++;
      });
      return statuses;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.tenants.byProperty(propertyId) });
    qc.invalidateQueries({ queryKey: queryKeys.messages.tenantList(propertyId) });
    onTenantsChanged?.();
  };

  const resetForm = () => {
    setForm({ first_name: "", last_name: "", email: "", phone: "", unit_label: "", move_in_date: "", monthly_rent: 0, deposit: 0 });
    setEditTenant(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !form.first_name.trim() || !form.last_name.trim()) throw new Error("Invalid");
      if (form.email && !isValidEmail(form.email)) throw new Error("Bitte eine gültige E-Mail-Adresse eingeben");
      if (editTenant) {
        const { error } = await supabase.from("tenants").update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email || null,
          phone: form.phone || null,
          unit_label: form.unit_label,
          move_in_date: form.move_in_date || null,
          monthly_rent: form.monthly_rent,
          deposit: form.deposit,
        }).eq("id", editTenant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tenants").insert({
          property_id: propertyId,
          landlord_id: user.id,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email || null,
          phone: form.phone || null,
          unit_label: form.unit_label,
          move_in_date: form.move_in_date || null,
          monthly_rent: form.monthly_rent,
          deposit: form.deposit,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editTenant ? "Mieter aktualisiert" : "Mieter angelegt");
      resetForm();
      setOpen(false);
      invalidate();
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "tenants.insert/update", showToast: false });
      toastErrorWithRetry("Fehler beim Speichern", () => saveMutation.mutate());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tenants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mieter entfernt"); invalidate(); },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "tenants.delete", showToast: false });
      toastErrorWithRetry("Fehler beim Entfernen", () => { if (lastDeletedTenantIdRef.current) deleteMutation.mutate(lastDeletedTenantIdRef.current); });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (tenant: Tenant) => {
      await supabase.from("tenants").update({
        is_active: !tenant.is_active,
        move_out_date: !tenant.is_active ? null : new Date().toISOString().split("T")[0],
      }).eq("id", tenant.id);
    },
    onSuccess: invalidate,
  });

  const [inviting, setInviting] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [inviteDialog, setInviteDialog] = useState<{ url: string; name: string; email: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleInvite = async (tenant: Tenant) => {
    if (!tenant.email) {
      toast.error("Mieter hat keine E-Mail-Adresse");
      return;
    }
    setInviting(tenant.id);
    try {
      const { data, error } = await supabase.functions.invoke("invite-tenant", {
        body: { tenant_id: tenant.id, redirect_origin: window.location.origin },
      });
      if (error) { toast.error("Fehler beim Einladen"); return; }
      if (data?.success && data?.invite_url) {
        setInviteDialog({
          url: data.invite_url,
          name: data.tenant_name || `${tenant.first_name} ${tenant.last_name}`,
          email: data.tenant_email || tenant.email,
        });
        setLinkCopied(false);
        invalidate();
        if (data.email_sent) {
          toast.success(`Einladungs-E-Mail an ${tenant.email} gesendet`);
        } else {
          toast.success("Einladungslink erstellt – teile ihn per E-Mail oder WhatsApp");
        }
      } else {
        toast.error(data?.error || "Fehler beim Erstellen der Einladung");
      }
    } catch {
      toast.error("Fehler beim Einladen");
    } finally {
      setInviting(null);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteDialog) return;
    try {
      await navigator.clipboard.writeText(inviteDialog.url);
      setLinkCopied(true);
      toast.success("Link kopiert!");
      setTimeout(() => setLinkCopied(false), 3000);
    } catch {
      toast.error("Kopieren fehlgeschlagen — kein Clipboard-Zugriff");
    }
  };

  const sendViaMail = () => {
    if (!inviteDialog) return;
    const subject = encodeURIComponent("Einladung zum Mieterportal");
    const body = encodeURIComponent(
      `Hallo ${inviteDialog.name},\n\ndu wurdest zum Mieterportal eingeladen. Klicke auf den folgenden Link, um dich anzumelden:\n\n${inviteDialog.url}\n\nViele Grüße`
    );
    window.open(`mailto:${inviteDialog.email}?subject=${subject}&body=${body}`, "_blank");
  };

  const openEdit = (t: Tenant) => {
    setEditTenant(t);
    setForm({
      first_name: t.first_name, last_name: t.last_name,
      email: t.email || "", phone: t.phone || "",
      unit_label: t.unit_label, move_in_date: t.move_in_date || "",
      monthly_rent: t.monthly_rent, deposit: t.deposit,
    });
    setOpen(true);
  };

  // Improvement 7: Total active rent + deposit
  const activeTenants = tenants.filter(t => t.is_active);
  const totalActiveRent = activeTenants.reduce((s, t) => s + (t.monthly_rent || 0), 0);
  const totalDeposit = activeTenants.reduce((s, t) => s + (t.deposit || 0), 0);

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" /> Mieter ({activeTenants.length})
          {/* Improvement 7: Show total rent */}
          {totalActiveRent > 0 && (
            <span className="text-[10px] bg-profit/10 text-profit px-1.5 py-0.5 rounded-full font-medium">
              {formatCurrency(totalActiveRent)}/M
            </span>
          )}
          {totalDeposit > 0 && (
            <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-full text-muted-foreground font-medium">
              Kaution: {formatCurrency(totalDeposit)}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <AddTenantDialog propertyId={propertyId} propertyName={propertyName} onCreated={invalidate} />
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5 hidden">
              <UserPlus className="h-3.5 w-3.5" /> Mieter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editTenant ? "Mieter bearbeiten" : "Neuen Mieter anlegen"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Vorname *</Label>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nachname *</Label>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">E-Mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefon</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Einheit</Label>
                <Input value={form.unit_label} onChange={(e) => setForm({ ...form, unit_label: e.target.value })} placeholder="z.B. EG links" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Einzug</Label>
                <Input type="date" value={form.move_in_date} onChange={(e) => setForm({ ...form, move_in_date: e.target.value })} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Miete/Monat</Label>
                <Input type="number" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: Number(e.target.value) })} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kaution</Label>
                <Input type="number" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: Number(e.target.value) })} className="h-9 text-sm" />
              </div>
            </div>
            <Button onClick={() => saveMutation.mutate()} className="w-full mt-2" disabled={saveMutation.isPending}>
              {editTenant ? "Speichern" : "Mieter anlegen"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {tenants.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Noch keine Mieter angelegt</p>
      ) : (
        <div className="space-y-2">
          {tenants.map((t) => (
            <div key={t.id} className={`flex items-center gap-3 bg-secondary/50 rounded-lg p-3 group ${!t.is_active ? "opacity-50" : ""}`}>
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {t.first_name[0]}{t.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{t.first_name} {t.last_name}</span>
                  {t.unit_label && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{t.unit_label}</span>}
                  <Badge variant={t.is_active ? "default" : "secondary"} className="text-[10px] h-4">
                    {t.is_active ? "Aktiv" : "Ausgezogen"}
                  </Badge>
                  {/* Synergy 19: Show open ticket count */}
                  {tenantTicketCounts[t.id] > 0 && (
                    <span className="text-[10px] bg-gold/15 text-gold px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                      🔧 {tenantTicketCounts[t.id]}
                    </span>
                  )}
                  {/* Synergy 20: Show payment status */}
                  {tenantPaymentStatus[t.id]?.overdue > 0 && (
                    <span className="text-[10px] bg-loss/15 text-loss px-1.5 py-0.5 rounded-full font-bold">
                      💳 {tenantPaymentStatus[t.id].overdue} überfällig
                    </span>
                  )}
                  {tenantPaymentStatus[t.id]?.pending > 0 && !tenantPaymentStatus[t.id]?.overdue && (
                    <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded font-medium">
                      💳 {tenantPaymentStatus[t.id].pending} offen
                    </span>
                  )}
                  {/* Synergy: Invitation status */}
                  {t.is_active && !t.email && (
                    <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">Keine E-Mail</span>
                  )}
                  {t.is_active && t.email && !t.invitation_sent_at && (
                    <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">Nicht eingeladen</span>
                  )}
                  {t.invitation_sent_at && !t.user_id && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Eingeladen</span>
                  )}
                  {t.user_id && (
                    <span className="text-[10px] bg-profit/10 text-profit px-1.5 py-0.5 rounded">Im Portal</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                  {t.email && (
                    // UI-UPDATE-26: Tooltip on "copy email" action
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(t.email!).then(
                              () => toast.success("E-Mail kopiert"),
                              () => toast.error("Kopieren fehlgeschlagen")
                            );
                          }}
                          className="flex items-center gap-0.5 hover:text-foreground transition-colors"
                        >
                          <Mail className="h-2.5 w-2.5" /> {t.email}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>E-Mail kopieren</TooltipContent>
                    </Tooltip>
                  )}
                  {t.phone && (
                    <CallButton phone={t.phone} toLabel={[t.first_name, t.last_name].filter(Boolean).join(" ")} className="hover:text-foreground" />
                  )}
                  <span>{formatCurrency(t.monthly_rent)}/M</span>
                  {t.move_in_date && (
                    <span className="flex items-center gap-0.5">
                      <Calendar className="h-2.5 w-2.5" /> seit {new Date(t.move_in_date).toLocaleDateString("de-DE", { month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
              {/* UI-UPDATE-27: Keep tenant action icons visible on mobile (no hover) */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mobile-action-row">
                {t.is_active && (
                  <TenantPortalPreview tenant={{
                    id: t.id, first_name: t.first_name, last_name: t.last_name,
                    email: t.email, phone: t.phone, unit_label: t.unit_label,
                    monthly_rent: t.monthly_rent, deposit: t.deposit,
                    move_in_date: t.move_in_date,
                    property_name: propertyName || "Objekt",
                    property_address: propertyAddress || "",
                  }} />
                )}
                {t.email && t.is_active && (
                  // UI-UPDATE-28: Tooltip on "invite to tenant portal" action
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary"
                        onClick={() => handleInvite(t)}
                        disabled={inviting === t.id}
                      >
                        {inviting === t.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : copiedLink === t.id ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Ins Mieterportal einladen</TooltipContent>
                  </Tooltip>
                )}
                {/* UI-UPDATE-29: Tooltip on edit tenant action */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Bearbeiten</TooltipContent>
                </Tooltip>
                {/* UI-UPDATE-30: Tooltip on deactivate tenant action */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deactivateMutation.mutate(t)}>
                      <Home className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ausziehen / deaktivieren</TooltipContent>
                </Tooltip>
                {/* UI-UPDATE-31: Tooltip on delete tenant action */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => { lastDeletedTenantIdRef.current = t.id; deleteMutation.mutate(t.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Löschen</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invitation Link Dialog */}
      <Dialog open={!!inviteDialog} onOpenChange={(v) => { if (!v) setInviteDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-profit" /> Einladung erstellt
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Einladungslink für <strong>{inviteDialog?.name}</strong> wurde erstellt. Teile den Link per WhatsApp, E-Mail oder auf anderem Weg.
            </p>
            <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-3">
              <Input
                readOnly
                value={inviteDialog?.url || ""}
                className="h-8 text-xs bg-transparent border-0 focus-visible:ring-0"
              />
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5"
                onClick={copyInviteLink}
              >
                {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {linkCopied ? "Kopiert" : "Kopieren"}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 gap-1.5" variant="outline" onClick={sendViaMail}>
                <Mail className="h-3.5 w-3.5" /> Per E-Mail senden
              </Button>
              <Button className="flex-1 gap-1.5" onClick={copyInviteLink}>
                <Copy className="h-3.5 w-3.5" /> Link kopieren
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TenantManagement;
