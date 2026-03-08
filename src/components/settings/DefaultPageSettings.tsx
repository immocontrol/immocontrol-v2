/**
 * Settings Page-Splitting — Default Page selection extracted from Settings.tsx
 */
import { useState } from "react";
import { Home } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ROUTES } from "@/lib/routes";

const DEFAULT_PAGE_OPTIONS = [
  { value: ROUTES.HOME, label: "Portfolio" },
  { value: ROUTES.PERSONAL_DASHBOARD, label: "Dashboard" },
  { value: ROUTES.LOANS, label: "Darlehen" },
  { value: ROUTES.RENT, label: "Mieten" },
  { value: ROUTES.CONTRACTS, label: "Verträge" },
  { value: ROUTES.CONTACTS, label: "Kontakte" },
  { value: ROUTES.TODOS, label: "Aufgaben" },
  { value: ROUTES.REPORTS, label: "Berichte" },
  { value: ROUTES.DEALS, label: "Deals" },
  { value: ROUTES.CRM, label: "CRM" },
  { value: ROUTES.DOKUMENTE, label: "Dokumente" },
  { value: ROUTES.WARTUNG, label: "Wartung" },
] as const;

interface DefaultPageSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
}

export function DefaultPageSettings({ sectionRef }: DefaultPageSettingsProps) {
  const [defaultPage, setDefaultPage] = useState(() => {
    try { return localStorage.getItem("immocontrol_default_page") || "/"; } catch { return "/"; }
  });

  const handleChange = (value: string) => {
    setDefaultPage(value);
    localStorage.setItem("immocontrol_default_page", value);
    toast.success(`Standardseite auf "${DEFAULT_PAGE_OPTIONS.find(p => p.value === value)?.label || value}" gesetzt`);
    /* FIX-11: Removed focusNextField call that caused unwanted scroll to telegram/bot-token section.
       Selecting a default page is a standalone action — no "next field" navigation needed. */
  };

  return (
    <div id="standardseite" ref={sectionRef} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:112ms] scroll-mt-20">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Home className="h-4 w-4 text-muted-foreground" /> Standardseite nach Login
      </h2>
      <p className="text-xs text-muted-foreground">
        Wähle welche Seite nach dem Login als Erstes angezeigt werden soll.
      </p>
      <Select value={defaultPage} onValueChange={handleChange}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DEFAULT_PAGE_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
