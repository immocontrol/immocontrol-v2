import { describe, it, expect, afterEach } from "vitest";
import { isFeatureEnabled } from "./featureFlags";

describe("isFeatureEnabled", () => {
  const env = import.meta.env as Record<string, string | boolean | undefined>;

  afterEach(() => {
    delete env.VITE_FEATURE_TEST_FLAG;
    delete env.VITE_FEATURE_MY_BETA;
  });

  it("returns false when env unset", () => {
    expect(isFeatureEnabled("TEST_FLAG")).toBe(false);
  });

  it("returns true for string true or 1", () => {
    env.VITE_FEATURE_TEST_FLAG = "true";
    expect(isFeatureEnabled("TEST_FLAG")).toBe(true);
    env.VITE_FEATURE_TEST_FLAG = "1";
    expect(isFeatureEnabled("TEST_FLAG")).toBe(true);
  });

  it("maps name with hyphen to underscore env key", () => {
    env.VITE_FEATURE_MY_BETA = "true";
    expect(isFeatureEnabled("MY-BETA")).toBe(true);
  });
});
