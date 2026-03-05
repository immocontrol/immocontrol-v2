/**
 * FUND-12: Rate limiting for external API calls — prevents redundant requests
 * on fast tab switches and protects against abuse of Nominatim, ECB, RSS feeds.
 */
import { RateLimiter } from "@/lib/rateLimiter";

/** Pre-configured rate limiters for external APIs */
export const externalRateLimiters = {
  /** Nominatim geocoding: max 1 request per second (OSM policy) */
  nominatim: new RateLimiter({ maxRequests: 1, windowMs: 1100, maxBackoffMs: 5_000 }),
  /** ECB interest rate API: max 5 requests per minute */
  ecb: new RateLimiter({ maxRequests: 5, windowMs: 60_000, maxBackoffMs: 30_000 }),
  /** Bundesbank API: max 5 requests per minute */
  bundesbank: new RateLimiter({ maxRequests: 5, windowMs: 60_000, maxBackoffMs: 30_000 }),
  /** RSS feed fetching: max 10 per minute */
  rssFeed: new RateLimiter({ maxRequests: 10, windowMs: 60_000, maxBackoffMs: 15_000 }),
  /** AllOrigins CORS proxy: max 15 per minute */
  corsProxy: new RateLimiter({ maxRequests: 15, windowMs: 60_000, maxBackoffMs: 10_000 }),
};

/**
 * FUND-12: Rate-limited fetch wrapper for external APIs.
 * Checks the rate limiter before executing and tracks success/failure.
 */
export async function rateLimitedFetch(
  limiter: RateLimiter,
  url: string,
  init?: RequestInit,
  label = "API",
): Promise<Response> {
  if (!limiter.canProceed()) {
    const waitMs = limiter.getWaitTime();
    throw new Error(
      `Rate limit erreicht für ${label}. Bitte ${Math.ceil(waitMs / 1000)}s warten.`,
    );
  }
  try {
    const response = await fetch(url, init);
    limiter.recordSuccess();
    return response;
  } catch (err) {
    limiter.recordFailure();
    throw err;
  }
}

/**
 * FUND-12: Deduplicated fetch — prevents identical requests from executing
 * in parallel (e.g. on fast tab switch). Returns the same promise for
 * duplicate in-flight requests.
 */
const inflightRequests = new Map<string, Promise<Response>>();

export async function deduplicatedFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const key = `${init?.method ?? "GET"}:${url}`;
  const existing = inflightRequests.get(key);
  if (existing) return existing.then((r) => r.clone());

  const promise = fetch(url, init).finally(() => {
    inflightRequests.delete(key);
  });

  inflightRequests.set(key, promise);
  // Return a clone so the cached original can be cloned again for future callers
  return promise.then((r) => r.clone());
}
