/**
 * MOB4-7: Mobile Share Sheet Integration
 * Native Web Share API integration for sharing reports, PDFs, property details.
 * Falls back to clipboard copy when Share API is unavailable.
 */
import { useCallback, memo, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Share2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

export interface ShareData {
  title: string;
  text?: string;
  url?: string;
  /** File to share (only supported in some browsers) */
  file?: File;
}

interface MobileShareSheetProps {
  /** Data to share */
  data: ShareData;
  /** Custom trigger element */
  children?: ReactNode;
  /** Button variant */
  variant?: "icon" | "button" | "compact";
  /** Additional class */
  className?: string;
  /** Callback after successful share */
  onShared?: () => void;
}

function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && "share" in navigator;
}

function canShareFiles(): boolean {
  return typeof navigator !== "undefined" && "canShare" in navigator;
}

export const MobileShareSheet = memo(function MobileShareSheet({
  data,
  children,
  variant = "icon",
  className,
  onShared,
}: MobileShareSheetProps) {
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    // Try native share first
    if (canNativeShare()) {
      try {
        const sharePayload: ShareData & { files?: File[] } = {
          title: data.title,
          text: data.text,
          url: data.url,
        };

        // Try sharing file if available
        if (data.file && canShareFiles()) {
          const fileShareData = { ...sharePayload, files: [data.file] };
          if (navigator.canShare(fileShareData)) {
            await navigator.share(fileShareData);
            onShared?.();
            return;
          }
        }

        await navigator.share(sharePayload);
        onShared?.();
        return;
      } catch (err) {
        // User cancelled or share failed
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    // Fallback: copy to clipboard
    const textToCopy = data.url || data.text || data.title;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success("Link kopiert!");
      setTimeout(() => setCopied(false), 2000);
      onShared?.();
    } catch {
      // Final fallback: text area copy
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      toast.success("Link kopiert!");
      setTimeout(() => setCopied(false), 2000);
      onShared?.();
    }
  }, [data, onShared]);

  // Custom trigger
  if (children) {
    return (
      <div onClick={handleShare} className={cn("cursor-pointer", className)}>
        {children}
      </div>
    );
  }

  // Icon-only button
  if (variant === "icon") {
    return (
      <button
        onClick={handleShare}
        className={cn(
          "p-2 rounded-full hover:bg-muted active:bg-muted/80 transition-colors",
          className
        )}
        aria-label="Teilen"
        title="Teilen"
      >
        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Share2 className="w-4 h-4" />}
      </button>
    );
  }

  // Compact button
  if (variant === "compact") {
    return (
      <button
        onClick={handleShare}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 text-xs rounded-md hover:bg-muted active:bg-muted/80 transition-colors",
          className
        )}
      >
        {copied ? <Check className="w-3 h-3 text-green-600" /> : <Share2 className="w-3 h-3" />}
        <span>{copied ? "Kopiert" : "Teilen"}</span>
      </button>
    );
  }

  // Full button
  return (
    <button
      onClick={handleShare}
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border",
        "hover:bg-muted active:bg-muted/80 transition-colors",
        className
      )}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-green-600" />
          <span>Kopiert!</span>
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4" />
          <span>Teilen</span>
        </>
      )}
    </button>
  );
});

/** Hook for sharing from anywhere */
export function useShare() {
  const share = useCallback(async (data: ShareData): Promise<boolean> => {
    if (canNativeShare()) {
      try {
        await navigator.share({
          title: data.title,
          text: data.text,
          url: data.url,
        });
        return true;
      } catch {
        // Fallback below
      }
    }

    const textToCopy = data.url || data.text || data.title;
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success("Link kopiert!");
      return true;
    } catch {
      return false;
    }
  }, []);

  return { share, canNativeShare: canNativeShare() };
}
