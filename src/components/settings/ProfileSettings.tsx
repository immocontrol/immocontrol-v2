/**
 * #1: Settings Page-Splitting — Profile section extracted from Settings.tsx
 */
import { useState, useEffect } from "react";
import { User, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemo } from "react";

interface ProfileSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
}

export const ProfileSettings = ({ sectionRef }: ProfileSettingsProps) => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data?.display_name) setDisplayName(data.display_name);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const accountAge = useMemo(() => {
    if (!user?.created_at) return "";
    const created = new Date(user.created_at);
    const diffMs = Date.now() - created.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days < 1) return "Heute erstellt";
    if (days === 1) return "Seit gestern";
    if (days < 30) return `Seit ${days} Tagen`;
    const months = Math.floor(days / 30);
    if (months < 12) return `Seit ${months} Monat${months > 1 ? "en" : ""}`;
    const years = Math.floor(months / 12);
    return `Seit ${years} Jahr${years > 1 ? "en" : ""}`;
  }, [user?.created_at]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("user_id", user.id);
    setLoading(false);
    if (error) {
      toast.error("Fehler beim Speichern");
    } else {
      toast.success("Profil aktualisiert!");
    }
  };

  if (profileLoading) return null;

  return (
    <form id="profil" ref={sectionRef} onSubmit={handleUpdateProfile} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:50ms] scroll-mt-20">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" /> Profil
      </h2>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">E-Mail</Label>
        <Input value={user?.email || ""} disabled className="h-9 text-sm opacity-60" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Mitglied</Label>
        <div className="flex items-center gap-2">
          <Input
            value={user?.created_at ? new Date(user.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : "\u2013"}
            disabled
            className="h-9 text-sm opacity-60"
          />
          {accountAge && (
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-md whitespace-nowrap font-medium">
              {accountAge}
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Anzeigename</Label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Dein Name"
          className="h-9 text-sm"
        />
      </div>
      <Button type="submit" size="sm" disabled={loading}>
        Speichern
      </Button>
    </form>
  );
};
