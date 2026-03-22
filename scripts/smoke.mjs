#!/usr/bin/env node
/**
 * Post-Deploy Smoke: prüft, ob die gebaute App unter einer URL erreichbar ist.
 * Nutzung: npm run smoke -- https://example.com
 * Oder: SMOKE_URL=https://example.com npm run smoke
 */
const baseArg = process.argv[2]?.trim();
const fromEnv = typeof process.env.SMOKE_URL === "string" ? process.env.SMOKE_URL.trim() : "";
const base = (baseArg || fromEnv || "http://127.0.0.1:4173").replace(/\/$/, "");

async function check(path, { method = "GET" } = {}) {
  const url = `${base}${path}`;
  const res = await fetch(url, { method, redirect: "follow" });
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}`);
  return res;
}

try {
  await check("/");
  process.stdout.write(`smoke OK: ${base}/\n`);
  try {
    const r = await check("/version.json");
    const j = await r.json();
    process.stdout.write(`version.json: ${JSON.stringify(j)}\n`);
  } catch {
    process.stdout.write("(optional) version.json nicht lesbar — ignorieren\n");
  }
  process.exit(0);
} catch (e) {
  process.stderr.write(`smoke FAILED: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
}
