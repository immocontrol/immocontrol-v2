/**
 * Native Face ID / Touch ID auf iOS (Capacitor).
 * Kapselt das Biometrie-Plugin; App-Logik importiert nur @/lib/biometric.
 */

export async function isNativeIos(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

/** Prüft, ob natives Biometrie-Plugin verfügbar und Face ID/Touch ID nutzbar ist. */
export async function isNativeBiometricAvailable(): Promise<boolean> {
  try {
    const ios = await isNativeIos();
    if (!ios) return false;
    const { NativeBiometric } = await import("@bytetrade/capacitor-native-biometric");
    const result = await NativeBiometric.isAvailable({ useFallback: false });
    return result.isAvailable;
  } catch {
    return false;
  }
}

/**
 * Zeigt den nativen Face-ID-/Touch-ID-Dialog und gibt true bei Erfolg zurück.
 * Nur auf nativer iOS-App sinnvoll; sonst false.
 */
export async function verifyWithNativeBiometric(reason: string): Promise<boolean> {
  try {
    const ios = await isNativeIos();
    if (!ios) return false;
    const { NativeBiometric } = await import("@bytetrade/capacitor-native-biometric");
    await NativeBiometric.verifyIdentity({
      reason: reason || "Zugang zur App bestätigen",
    });
    return true;
  } catch {
    return false;
  }
}
