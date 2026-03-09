/// <reference types="vite/client" />

/** Build-Zeitstempel (z. B. "2025-03-08 12:00:00"), nur bei Production-Build gesetzt */
declare const __APP_BUILD_TIME__: string | undefined;
/** Eindeutige Version pro Build für Update-Erkennung (Abgleich mit /version.json) */
declare const __APP_VERSION__: string | undefined;
