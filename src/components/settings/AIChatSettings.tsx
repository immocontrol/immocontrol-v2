/**
 * Settings Page-Splitting — AI Chat toggle extracted from Settings.tsx
 * Einheitliches Toggle-Zeilen-Layout wie alle anderen Einstellungen.
 */
import { useState } from "react";
import { Bot } from "lucide-react";
import { toast } from "sonner";
import { SettingsToggleRow } from "@/components/ui/settings-toggle-row";

interface AIChatSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
}

export function AIChatSettings({ sectionRef }: AIChatSettingsProps) {
  const [aiChatEnabled, setAiChatEnabled] = useState(() => {
    try { return localStorage.getItem("immocontrol_ai_chat_disabled") !== "true"; } catch { return true; }
  });

  const handleToggle = (enabled: boolean) => {
    setAiChatEnabled(enabled);
    localStorage.setItem("immocontrol_ai_chat_disabled", enabled ? "false" : "true");
    window.dispatchEvent(new CustomEvent("ai-chat-toggle", { detail: { enabled } }));
    toast.success(enabled ? "AI Chat aktiviert" : "AI Chat deaktiviert");
  };

  return (
    <div id="ai-chat" ref={sectionRef} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:115ms] scroll-mt-20">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Bot className="h-4 w-4 text-muted-foreground" /> AI Chat
      </h2>
      <p className="text-xs text-muted-foreground">
        Aktiviere oder deaktiviere den AI Chat-Assistenten (Bubble unten rechts).
      </p>
      <SettingsToggleRow
        label="AI Chat anzeigen"
        description={aiChatEnabled ? "Bubble unten rechts sichtbar" : "Chat-Assistent ausgeblendet"}
        checked={aiChatEnabled}
        onCheckedChange={handleToggle}
        ariaLabel="AI Chat ein oder aus"
      />
    </div>
  );
}
