/**
 * Biometric verification via WebAuthn (Face ID / Touch ID).
 * Uses platform authenticator only — not Passkey/QR/Sicherheitsschlüssel.
 * Requires a credential to be registered first (done when enabling Biometrie in settings).
 */

const BIOMETRIC_CREDENTIAL_ID_KEY = "immocontrol_biometric_credential_id";

/** Register a platform-only credential (Face ID / Touch ID). Call when user enables Biometrie. */
export async function registerBiometricCredential(
  userId: string,
  userEmail: string,
  displayName: string,
): Promise<boolean> {
  try {
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
          authenticatorAttachment: "platform", // Nur Face ID / Touch ID, keine USB-Sicherheitsschlüssel
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
