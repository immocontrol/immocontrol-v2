/**
 * Global haptic trigger for use outside React (e.g. toast callbacks).
 * Registered once by a provider that has useHaptic(); then toastSuccess/toastError can trigger it.
 * iOS Safari does not support Vibration API — no-op there; works on Android.
 */
type HapticApi = { tap: () => void; medium: () => void; success: () => void; error: () => void };
let hapticRef: HapticApi | null = null;

export function setHapticTrigger(api: HapticApi | null) {
  hapticRef = api;
}

export function triggerHapticSuccess() {
  hapticRef?.success();
}

export function triggerHapticError() {
  hapticRef?.error();
}

export function triggerHapticSave() {
  hapticRef?.medium();
}
