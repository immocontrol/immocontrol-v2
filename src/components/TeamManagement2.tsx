import { useState, useEffect } from "react";
import { Users, Plus, Mail, Shield, CheckCircle2, XCircle, Clock, Trash2 } from "lucide-react";
import { isValidEmail } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  owner_id: string;
  member_user_id: string | null;
  member_email: string;
  role: string;
  status: string;
  created_at: string;
}

const roleLabels: Record<string, string> = {
  viewer: "Betrachter",
  editor: "Bearbeiter",
  admin: "Administrator",
};

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: "Eingeladen", icon: Clock, color: "text-gold bg-gold/10" },
  accepted: { label: "Aktiv", icon: CheckCircle2, color: "text-profit bg-profit/10" },
  rejected: { label: "Abgelehnt", icon: XCircle, color: "text-loss bg-loss/10" },
};

export const TeamManagement = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamMember[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [loading, setLoading] = useState(false);

  const fetchMembers = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("team_members")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setMembers(data as any);
  };

  const fetchInvitations = async () => {
    if (!user?.email) return;
    const { data } = await supabase
      .from("team_members")
      .select("*")
      .eq("member_email", user.email.toLowerCase())
      .eq("status", "pending");
    if (data) setInvitations(data as any);
  };

  useEffect(() => {
    fetchMembers();
    fetchInvitations();
  }, [user]);

  const inviteMember = async () => {
    if (!user || !email.trim()) {
      toast.error("E-Mail ist erforderlich");
      return;
    }
    if (!isValidEmail(email)) {
      toast.error("Bitte eine gueltige E-Mail-Adresse eingeben");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("team_members").insert({
      owner_id: user.id,
      member_email: email.trim().toLowerCase(),
      role,
    });
    if (error) {
      if (error.code === "23505") {
        toast.error("Dieses Teammitglied wurde bereits eingeladen");
      } else {
        toast.error("Fehler beim Einladen");
      }
    } else {
      // Send invitation email via built-in auth invite
      try {
        await supabase.functions.invoke("invite-team-member", {
          body: {
            email: email.trim().toLowerCase(),
            role,
            redirect_origin: window.location.origin,
          },
        });
        toast.success(`Einladung per E-Mail an ${email} gesendet`);
      } catch {
        toast.success(`Einladung an ${email} erstellt – das Mitglied sieht sie nach dem Login.`);
      }
      setEmail("");
      setRole("viewer");
      setOpen(false);
      fetchMembers();
    }
    setLoading(false);
  };

  const removeMember = async (id: string) => {
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) { toast.error("Fehler"); return; }
    toast.success("Teammitglied entfernt");
    fetchMembers();
  };

  const respondToInvitation = async (id: string, accept: boolean) => {
    const { error } = await supabase
      .from("team_members")
      .update({
        status: accept ? "accepted" : "rejected",
        member_user_id: user!.id,
      })
      .eq("id", id);
    if (error) { toast.error("Fehler"); return; }
    toast.success(accept ? "Einladung angenommen" : "Einladung abgelehnt");
    fetchInvitations();
  };

  return (
    <div className="space-y-4">
      {/* Pending invitations for current user */}
      {invitations.length > 0 && (
        <div className="gradient-card rounded-xl border border-gold/20 p-5 animate-fade-in">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-gold" /> Offene Einladungen
          </h2>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <div className="text-sm font-medium">Team-Einladung</div>
                  <div className="text-xs text-muted-foreground">
                    Rolle: {roleLabels[inv.role] || inv.role}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-8 text-xs text-profit" onClick={() => respondToInvitation(inv.id, true)}>
                    Annehmen
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs text-loss" onClick={() => respondToInvitation(inv.id, false)}>
                    Ablehnen
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team management */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" /> Team-Verwaltung
            {members.length > 0 && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                {members.length}
              </span>
            )}
          </h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 h-8">
                <Plus className="h-3.5 w-3.5" /> Einladen
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Teammitglied einladen</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">E-Mail *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="partner@example.com"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rolle</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Betrachter – Nur lesen</SelectItem>
                      <SelectItem value="editor">Bearbeiter – Lesen & Bearbeiten</SelectItem>
                      <SelectItem value="admin">Administrator – Voller Zugriff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Das Teammitglied erhält Zugriff auf dein Portfolio, sobald es die Einladung annimmt.
                  Ideal für eGbR-Partner oder Hausverwalter.
                </p>
                <Button onClick={inviteMember} disabled={loading} className="w-full">
                  {loading ? "Einladen…" : "Einladung senden"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Noch keine Teammitglieder. Lade Partner oder Verwalter ein, um gemeinsam dein Portfolio zu verwalten.
          </p>
        ) : (
          <div className="space-y-1.5">
            {members.map((member) => {
              const status = statusConfig[member.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              return (
                <div key={member.id} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${status.color}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{member.member_email}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Shield className="h-2.5 w-2.5" /> {roleLabels[member.role] || member.role}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMember(member.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
