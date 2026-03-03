/**
 * useRetry — hook for retrying failed async operations with exponential backoff.
 * Improvement 7: Retry logic for Supabase calls and other async operations.
 */
import { useState, useCallback, useRef } from "react";

interface RetryOptions {
  /** Maximum number of retries (default: 3) */
  maxRetries?: number;
  /** Base delay in ms before first retry (default: 1000) */
  baseDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffFactor?: number;
  /** Called on each retry attempt */
  onRetry?: (attempt: number, error: unknown) => void;
  /** Called when all retries are exhausted */
  onExhausted?: (error: unknown) => void;
}

interface RetryState<T> {
  data: T | null;
  error: unknown;
  isLoading: boolean;
  attempt: number;
  execute: (...args: unknown[]) => Promise<T | null>;
  reset: () => void;
}

export function useRetry<T>(
  fn: (...args: unknown[]) => Promise<T>,
  options: RetryOptions = {},
): RetryState<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    backoffFactor = 2,
    onRetry,
    onExhausted,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const abortRef = useRef(false);

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      abortRef.current = false;
      setIsLoading(true);
      setError(null);
      setAttempt(0);

      for (let i = 0; i <= maxRetries; i++) {
        if (abortRef.current) break;
        setAttempt(i);

        try {
          const result = await fn(...args);
          setData(result);
          setIsLoading(false);
          return result;
        } catch (err) {
          if (i < maxRetries) {
            onRetry?.(i + 1, err);
            const delay = baseDelay * Math.pow(backoffFactor, i);
            await new Promise((r) => setTimeout(r, delay));
          } else {
            setError(err);
            onExhausted?.(err);
          }
        }
      }

      setIsLoading(false);
      return null;
    },
    [fn, maxRetries, baseDelay, backoffFactor, onRetry, onExhausted],
  );

  const reset = useCallback(() => {
    abortRef.current = true;
    setData(null);
    setError(null);
    setIsLoading(false);
    setAttempt(0);
  }, []);

  return { data, error, isLoading, attempt, execute, reset };
}
