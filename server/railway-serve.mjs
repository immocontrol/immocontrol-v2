#!/usr/bin/env node
/**
 * Minimal static server for Railway (and local preview): serves dist/ with
 * Cache-Control headers for /version.json and /index.html (redeploy-safe updates).
 * No extra dependencies — Node built-ins only.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..", "dist");
const PORT = Number(process.env.PORT) || 8080;

const NO_CACHE = "no-store, no-cache, must-revalidate";
const NO_CACHE_HTML = "no-cache, must-revalidate";

const MIMES = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".js": "application/javascript",
  ".css": "text/css",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

createServer(async (req, res) => {
  const pathname = new URL(req.url || "/", "http://x").pathname;

  /* Health check for Railway (and load balancers) — must return 200 */
  if (pathname === "/health" || pathname === "/api/health") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const path = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(ROOT, path.replace(/^\//, "").replace(/\.\./g, ""));
  if (!filePath.startsWith(ROOT)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.setHeader("Content-Type", MIMES[ext] || "application/octet-stream");
    if (path === "/version.json" || path.endsWith("/version.json")) {
      res.setHeader("Cache-Control", NO_CACHE);
    } else if (path === "/index.html" || path.endsWith("/index.html")) {
      res.setHeader("Cache-Control", NO_CACHE_HTML);
    } else if (path.startsWith("/assets/") && /[.-][a-f0-9]{8,}\.(js|css)$/i.test(path)) {
      /* Hashed assets (Vite): immutable, long cache */
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
    res.end(data);
  } catch (err) {
    if (err.code === "ENOENT") {
      try {
        const index = await readFile(join(ROOT, "index.html"));
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", NO_CACHE_HTML);
        res.end(index);
        return;
      } catch {
        res.statusCode = 404;
        res.end("Not Found");
        return;
      }
    }
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Serving dist at http://0.0.0.0:${PORT}`);
});
