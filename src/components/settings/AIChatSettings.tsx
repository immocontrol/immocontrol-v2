/**
 * Settings Page-Splitting — AI Chat toggle extracted from Settings.tsx
 */
import { useState } from "react";
import { Bot } from "lucide-react";
import { toast } from "sonner";

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
      <button
        type="button"
        role="switch"
        aria-checked={aiChatEnabled}
        onClick={() => handleToggle(!aiChatEnabled)}
        className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300 ${
          aiChatEnabled
            ? "border-primary/40 bg-gradient-to-r from-primary/5 to-primary/10 shadow-sm"
            : "border-border bg-secondary/20 hover:border-muted-foreground/30 hover:bg-secondary/40"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
            aiChatEnabled ? "bg-primary/15 text-primary scale-105" : "bg-secondary text-muted-foreground"
          }`}>
            <Bot className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium">{aiChatEnabled ? "AI Chat ist aktiv" : "AI Chat ist deaktiviert"}</p>
            <p className="text-[10px] text-muted-foreground">
              {aiChatEnabled ? "Bubble unten rechts sichtbar" : "Chat-Assistent ausgeblendet"}
            </p>
          </div>
        </div>
        <div className={`relative w-12 h-7 rounded-full transition-all duration-300 ${aiChatEnabled ? "bg-primary" : "bg-muted"}`}>
          <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${aiChatEnabled ? "left-[22px]" : "left-0.5"}`} />
        </div>
      </button>
    </div>
  );
}
