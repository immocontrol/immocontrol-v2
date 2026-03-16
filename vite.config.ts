import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { writeFileSync } from "fs";

const DEFAULT_APP_URL = "https://esgroup.lovable.app";
const DEFAULT_OG_IMAGE = "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/db2e2e03-c265-4536-b239-ac0d5f515748/id-preview-ed60820b--1133fd24-00e8-4f21-a81e-39aa4e95c894.lovable.app-1772005444008.png";

/** Plugins: optional tool-specific taggers (e.g. lovable-tagger). Build works without them. */
async function getPlugins(mode: string, buildVersion?: string) {
  const env = loadEnv(mode, process.cwd(), "");
  const wantAnalyze = process.env.ANALYZE === "1" || process.env.ANALYZE === "true";
  const plugins: unknown[] = [
    react(),
    {
      name: "html-env",
      transformIndexHtml: {
        order: "pre",
        handler(html: string) {
          const appUrl = env.VITE_APP_URL || DEFAULT_APP_URL;
          const ogImage = env.VITE_APP_OG_IMAGE || DEFAULT_OG_IMAGE;
          return html
            .replace(/__VITE_APP_URL__/g, appUrl)
            .replace(/__VITE_APP_OG_IMAGE__/g, ogImage);
        },
      },
    },
  ];
  try {
    const { componentTagger } = await import("lovable-tagger");
    if (mode === "development" && componentTagger) plugins.push(componentTagger());
  } catch {
    /* optional: no tagger — run with any IDE/tool */
  }
  if (wantAnalyze) {
    try {
      const { visualizer } = await import("rollup-plugin-visualizer");
      plugins.push(visualizer({ open: false, filename: "dist/stats.html", gzipSize: true }));
    } catch {
      /* optional: npm install rollup-plugin-visualizer für build:analyze */
    }
  }
  plugins.push({
    name: "version-json",
    closeBundle() {
      const outDir = "dist";
      const version = buildVersion ?? new Date().toISOString().slice(0, 19).replace("T", " ");
      try {
        writeFileSync(
          path.join(process.cwd(), outDir, "version.json"),
          JSON.stringify({ version })
        );
      } catch (_e) {
        /* ignore if dist not present (e.g. dev) */
      }
    },
  });
  return plugins.filter(Boolean);
}

export default defineConfig(async ({ mode }) => {
  /** Bei jedem Build neu: Zeitstempel für Einstellungen und version.json (Railway/CI) */
  const APP_BUILD_TIME = new Date().toISOString().slice(0, 19).replace("T", " ");
  const APP_VERSION = APP_BUILD_TIME;

  return {
  define: {
    __APP_BUILD_TIME__: JSON.stringify(APP_BUILD_TIME),
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: await getPlugins(mode, APP_VERSION),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["@radix-ui/react-slider"],
  },
  build: {
    minify: "terser",
    terserOptions: {
      mangle: false, // TDZ fix: variable renaming causes "Cannot access X before initialization"
      compress: { dead_code: true, drop_console: false },
      format: { comments: false },
    },
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        /* manualChunks disabled — caused "Cannot access 'd' before initialization" on Settings
           (chunk init order / circular deps). Rollup auto-chunking avoids TDZ. */
        // manualChunks: { ... },
      },
    },
  },
  };
});
