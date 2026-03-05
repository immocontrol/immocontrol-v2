/**
 * MOB6-12: Mobile Animated Transitions
 * Shared-element transitions between pages (property card → detail with flying image).
 * Uses CSS transforms and requestAnimationFrame for smooth 60fps animations.
 */
import { useState, useCallback, useRef, useEffect, memo, createContext, useContext } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface SharedElement {
  id: string;
  rect: DOMRect;
  element: HTMLElement;
  snapshot?: string; // Data URL for image elements
}

interface TransitionContextValue {
  registerElement: (id: string, element: HTMLElement) => void;
  unregisterElement: (id: string) => void;
  startTransition: (fromId: string, toId: string) => void;
  isTransitioning: boolean;
}

const TransitionContext = createContext<TransitionContextValue>({
  registerElement: () => {},
  unregisterElement: () => {},
  startTransition: () => {},
  isTransitioning: false,
});

export function useSharedTransition() {
  return useContext(TransitionContext);
}

interface MobileAnimatedTransitionsProps {
  children: React.ReactNode;
  /** Transition duration in ms */
  duration?: number;
  /** Easing function */
  easing?: string;
  /** Additional class */
  className?: string;
}

export const MobileAnimatedTransitions = memo(function MobileAnimatedTransitions({
  children,
  duration = 350,
  easing = "cubic-bezier(0.4, 0, 0.2, 1)",
  className,
}: MobileAnimatedTransitionsProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [overlay, setOverlay] = useState<React.ReactNode>(null);
  const elementsRef = useRef(new Map<string, HTMLElement>());
  const animFrameRef = useRef<number>(0);

  const registerElement = useCallback((id: string, element: HTMLElement) => {
    elementsRef.current.set(id, element);
  }, []);

  const unregisterElement = useCallback((id: string) => {
    elementsRef.current.delete(id);
  }, []);

  // Cleanup animation frame
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const startTransition = useCallback((fromId: string, toId: string) => {
    const fromElement = elementsRef.current.get(fromId);
    if (!fromElement) return;

    const fromRect = fromElement.getBoundingClientRect();
    setIsTransitioning(true);

    // Create snapshot of the from element
    const clone = fromElement.cloneNode(true) as HTMLElement;
    clone.style.position = "fixed";
    clone.style.top = `${fromRect.top}px`;
    clone.style.left = `${fromRect.left}px`;
    clone.style.width = `${fromRect.width}px`;
    clone.style.height = `${fromRect.height}px`;
    clone.style.zIndex = "9999";
    clone.style.transition = `all ${duration}ms ${easing}`;
    clone.style.pointerEvents = "none";
    clone.style.willChange = "transform, width, height, top, left";

    setOverlay(
      <div className="fixed inset-0 z-[9998] pointer-events-none">
        <div
          ref={(el) => {
            if (!el) return;
            el.appendChild(clone);

            // Wait for next frame, then animate to target position
            animFrameRef.current = requestAnimationFrame(() => {
              // Find target element
              const toElement = elementsRef.current.get(toId);
              if (toElement) {
                const toRect = toElement.getBoundingClientRect();
                clone.style.top = `${toRect.top}px`;
                clone.style.left = `${toRect.left}px`;
                clone.style.width = `${toRect.width}px`;
                clone.style.height = `${toRect.height}px`;
              } else {
                // Expand to full width
                clone.style.top = "0px";
                clone.style.left = "0px";
                clone.style.width = "100vw";
                clone.style.height = "50vh";
              }
            });
          }}
          className="fixed inset-0"
        />
      </div>
    );

    // Clean up after animation
    setTimeout(() => {
      setIsTransitioning(false);
      setOverlay(null);
    }, duration + 50);
  }, [duration, easing]);

  const contextValue = {
    registerElement,
    unregisterElement,
    startTransition,
    isTransitioning,
  };

  return (
    <TransitionContext.Provider value={contextValue}>
      <div className={cn("relative", className)}>
        {children}
        {overlay}
      </div>
    </TransitionContext.Provider>
  );
});

/** Wrapper to register an element for shared transitions */
interface SharedElementProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export const SharedElement = memo(function SharedElement({
  id,
  children,
  className,
}: SharedElementProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { registerElement, unregisterElement } = useSharedTransition();

  useEffect(() => {
    if (ref.current) {
      registerElement(id, ref.current);
    }
    return () => unregisterElement(id);
  }, [id, registerElement, unregisterElement]);

  return (
    <div ref={ref} className={className} data-shared-id={id}>
      {children}
    </div>
  );
});

/** Page transition wrapper with fade/slide effects */
interface PageTransitionProps {
  children: React.ReactNode;
  /** Transition type */
  type?: "fade" | "slide-left" | "slide-right" | "slide-up" | "zoom";
  /** Duration in ms */
  duration?: number;
  className?: string;
}

export const PageTransition = memo(function PageTransition({
  children,
  type = "fade",
  duration = 300,
  className,
}: PageTransitionProps) {
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation on mount
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const transitionClasses = {
    fade: isVisible ? "opacity-100" : "opacity-0",
    "slide-left": isVisible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0",
    "slide-right": isVisible ? "translate-x-0 opacity-100" : "-translate-x-8 opacity-0",
    "slide-up": isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
    zoom: isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0",
  };

  return (
    <div
      className={cn(
        "transition-all",
        transitionClasses[type],
        className
      )}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
});
