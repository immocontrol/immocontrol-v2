/**
 * Gamification: Short confetti burst for goal/achievement celebration.
 */
import confetti from "canvas-confetti";

const defaultOpts = {
  particleCount: 80,
  spread: 60,
  origin: { y: 0.75 },
  colors: ["#22c55e", "#eab308", "#3b82f6", "#8b5cf6"],
};

export function fireConfetti(): void {
  // Respect accessibility setting from AccessibilityProvider.
  try {
    const raw = localStorage.getItem("immo-a11y-settings");
    if (raw) {
      const parsed = JSON.parse(raw) as { reducedMotion?: boolean };
      if (parsed.reducedMotion) return;
    }
  } catch {
    /* ignore storage/parse errors */
  }

  try {
    confetti({ ...defaultOpts });
    const t = setTimeout(() => {
      confetti({ ...defaultOpts, particleCount: 40, origin: { x: 0.2, y: 0.75 } });
      confetti({ ...defaultOpts, particleCount: 40, origin: { x: 0.8, y: 0.75 } });
    }, 150);
    return () => clearTimeout(t);
  } catch {
    /* ignore if canvas-confetti fails */
  }
}
