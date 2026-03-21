/**
 * Run async work on items with at most `limit` concurrent executions (order preserved).
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const n = items.length;
  if (n === 0) return [];
  const out: R[] = new Array(n);
  let next = 0;
  const cap = Math.min(Math.max(1, limit), n);

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= n) break;
      out[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: cap }, () => worker()));
  return out;
}
