/**
 * UX-4: Haptic Feedback on actions
 * Provides vibration feedback on mobile devices for key interactions.
 */
export function useHaptic() {
  const vibrate = (pattern: number | number[] = 10) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        /* silently ignore — not all browsers support vibrate */
      }
    }
  };

  return {
    /** Short tap feedback (save, toggle) */
    tap: () => vibrate(10),
    /** Medium feedback (delete, important action) */
    medium: () => vibrate(25),
    /** Success pattern (double vibration) */
    success: () => vibrate([10, 50, 10]),
    /** Error/warning pattern */
    error: () => vibrate([30, 30, 30]),
  };
}
