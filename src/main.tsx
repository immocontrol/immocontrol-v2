import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "@/lib/serviceWorkerRegistration";
import { initSentryIfConfigured } from "@/lib/sentryInit";

initSentryIfConfigured();

createRoot(document.getElementById("root")!).render(<App />);

if (import.meta.env.PROD) registerServiceWorker();
