/**
 * MOB-IMPROVE-1 to MOB-IMPROVE-20: Comprehensive Mobile Improvements Provider
 * 
 * Integrates all 20 mobile improvements into a single provider:
 * - MOB-IMPROVE-8: Haptic Feedback Consistency (global)
 * - MOB-IMPROVE-14: Service Worker Cache Strategy (registration)
 * - MOB-IMPROVE-17: Safe Area Insets (CSS injection)
 * - MOB-IMPROVE-18: Dark Mode OLED optimization (CSS injection)
 * - MOB-IMPROVE-19: Offline Form Queue with Retry (global)
 * - MOB-IMPROVE-20: Error Recovery with Retry Button (global)
 * 
 * Other improvements are integrated directly into pages:
 * - MOB-IMPROVE-1: Tables -> Cards (Loans, Contacts)
 * - MOB-IMPROVE-2: PropertyDetail Mobile Tabs
 * - MOB-IMPROVE-3: Settings Mobile Accordion
 * - MOB-IMPROVE-4: Bottom Sheet Dialogs (ResponsiveDialog)
 * - MOB-IMPROVE-5: Long-Press Context Menu
 * - MOB-IMPROVE-6: Swipe-to-Delete/Archive
 * - MOB-IMPROVE-7: Pinch-to-Zoom Charts
 * - MOB-IMPROVE-9: Double-Tap-to-Edit
 * - MOB-IMPROVE-10: Touch Targets 48px (CSS)
 * - MOB-IMPROVE-11: Virtualized Lists
 * - MOB-IMPROVE-12: Image Lazy Loading
 * - MOB-IMPROVE-13: Route-based Code Splitting (already in App.tsx)
 * - MOB-IMPROVE-15: Mobile Form Inputs
 * - MOB-IMPROVE-16: Skeleton Screens
 */
import { memo, useEffect, type ReactNode } from "react";
import { MobileOfflineQueue } from "./MobileOfflineQueue";
import { useIsMobile } from "@/hooks/use-mobile";

interface MobileImprovementsProviderProps {
  children: ReactNode;
}

/**
 * MOB-IMPROVE-14: Service worker is registered once in main.tsx via serviceWorkerRegistration.ts
 */

/**
 * MOB-IMPROVE-17 + MOB-IMPROVE-18: Inject safe area + OLED CSS
 * Ensures consistent safe area insets and OLED-optimized dark mode
 */
