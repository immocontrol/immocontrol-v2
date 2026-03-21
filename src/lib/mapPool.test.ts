import { describe, it, expect } from "vitest";
import { mapPool } from "./mapPool";

describe("mapPool", () => {
  it("preserves result order with concurrency", async () => {
    const r = await mapPool([1, 2, 3, 4], 2, async (x) => x * 2);
    expect(r).toEqual([2, 4, 6, 8]);
  });

  it("handles empty input", async () => {
    expect(await mapPool([], 3, async () => 1)).toEqual([]);
  });

  it("propagates errors from mapper", async () => {
    await expect(
      mapPool([1, 2, 3], 2, async (x) => {
        if (x === 2) throw new Error("fail");
        return x;
      })
    ).rejects.toThrow("fail");
  });

  it("respects concurrency limit", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    await mapPool([1, 2, 3, 4], 2, async (x) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      return x;
    });
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
