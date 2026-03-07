/**
 * FUND-27: E2E test setup (Playwright) — provides test fixtures,
 * helper utilities, and base configuration for end-to-end testing.
 *
 * FUND-28: Visual regression test setup — screenshot comparison
 * utilities for detecting unintended UI changes.
 *
 * Paths aligned with src/lib/routes.ts (ROUTES) as single source of truth.
 */
import { ROUTES } from "@/lib/routes";

/**
 * FUND-27: E2E test helper — login to the app.
 */
export async function login(
  page: { goto: (url: string) => Promise<void>; fill: (selector: string, value: string) => Promise<void>; click: (selector: string) => Promise<void>; waitForURL: (url: string | RegExp) => Promise<void> },
  email: string,
  password: string,
  baseUrl = "http://localhost:5173",
) {
  await page.goto(`${baseUrl}${ROUTES.AUTH}`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url: URL) => url.pathname === ROUTES.HOME || url.pathname === ROUTES.PERSONAL_DASHBOARD);
}

/**
 * FUND-27: Common test selectors for the app.
 */
export const SELECTORS = {
  // Navigation
  sidebar: '[data-testid="sidebar"]',
  topNav: '[data-testid="top-nav"]',
  mobileMenu: '[data-testid="mobile-menu"]',

  // Auth
  loginForm: '[data-testid="login-form"]',
  emailInput: 'input[type="email"]',
  passwordInput: 'input[type="password"]',
  submitButton: 'button[type="submit"]',

  // Dashboard
  dashboardStats: '[data-testid="dashboard-stats"]',
  dashboardCharts: '[data-testid="dashboard-charts"]',
  widgetGrid: '[data-testid="widget-grid"]',

  // Properties
  propertyList: '[data-testid="property-list"]',
  propertyCard: '[data-testid="property-card"]',
  addPropertyButton: '[data-testid="add-property"]',

  // Common
  loadingSpinner: '[data-testid="loading"]',
  emptyState: '[data-testid="empty-state"]',
  toast: '[data-sonner-toast]',
  dialog: '[role="dialog"]',
  dialogClose: '[data-testid="dialog-close"]',
} as const;

/**
 * FUND-27: Test data generators.
 */
export function generateTestProperty() {
  return {
    name: `Test Immobilie ${Date.now()}`,
    address: "Teststraße 1, 10115 Berlin",
    purchasePrice: 250000,
    currentValue: 280000,
    monthlyRent: 850,
    monthlyExpenses: 180,
    sqm: 65,
    rooms: 3,
    yearBuilt: 1990,
  };
}

export function generateTestTenant() {
  return {
    name: `Test Mieter ${Date.now()}`,
    email: `test-${Date.now()}@example.com`,
    phone: "+49 170 1234567",
    monthlyRent: 850,
    depositAmount: 2550,
    moveInDate: "2024-01-01",
  };
}

export function generateTestLoan() {
  return {
    bankName: "Test Bank AG",
    loanAmount: 200000,
    interestRate: 3.5,
    monthlyPayment: 950,
    startDate: "2024-01-01",
    fixedInterestEndDate: "2034-01-01",
    tilgungssatz: 2.0,
  };
}

/**
 * FUND-28: Visual regression test utilities.
 */
export const VISUAL_REGRESSION_CONFIG = {
  /** Directory to store baseline screenshots */
  baselineDir: "tests/screenshots/baseline",
  /** Directory to store current screenshots */
  currentDir: "tests/screenshots/current",
  /** Directory to store diff images */
  diffDir: "tests/screenshots/diff",
  /** Maximum allowed pixel difference percentage */
  threshold: 0.1,
  /** Pages to capture for visual regression — paths from ROUTES */
  pages: [
    { name: "login", path: ROUTES.AUTH },
    { name: "dashboard", path: ROUTES.PERSONAL_DASHBOARD, requiresAuth: true },
    { name: "home", path: ROUTES.HOME, requiresAuth: true },
    { name: "properties", path: ROUTES.OBJEKTE, requiresAuth: true },
    { name: "loans", path: ROUTES.LOANS, requiresAuth: true },
    { name: "deals", path: ROUTES.DEALS, requiresAuth: true },
    { name: "contacts", path: ROUTES.CONTACTS, requiresAuth: true },
    { name: "todos", path: ROUTES.TODOS, requiresAuth: true },
    { name: "settings", path: ROUTES.SETTINGS, requiresAuth: true },
  ],
  /** Viewports to test */
  viewports: [
    { name: "mobile", width: 375, height: 812 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ],
};

/**
 * FUND-28: Screenshot comparison helper.
 * In a real setup this would use pixelmatch or similar.
 */
export function getScreenshotPath(
  pageName: string,
  viewport: string,
  type: "baseline" | "current" | "diff",
): string {
  const dir = type === "baseline"
    ? VISUAL_REGRESSION_CONFIG.baselineDir
    : type === "current"
    ? VISUAL_REGRESSION_CONFIG.currentDir
    : VISUAL_REGRESSION_CONFIG.diffDir;
  return `${dir}/${pageName}-${viewport}.png`;
}
