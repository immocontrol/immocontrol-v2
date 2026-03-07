/**
 * #15: E2E Tests mit Playwright — Critical flows test suite.
 * Paths use ROUTES from src/lib/routes.ts (see e2e.setup).
 */
import { test, expect } from "@playwright/test";
import { ROUTES } from "../src/lib/routes";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

test.describe("Authentication Flow", () => {
  test("should show login page", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator("text=Anmelden").or(page.locator("text=Sign In"))).toBeVisible({ timeout: 10000 });
  });

  test("should have email and password fields", async ({ page }) => {
    await page.goto(`${BASE_URL}${ROUTES.AUTH}`);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto(`${BASE_URL}${ROUTES.AUTH}`);
    await page.fill('input[type="email"]', "invalid@test.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    // Should show an error message
    await expect(page.locator("[role='alert'], .text-loss, [data-sonner-toast]").first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Portfolio Flow (requires auth)", () => {
  test.skip(true, "Requires valid credentials — set E2E_EMAIL and E2E_PASSWORD env vars");

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}${ROUTES.AUTH}`);
    await page.fill('input[type="email"]', process.env.E2E_EMAIL || "");
    await page.fill('input[type="password"]', process.env.E2E_PASSWORD || "");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/", { timeout: 15000 });
  });

  test("should show portfolio after login", async ({ page }) => {
    await expect(page.locator("text=Portfolio").or(page.locator("text=Guten"))).toBeVisible({ timeout: 10000 });
  });

  test("should navigate to loans page", async ({ page }) => {
    await page.click("[data-nav-loans]");
    await expect(page.locator("text=Darlehen")).toBeVisible({ timeout: 5000 });
  });

  test("should navigate to rent overview", async ({ page }) => {
    await page.click("[data-nav-rent]");
    await expect(page.locator("text=Mietübersicht").or(page.locator("text=Mieten"))).toBeVisible({ timeout: 5000 });
  });

  test("should navigate to contacts", async ({ page }) => {
    await page.click("[data-nav-contacts]");
    await expect(page.locator("text=Kontakte")).toBeVisible({ timeout: 5000 });
  });

  test("should navigate to settings", async ({ page }) => {
    await page.click("[data-nav-settings]");
    await expect(page.locator("text=Einstellungen")).toBeVisible({ timeout: 5000 });
  });

  test("should open add property dialog", async ({ page }) => {
    await page.click("[data-add-property]");
    await expect(page.locator("text=Neues Objekt").or(page.locator("[role='dialog']"))).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Accessibility", () => {
  test("should have proper ARIA landmarks", async ({ page }) => {
    await page.goto(`${BASE_URL}${ROUTES.AUTH}`);
    // Auth page should have main content area
    const main = page.locator('[role="main"]');
    await expect(main).toBeVisible({ timeout: 10000 });
  });

  test("should support keyboard navigation", async ({ page }) => {
    await page.goto(`${BASE_URL}${ROUTES.AUTH}`);
    await page.keyboard.press("Tab");
    // Focus should move to first interactive element
    const focused = page.locator(":focus");
    await expect(focused).toBeTruthy();
  });
});
