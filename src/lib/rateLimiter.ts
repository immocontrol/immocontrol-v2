/**
 * IMP-9: Client-side rate limiter to prevent retry storms.
 * Used for Telegram polling, AI chat requests, and other API calls.
 */

interface RateLimiterOptions {
  /** Maximum number of requests in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Backoff multiplier on consecutive failures (default: 2) */
  backoffMultiplier?: number;
  /** Maximum backoff delay in ms (default: 60000) */
  maxBackoffMs?: number;
}

interface RateLimiterState {
  timestamps: number[];
  consecutiveFailures: number;
  backoffUntil: number;
}

export class RateLimiter {
  private state: RateLimiterState;
  private options: Required<RateLimiterOptions>;

  constructor(options: RateLimiterOptions) {
    this.options = {
      backoffMultiplier: 2,
      maxBackoffMs: 60_000,
      ...options,
    };
    this.state = {
      timestamps: [],
      consecutiveFailures: 0,
      backoffUntil: 0,
    };
  }

  /** Returns true if the request can proceed */
  canProceed(): boolean {
    const now = Date.now();

    // Check backoff
    if (now < this.state.backoffUntil) return false;

    // Clean old timestamps
    this.state.timestamps = this.state.timestamps.filter(
      (t) => now - t < this.options.windowMs
    );

    return this.state.timestamps.length < this.options.maxRequests;
  }

  /** Record a successful request */
  recordSuccess(): void {
    this.state.timestamps.push(Date.now());
    this.state.consecutiveFailures = 0;
    this.state.backoffUntil = 0;
  }

  /** Record a failed request and apply exponential backoff */
  recordFailure(): void {
    this.state.timestamps.push(Date.now());
    this.state.consecutiveFailures += 1;

    const backoffDelay = Math.min(
      1000 * Math.pow(this.options.backoffMultiplier, this.state.consecutiveFailures),
      this.options.maxBackoffMs
    );
    this.state.backoffUntil = Date.now() + backoffDelay;
  }

  /** Reset the rate limiter state */
  reset(): void {
    this.state = {
      timestamps: [],
      consecutiveFailures: 0,
      backoffUntil: 0,
    };
  }

  /** Get remaining time until next allowed request (0 if can proceed) */
  getWaitTime(): number {
    if (this.canProceed()) return 0;
    const now = Date.now();
    if (now < this.state.backoffUntil) {
      return this.state.backoffUntil - now;
    }
    // Window-based wait: time until oldest timestamp expires
    const oldest = this.state.timestamps[0];
    if (oldest) return this.options.windowMs - (now - oldest);
    return 0;
  }
}

/** Pre-configured rate limiters for common use cases */
export const rateLimiters = {
  /** Telegram polling: max 20 requests per minute */
  telegram: new RateLimiter({ maxRequests: 20, windowMs: 60_000, maxBackoffMs: 120_000 }),
  /** AI chat: max 10 requests per minute */
  aiChat: new RateLimiter({ maxRequests: 10, windowMs: 60_000, maxBackoffMs: 30_000 }),
  /** Generic API: max 30 requests per minute */
  api: new RateLimiter({ maxRequests: 30, windowMs: 60_000 }),
};
