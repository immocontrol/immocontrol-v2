/**
 * Biometric verification (Face ID / Touch ID).
 * Nur in der nativen iOS-App (Capacitor) — nicht im Browser/Web.
 * WebAuthn wird bewusst nicht genutzt; Biometrie nur mit nativer Berechtigung.
 */

import {
  isNativeIos,
  isNativeBiometricAvailable,
  verifyWithNativeBiometric,
} from "@/integrations/nativeBiometric";

/** Register (Aktivierung). Nur auf nativer iOS-App. */
export async function registerBiometricCredential(
  _userId: string,
  _userEmail: string,
  _displayName: string,
): Promise<boolean> {
  try {
    if (await isNativeIos() && (await isNativeBiometricAvailable())) {
      localStorage.setItem("immocontrol_biometric_enabled", "true");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Nur native iOS-Biometrie; kein WebAuthn-Fallback im Browser. */
export async function requestBiometricVerification(): Promise<boolean> {
  try {
    if (isBiometricUnlockEnabled() && (await isNativeIos())) {
      return await verifyWithNativeBiometric(
        "Zugang zu ImmoControl bestätigen",
      );
    }
    return false;
  } catch {
    return false;
  }
}

/** Ob Biometrie angeboten wird — nur in nativer iOS-App mit Berechtigung. */
export async function isBiometricSupported(): Promise<boolean> {
  try {
    if (await isNativeIos()) return isNativeBiometricAvailable();
    return false;
  } catch {
    return false;
  }
}

export function isBiometricUnlockEnabled(): boolean {
  try {
    return localStorage.getItem("immocontrol_biometric_enabled") === "true";
  } catch {
    return false;
  }
}

const BIOMETRIC_VERIFIED_KEY = "immocontrol_biometric_verified";

export function setBiometricVerifiedThisSession(): void {
  try {
    sessionStorage.setItem(BIOMETRIC_VERIFIED_KEY, "true");
  } catch { /* ignore */ }
}

export function isBiometricVerifiedThisSession(): boolean {
  try {
    return sessionStorage.getItem(BIOMETRIC_VERIFIED_KEY) === "true";
  } catch {
    return false;
  }
}
