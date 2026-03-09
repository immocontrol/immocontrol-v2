/**
 * Biometric verification via WebAuthn (Face ID / Touch ID).
 * Used for app unlock when "Biometrie für Login" is enabled in settings.
 */

export async function requestBiometricVerification(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!credential;
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
