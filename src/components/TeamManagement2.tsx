import { useState, useEffect, useMemo } from "react";
import { Users, Plus, Mail, Shield, CheckCircle2, XCircle, Clock, Trash2, Building2, UserCheck, Share2, Copy } from "lucide-react";
import { isValidEmail } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
  shared_resources: string[];
  created_at: string;
}

/** Available shared resource types for team members */
const SHARED_RESOURCES = [
  { key: "properties", label: "Objekte", icon: Building2, description: "Gemeinsame Immobilien (z.B. eGbR)" },
  { key: "contacts", label: "Kontakte", icon: Users, description: "Mieter, Handwerker, Dienstleister" },
  { key: "loans", label: "Darlehen", icon: Shield, description: "Gemeinsame Finanzierungen" },
  { key: "documents", label: "Dokumente", icon: Mail, description: "Vertraege, Protokolle, Rechnungen" },
  { key: "accounts", label: "Konten", icon: Shield, description: "Bank- und Mietkonten" },
  { key: "tasks", label: "Aufgaben", icon: CheckCircle2, description: "Gemeinsame To-Dos" },
] as const;

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
  const [selectedResources, setSelectedResources] = useState<string[]>(["properties", "contacts"]);
  const [loading, setLoading] = useState(false);

  const activeMembers = useMemo(() => members.filter(m => m.status === "accepted"), [members]);
  const pendingMembers = useMemo(() => members.filter(m => m.status === "pending"), [members]);

  /** Generate a shareable invite link */
  const copyInviteLink = () => {
    const link = `${window.location.origin}/einladung?ref=${user?.id || ""}`;
    navigator.clipboard.writeText(link).then(
      () => toast.success("Einladungslink kopiert!"),
      () => toast.error("Kopieren fehlgeschlagen — kein Clipboard-Zugriff")
    );
  };

  const toggleResource = (key: string) => {
    setSelectedResources(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const fetchMembers = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("team_members")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    /* FIX-8: Replace `as any` with proper typed cast for team members */
    if (data) setMembers(data as unknown as TeamMember[]);
  };

  const fetchInvitations = async () => {
    if (!user?.email) return;
    const { data } = await supabase
      .from("team_members")
      .select("*")
      .eq("member_email", user.email.toLowerCase())
      .eq("status", "pending");
    /* FIX-9: Replace `as any` with proper typed cast for invitations */
    if (data) setInvitations(data as unknown as TeamMember[]);
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
      shared_resources: selectedResources,
    } as never);
    if (error) {
      if (error.code === "23505") {
        toast.error("Dieses Teammitglied wurde bereits eingeladen");
      } else {
        toast.error("Fehler beim Einladen");
      }
    } else {
      /* Send invitation email: try Edge Function first, then fall back to
         Supabase built-in auth invite, then graceful degradation */
      let emailSent = false;
      try {
        const fnRes = await supabase.functions.invoke("invite-team-member", {
          body: {
            email: email.trim().toLowerCase(),
            role,
            shared_resources: selectedResources,
            redirect_origin: window.location.origin,
          },
        });
        if (fnRes.error) throw fnRes.error;
        emailSent = true;
      } catch {
        /* Edge Function unavailable — try Supabase auth invite as fallback */
        try {
          const { error: inviteErr } = await supabase.auth.signInWithOtp({
            email: email.trim().toLowerCase(),
            options: {
              shouldCreateUser: false,
              emailRedirectTo: `${window.location.origin}/einstellungen`,
            },
          });
          if (!inviteErr) emailSent = true;
        } catch {
          /* OTP also failed — silent fallback */
        }
      }
      if (emailSent) {
        toast.success(`Einladung per E-Mail an ${email} gesendet`);
      } else {
        toast.success(`Einladung an ${email} erstellt. Das Mitglied sieht sie nach dem Login.`);
      }
      setEmail("");
      setRole("viewer");
      setSelectedResources(["properties", "contacts"]);
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

                {/* Shared resource selection */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Geteilte Bereiche</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SHARED_RESOURCES.map(res => {
                      const isSelected = selectedResources.includes(res.key);
                      const ResIcon = res.icon;
                      return (
                        <button
                          key={res.key}
                          type="button"
                          onClick={() => toggleResource(res.key)}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all text-xs ${
                            isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:bg-secondary/50"
                          }`}
                        >
                          <ResIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-medium">{res.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Waehle welche Bereiche geteilt werden sollen (z.B. gemeinsame eGbR-Objekte).
                  </p>
                </div>

                <Button onClick={inviteMember} disabled={loading || !email.trim()} className="w-full">
                  {loading ? "Einladen..." : "Einladung senden"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Quick actions */}
        {members.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="secondary" className="text-[10px]">
              <UserCheck className="h-3 w-3 mr-1" /> {activeMembers.length} aktiv
            </Badge>
            {pendingMembers.length > 0 && (
              <Badge variant="outline" className="text-[10px] text-gold border-gold/30">
                <Clock className="h-3 w-3 mr-1" /> {pendingMembers.length} ausstehend
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 ml-auto" onClick={copyInviteLink}>
              <Copy className="h-3 w-3" /> Link kopieren
            </Button>
          </div>
        )}

        {members.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <Share2 className="h-6 w-6 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">
              Lade Partner oder Verwalter ein, um gemeinsam dein Portfolio zu verwalten.
            </p>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={copyInviteLink}>
              <Copy className="h-3 w-3" /> Einladungslink kopieren
            </Button>
          </div>
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
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Shield className="h-2.5 w-2.5" /> {roleLabels[member.role] || member.role}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${status.color}`}>
                          {status.label}
                        </span>
                        {member.shared_resources && member.shared_resources.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            · {member.shared_resources.length} Bereiche
                          </span>
                        )}
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
