/**
 * Biometric verification (Face ID / Touch ID).
 * Auf nativer iOS-App: systemeigene Face-ID-API über Capacitor-Plugin.
 * Sonst: WebAuthn mit Plattform-Authenticator (keine Passkeys/QR/Sicherheitsschlüssel).
 * Bei Aktivierung wird je nach Plattform native Biometrie oder eine WebAuthn-Credential genutzt.
 */

import {
  isNativeIos,
  isNativeBiometricAvailable,
  verifyWithNativeBiometric,
} from "@/integrations/nativeBiometric";

const BIOMETRIC_CREDENTIAL_ID_KEY = "immocontrol_biometric_credential_id";

/** Register (Aktivierung). Auf iOS nativ: nur Flag setzen; sonst WebAuthn-Credential anlegen. */
export async function registerBiometricCredential(
  userId: string,
  userEmail: string,
  displayName: string,
): Promise<boolean> {
  try {
    if (await isNativeIos() && (await isNativeBiometricAvailable())) {
      localStorage.setItem("immocontrol_biometric_enabled", "true");
      return true;
    }
    if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "ImmoControl" }, /* id omitted: browser uses current origin */
        user: {
          id: new TextEncoder().encode(userId),
          name: userEmail || "user",
          displayName: displayName || userEmail || "User",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },
          { alg: -257, type: "public-key" },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 120000,
        attestation: "none",
      },
    }) as PublicKeyCredential | null;
    if (credential) {
      localStorage.setItem(BIOMETRIC_CREDENTIAL_ID_KEY, credential.id);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function requestBiometricVerification(): Promise<boolean> {
  try {
    if (isBiometricUnlockEnabled() && (await isNativeIos())) {
      const ok = await verifyWithNativeBiometric(
        "Zugang zu ImmoControl bestätigen",
      );
      if (ok) return true;
    }
    if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
    const storedId = localStorage.getItem(BIOMETRIC_CREDENTIAL_ID_KEY);
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const getOptions: CredentialRequestOptions = {
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        userVerification: "required",
        timeout: 60000,
      },
    };
    if (storedId) {
      try {
        const idBytes = Uint8Array.from(atob(storedId.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
        getOptions.publicKey!.allowCredentials = [{ id: idBytes, type: "public-key", transports: ["internal"] }];
      } catch {
        /* fallback: try without allowCredentials */
      }
    }
    const credential = await navigator.credentials.get(getOptions);
    return !!credential;
  } catch {
    return false;
  }
}

/** Ob Biometrie auf diesem Gerät angeboten werden kann (nativ iOS oder WebAuthn). */
export async function isBiometricSupported(): Promise<boolean> {
  try {
    if (await isNativeIos()) return isNativeBiometricAvailable();
    if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
    const fn = window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable;
    if (typeof fn !== "function") return false;
    return fn.call(window.PublicKeyCredential);
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
