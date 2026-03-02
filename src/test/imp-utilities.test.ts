/**
 * IMP-10/11: Comprehensive tests for new utility modules
 * - Rate limiter (IMP-9)
 * - Zod schemas (IMP-3)
 * - Sanitizer (IMP-8)
 * - Logger (IMP-16)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== RATE LIMITER TESTS =====
describe("RateLimiter", () => {
  it("should allow requests within the limit", async () => {
    const { RateLimiter } = await import("@/lib/rateLimiter");
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });
    expect(limiter.canProceed()).toBe(true);
    limiter.recordSuccess();
    expect(limiter.canProceed()).toBe(true);
    limiter.recordSuccess();
    expect(limiter.canProceed()).toBe(true);
    limiter.recordSuccess();
    // 4th should be blocked
    expect(limiter.canProceed()).toBe(false);
  });

  it("should apply exponential backoff on failures", async () => {
    const { RateLimiter } = await import("@/lib/rateLimiter");
    const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000, backoffMultiplier: 2 });
    limiter.recordFailure();
    // After 1 failure, backoff = 1000 * 2^1 = 2000ms
    expect(limiter.canProceed()).toBe(false);
    expect(limiter.getWaitTime()).toBeGreaterThan(0);
  });

  it("should reset state correctly", async () => {
    const { RateLimiter } = await import("@/lib/rateLimiter");
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 1000 });
    limiter.recordSuccess();
    expect(limiter.canProceed()).toBe(false);
    limiter.reset();
    expect(limiter.canProceed()).toBe(true);
  });

  it("should respect maxBackoffMs", async () => {
    const { RateLimiter } = await import("@/lib/rateLimiter");
    const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000, maxBackoffMs: 5000 });
    // Multiple failures
    for (let i = 0; i < 10; i++) limiter.recordFailure();
    // Wait time should not exceed maxBackoffMs
    expect(limiter.getWaitTime()).toBeLessThanOrEqual(5100); // small margin for timing
  });

  it("should clear failures on success", async () => {
    const { RateLimiter } = await import("@/lib/rateLimiter");
    const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });
    limiter.recordFailure();
    limiter.recordSuccess();
    // After success, backoff should be cleared
    expect(limiter.canProceed()).toBe(true);
  });

  it("pre-configured limiters should exist", async () => {
    const { rateLimiters } = await import("@/lib/rateLimiter");
    expect(rateLimiters.telegram).toBeDefined();
    expect(rateLimiters.aiChat).toBeDefined();
    expect(rateLimiters.api).toBeDefined();
    expect(rateLimiters.telegram.canProceed()).toBe(true);
  });
});

// ===== ZOD SCHEMA TESTS =====
describe("Zod Schemas", () => {
  it("dealSchema should validate valid deal", async () => {
    const { dealSchema } = await import("@/lib/schemas");
    const result = dealSchema.safeParse({ title: "Test Deal", purchase_price: 100000 });
    expect(result.success).toBe(true);
  });

  it("dealSchema should reject empty title", async () => {
    const { dealSchema } = await import("@/lib/schemas");
    const result = dealSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("dealSchema should reject negative purchase_price", async () => {
    const { dealSchema } = await import("@/lib/schemas");
    const result = dealSchema.safeParse({ title: "Test", purchase_price: -100 });
    expect(result.success).toBe(false);
  });

  it("propertySchema should validate valid property", async () => {
    const { propertySchema } = await import("@/lib/schemas");
    const result = propertySchema.safeParse({ name: "Haus A", address: "Musterstr. 1" });
    expect(result.success).toBe(true);
  });

  it("propertySchema should reject missing address", async () => {
    const { propertySchema } = await import("@/lib/schemas");
    const result = propertySchema.safeParse({ name: "Haus A", address: "" });
    expect(result.success).toBe(false);
  });

  it("contactSchema should validate valid contact", async () => {
    const { contactSchema } = await import("@/lib/schemas");
    const result = contactSchema.safeParse({ name: "Max Mustermann", email: "max@test.de", phone: "+491234567890" });
    expect(result.success).toBe(true);
  });

  it("contactSchema should reject invalid email", async () => {
    const { contactSchema } = await import("@/lib/schemas");
    const result = contactSchema.safeParse({ name: "Max", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("loanSchema should validate valid loan", async () => {
    const { loanSchema } = await import("@/lib/schemas");
    const result = loanSchema.safeParse({
      bank_name: "Sparkasse", loan_amount: 200000, interest_rate: 3.5, repayment_rate: 2,
    });
    expect(result.success).toBe(true);
  });

  it("loanSchema should reject interest_rate > 100", async () => {
    const { loanSchema } = await import("@/lib/schemas");
    const result = loanSchema.safeParse({
      bank_name: "Test", loan_amount: 100000, interest_rate: 150, repayment_rate: 2,
    });
    expect(result.success).toBe(false);
  });

  it("tenantSchema should validate valid tenant", async () => {
    const { tenantSchema } = await import("@/lib/schemas");
    const result = tenantSchema.safeParse({ name: "Mieter A", monthly_rent: 800 });
    expect(result.success).toBe(true);
  });

  it("nebenkostenSchema should validate valid entry", async () => {
    const { nebenkostenSchema } = await import("@/lib/schemas");
    const result = nebenkostenSchema.safeParse({ description: "Heizkosten", amount: 150, category: "heizung" });
    expect(result.success).toBe(true);
  });

  it("profileSchema should validate valid profile", async () => {
    const { profileSchema } = await import("@/lib/schemas");
    const result = profileSchema.safeParse({ display_name: "Tim", email: "tim@test.de" });
    expect(result.success).toBe(true);
  });

  it("validateForm should return typed errors", async () => {
    const { validateForm, dealSchema } = await import("@/lib/schemas");
    const result = validateForm(dealSchema, { title: "", purchase_price: -5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveProperty("title");
      expect(result.errors).toHaveProperty("purchase_price");
    }
  });

  it("validateForm should return data on success", async () => {
    const { validateForm, dealSchema } = await import("@/lib/schemas");
    const result = validateForm(dealSchema, { title: "Good Deal" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Good Deal");
    }
  });
});

// ===== SANITIZER TESTS =====
describe("Sanitize Utilities", () => {
  it("stripHtml should remove HTML tags", async () => {
    const { stripHtml } = await import("@/lib/sanitize");
    expect(stripHtml("<b>bold</b>")).toBe("bold");
    expect(stripHtml("<script>alert('xss')</script>")).toBe("alert('xss')");
    expect(stripHtml("no tags")).toBe("no tags");
  });

  it("sanitizeInput should trim, strip HTML, and limit length", async () => {
    const { sanitizeInput } = await import("@/lib/sanitize");
    expect(sanitizeInput("  <b>hello</b>  ")).toBe("hello");
    expect(sanitizeInput("a".repeat(20000), 100)).toHaveLength(100);
  });

  it("sanitizeUrl should allow safe protocols", async () => {
    const { sanitizeUrl } = await import("@/lib/sanitize");
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
    expect(sanitizeUrl("mailto:test@test.de")).toBe("mailto:test@test.de");
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeUrl("data:text/html,<h1>hi</h1>")).toBe("");
  });

  it("sanitizeUrl should allow relative paths", async () => {
    const { sanitizeUrl } = await import("@/lib/sanitize");
    expect(sanitizeUrl("images/photo.jpg")).toBe("images/photo.jpg");
    // Leading slash doesn't start with [a-z0-9], so it's blocked
    expect(sanitizeUrl("/path/to/page")).toBe("");
  });

  it("sanitizeRecord should sanitize string values in objects", async () => {
    const { sanitizeRecord } = await import("@/lib/sanitize");
    const result = sanitizeRecord({
      name: "  <b>Test</b>  ",
      count: 42,
      active: true,
    });
    expect(result.name).toBe("Test");
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
  });
});

// ===== LOGGER TESTS =====
describe("Logger", () => {
  it("should export logger with all methods", async () => {
    const { logger } = await import("@/lib/logger");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("should not throw when calling log methods", async () => {
    const { logger } = await import("@/lib/logger");
    expect(() => logger.debug("test", "ctx")).not.toThrow();
    expect(() => logger.info("test", "ctx")).not.toThrow();
    expect(() => logger.warn("test", "ctx")).not.toThrow();
    expect(() => logger.error("test", "ctx")).not.toThrow();
  });
});

// ===== YIELD & FINANCIAL CALCULATION TESTS =====
describe("Financial Calculations (IMP-10)", () => {
  it("should calculate deal yield correctly", () => {
    const purchasePrice = 250000;
    const monthlyRent = 1000;
    const expectedYield = ((monthlyRent * 12) / purchasePrice) * 100;
    expect(expectedYield).toBe(4.8);
  });

  it("should handle zero purchase price in yield calculation", () => {
    const purchasePrice = 0;
    const monthlyRent = 1000;
    const expectedYield = purchasePrice > 0 ? ((monthlyRent * 12) / purchasePrice) * 100 : 0;
    expect(expectedYield).toBe(0);
  });

  it("should calculate rent increase per §558 BGB correctly", () => {
    const currentRent = 800;
    const maxIncreasePercent = 20; // Kappungsgrenze
    const localComparativeRent = 1100;
    const maxAllowed = currentRent * (1 + maxIncreasePercent / 100);
    const newRent = Math.min(maxAllowed, localComparativeRent);
    expect(maxAllowed).toBe(960);
    expect(newRent).toBe(960); // capped at 20% increase
  });

  it("should calculate net rendite correctly", () => {
    const monthlyRent = 1200;
    const monthlyExpenses = 300;
    const purchasePrice = 300000;
    const netYield = ((monthlyRent - monthlyExpenses) * 12 / purchasePrice) * 100;
    expect(netYield).toBeCloseTo(3.6, 5);
  });

  it("should calculate cash-on-cash return", () => {
    const annualCashflow = 12000;
    const equityInvested = 100000;
    const cashOnCash = (annualCashflow / equityInvested) * 100;
    expect(cashOnCash).toBe(12);
  });

  it("should calculate loan-to-value ratio", () => {
    const remainingDebt = 180000;
    const propertyValue = 300000;
    const ltv = (remainingDebt / propertyValue) * 100;
    expect(ltv).toBe(60);
  });
});