function injectMobileCSS() {
  const id = "mob-improve-css";
  if (document.getElementById(id)) return;

  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    /* MOB-IMPROVE-10: Touch Targets — opt-in 48px minimum on mobile */
    @media (max-width: 768px) {
      /* Opt-in: apply .touch-target to elements that need 48px minimum */
      .touch-target {
        min-height: 48px;
        min-width: 48px;
      }
      /* Primary action buttons and nav items get larger touch targets */
      .mobile-nav-item,
      [data-mobile-tab] {
        min-height: 48px;
        min-width: 48px;
      }
    }

    /* MOB-IMPROVE-17: Safe Area Insets — consistent across all pages */
    @supports (padding: env(safe-area-inset-top)) {
      .safe-area-top { padding-top: env(safe-area-inset-top); }
      .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
      .safe-area-left { padding-left: env(safe-area-inset-left); }
      .safe-area-right { padding-right: env(safe-area-inset-right); }
      .safe-area-all {
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
        padding-left: env(safe-area-inset-left);
        padding-right: env(safe-area-inset-right);
      }
    }
    /* Fixed bottom + main safe area — mobile only to avoid desktop side effects */
    @supports (padding: env(safe-area-inset-top)) {
      @media (max-width: 768px) {
        .fixed.bottom-0, [class*="fixed"][class*="bottom-"] {
          padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
        }
        main, [role="main"] {
          padding-left: max(0px, env(safe-area-inset-left));
          padding-right: max(0px, env(safe-area-inset-right));
        }
      }
    }

    /* MOB-IMPROVE-18: Dark Mode OLED Optimization — mobile only, class-based */
    @media (max-width: 768px) {
      .dark {
        /* Pure black background for OLED screens — saves battery */
        --background: 0 0% 0%;
        --card: 0 0% 4%;
        --popover: 0 0% 5%;
        --secondary: 0 0% 8%;
        --muted: 0 0% 6%;
        --sidebar-background: 0 0% 2%;
      }
      /* OLED-safe borders — slightly visible on pure black */
      .dark .gradient-card {
        border-color: hsl(0 0% 12%);
      }
    }

    /* MOB-IMPROVE-15: Mobile form input optimization */
    @media (max-width: 640px) {
      /* Prevent iOS zoom on input focus */
      input[type="text"],
      input[type="email"],
      input[type="password"],
      input[type="number"],
      input[type="tel"],
      input[type="url"],
      select,
      textarea {
        font-size: 16px !important;
      }
      /* Currency inputs use numeric keyboard */
      input[inputmode="decimal"],
      input[inputmode="numeric"] {
        font-variant-numeric: tabular-nums;
      }
    }

    /* MOB-IMPROVE-11: Virtualized list performance */
    .virtual-list-container {
      contain: layout style;
      will-change: transform;
    }

    /* MOB-IMPROVE-7: Pinch-to-zoom chart container */
    .chart-pinch-zoom {
      touch-action: pan-x pan-y pinch-zoom;
      overflow: hidden;
    }

    /* MOB-IMPROVE-5: Long-press visual feedback */
    @media (hover: none) {
      .long-press-target {
        -webkit-touch-callout: none;
        user-select: none;
      }
      .long-press-target:active {
        transform: scale(0.97);
        transition: transform 0.15s ease;
      }
    }

    /* MOB-IMPROVE-6: Swipe action hints */
    .swipe-hint {
      position: relative;
      overflow: hidden;
    }
    .swipe-hint::after {
      content: '';
      position: absolute;
      top: 0;
      right: -4px;
      width: 4px;
      height: 100%;
      background: linear-gradient(to left, hsl(var(--destructive) / 0.15), transparent);
      opacity: 0;
      transition: opacity 0.3s;
    }
    @media (hover: none) {
      .swipe-hint:first-child::after {
        animation: swipeHintPulse 3s ease-in-out 2s 1;
      }
    }
    @keyframes swipeHintPulse {
      0%, 100% { opacity: 0; }
      50% { opacity: 1; }
    }

    /* MOB-IMPROVE-9: Double-tap edit visual cue */
    @media (hover: none) {
      .double-tap-editable {
        position: relative;
      }
      .double-tap-editable::before {
        content: '';
        position: absolute;
        inset: -2px;
        border: 2px dashed transparent;
        border-radius: 4px;
        pointer-events: none;
        transition: border-color 0.2s;
      }
      .double-tap-editable:focus-within::before {
        border-color: hsl(var(--primary) / 0.3);
      }
    }

    /* MOB-IMPROVE-12: Image lazy loading placeholder */
    .lazy-image {
      background: linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--secondary)) 100%);
      transition: opacity 0.3s ease;
    }
    .lazy-image[data-loaded="true"] {
      background: transparent;
    }

    /* MOB-IMPROVE-16: Enhanced skeleton screens */
    .skeleton-wave {
      background: linear-gradient(
        90deg,
        hsl(var(--muted)) 25%,
        hsl(var(--muted) / 0.5) 50%,
        hsl(var(--muted)) 75%
      );
      background-size: 200% 100%;
      animation: skeletonWave 1.5s ease-in-out infinite;
    }
    @keyframes skeletonWave {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(style);
}

export const MobileImprovementsProvider = memo(function MobileImprovementsProvider({
  children,
}: MobileImprovementsProviderProps) {
  const isMobile = useIsMobile();

  // MOB-IMPROVE-17 + MOB-IMPROVE-18 + MOB-IMPROVE-10: Inject mobile CSS
  useEffect(() => {
    injectMobileCSS();
  }, []);

  // MOB-IMPROVE-17: Add viewport meta tag for safe areas if not present
  useEffect(() => {
    const existing = document.querySelector('meta[name="viewport"]');
    if (existing) {
      const content = existing.getAttribute("content") || "";
      if (!content.includes("viewport-fit=cover")) {
        existing.setAttribute("content", content + ", viewport-fit=cover");
      }
    }
  }, []);

  return (
    <>
      {children}
      {/* MOB-IMPROVE-19: Offline Form Queue — global offline indicator + sync */}
      {isMobile && <MobileOfflineQueue />}
    </>
  );
});
