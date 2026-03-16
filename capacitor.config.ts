/**
 * Capacitor-Konfiguration für die native iOS-App (App Store).
 * Siehe docs/IOS_APPSTORE.md für die Schritte bis zur Veröffentlichung.
 */
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.immocontrol.app",
  appName: "ImmoControl",
  webDir: "dist",
  server: {
    // Web-App wird aus dem App-Bundle geladen (Standard).
    // Bei Problemen mit Routen: androidScheme: "https" kann helfen.
  },
};

export default config;
