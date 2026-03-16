/**
 * Native Push (iOS APNs / Android FCM) für Geräte-Benachrichtigungen.
 * Auf iOS werden Benachrichtigungen bei aktivierter Spiegelung auch auf der Apple Watch angezeigt.
 * Siehe docs/BENACHRICHTIGUNGEN.md (Apple Watch).
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/** Prüft, ob die App nativ (Capacitor) läuft – nur dann Push registrieren. */
export async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Gibt die aktuelle Plattform zurück: 'ios' | 'android' | null (Web). */
export async function getNativePlatform(): Promise<"ios" | "android" | null> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    const p = Capacitor.getPlatform();
    if (p === "ios" || p === "android") return p;
    return null;
  } catch {
    return null;
  }
}

/**
 * Registriert die App für Native Push und speichert den Geräte-Token in Supabase (device_tokens).
 * Sollte nach Login aufgerufen werden, wenn der User eingeloggt ist.
 * Nur auf iOS/Android aktiv; auf Web kein Op.
 */
export async function registerNativePush(userId: string): Promise<boolean> {
  const platform = await getNativePlatform();
  if (!platform) return false;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt") {
      const request = await PushNotifications.requestPermissions();
      if (request.receive !== "granted") {
        logger.warn("Native Push: Berechtigung verweigert");
        return false;
      }
    }
    if (perm.receive !== "granted") return false;

    return new Promise<boolean>((resolve) => {
      const onRegistration = (token: { value: string }) => {
        saveDeviceToken(userId, token.value, platform).then(() => resolve(true));
      };
      const onError = (err: { error: string }) => {
        logger.warn("Native Push: Registrierung fehlgeschlagen", { error: err.error });
        resolve(false);
      };

      PushNotifications.addListener("registration", onRegistration);
      PushNotifications.addListener("registrationError", onError);
      PushNotifications.register().catch(() => resolve(false));
    });
  } catch (e) {
    logger.warn("Native Push: Plugin nicht verfügbar", e instanceof Error ? e.message : String(e));
    return false;
  }
}

async function saveDeviceToken(userId: string, token: string, platform: "ios" | "android"): Promise<void> {
  const { error } = await supabase.from("device_tokens").upsert(
    {
      user_id: userId,
      token,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token", ignoreDuplicates: false }
  );
  if (error) logger.warn("Device-Token speichern fehlgeschlagen", { error: error.message });
}

/**
 * Entfernt den aktuellen Geräte-Token aus Supabase (z. B. bei Logout).
 * Unregister beim Plugin wird nicht aufgerufen, damit bei erneutem Login derselbe Token genutzt werden kann.
 */
export async function removeNativePushToken(userId: string, token: string): Promise<void> {
  await supabase.from("device_tokens").delete().eq("user_id", userId).eq("token", token);
}
