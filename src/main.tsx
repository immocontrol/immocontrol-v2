import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "@/lib/serviceWorkerRegistration";
import { initSentryIfConfigured } from "@/lib/sentryInit";
import { trackError } from "@/lib/errorTracking";

initSentryIfConfigured();

/* STABILITY: Track unhandled promise rejections so they don't fail silently */
window.addEventListener("unhandledrejection", (event) => {
  const r = event.reason;
  let err: Error;
  if (r instanceof Error) {
    err = r;
  } else if (r && typeof r === "object" && "message" in r && typeof (r as { message: unknown }).message === "string") {
    err = new Error((r as { message: string }).message);
  } else {
    err = new Error(r != null && typeof r !== "object" ? String(r) : "Unhandled promise rejection");
  }
  trackError(err, "unhandledrejection");
});

/* REDEPLOY-FIX: Version mismatch after redeploy can cause React 310 (hooks) when old chunks mix with new.
   Force full reload if server version differs from bundled version. */
async function ensureFreshVersion(): Promise<boolean> {
  if (import.meta.env.DEV) return true;
  const bundled = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : null;
  if (!bundled) return true;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return true;
    const data = (await res.json()) as { version?: string };
    const server = typeof data?.version === "string" ? data.version : null;
    if (server && server !== bundled) {
      window.location.reload();
      return false;
    }
  } catch {
    /* Offline or error — proceed with render */
  }
  return true;
}

ensureFreshVersion().then((ok) => {
  if (ok) createRoot(document.getElementById("root")!).render(<App />);
});

if (import.meta.env.PROD) registerServiceWorker();
