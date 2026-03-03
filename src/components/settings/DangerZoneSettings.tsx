/**
 * #1: Page-Splitting — Danger Zone section extracted from Settings.tsx
 */
import { AlertTriangle, LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DangerZoneSettingsProps {
  onLogout: () => void;
}

export function DangerZoneSettings({ onLogout }: DangerZoneSettingsProps) {
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "LÖSCHEN") return;
    try {
      const { error } = await supabase.rpc("delete_user_account" as never);
      if (error) throw error;
      toast.success("Konto wird gelöscht...");
      await supabase.auth.signOut();
    } catch {
      toast.error("Konto konnte nicht gelöscht werden. Bitte kontaktiere den Support.");
    }
  };

  return (
    <div className="gradient-card rounded-xl border border-loss/20 p-5 space-y-4 animate-fade-in scroll-mt-20">
      <h2 className="text-sm font-semibold flex items-center gap-2 text-loss">
        <AlertTriangle className="h-4 w-4" /> Gefahrenzone
      </h2>
      <div className="space-y-3">
        <Button variant="outline" size="sm" className="gap-1.5 w-full justify-start" onClick={onLogout}>
          <LogOut className="h-3.5 w-3.5" /> Abmelden
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 w-full justify-start text-loss border-loss/20 hover:bg-loss/10">
              <Trash2 className="h-3.5 w-3.5" /> Konto löschen
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Konto wirklich löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Alle deine Daten werden unwiderruflich gelöscht. Tippe <strong>LÖSCHEN</strong> zur Bestätigung.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder='Tippe "LÖSCHEN"'
              className="h-9 text-sm"
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteConfirm !== "LÖSCHEN"}
                onClick={handleDeleteAccount}
                className="bg-loss text-white hover:bg-loss/90"
              >
                Endgültig löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
