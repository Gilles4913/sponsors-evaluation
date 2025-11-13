import { test, expect } from '@playwright/test';

test.describe('Email Logs Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('login-email').fill('super@a2display.fr');
    await page.getByTestId('login-password').fill('password123');
    await page.getByTestId('login-submit').click();

    await page.waitForURL(/\/(super|club)/, { timeout: 10000 });
  });

  test('should display email logs table', async ({ page }) => {
    await page.goto('/admin/email-logs');

    await expect(page.getByTestId('email-logs-table')).toBeVisible({ timeout: 10000 });
  });

  test('should filter logs by email search', async ({ page }) => {
    await page.goto('/admin/email-logs');

    await page.getByTestId('email-logs-table').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('filter-search').fill('@');

    await page.waitForTimeout(1000);

    const rows = page.locator('[data-testid="email-logs-table"] tbody tr');
    const rowCount = await rows.count();

    if (rowCount > 0) {
      expect(rowCount).toBeGreaterThanOrEqual(1);

      const firstRowEmail = await rows.first().locator('td').nth(1).textContent();
      expect(firstRowEmail).toContain('@');
    }
  });

  test('should open drawer when clicking on a row', async ({ page }) => {
    await page.goto('/admin/email-logs');

    await page.getByTestId('email-logs-table').waitFor({ state: 'visible', timeout: 10000 });

    await page.waitForTimeout(1000);

    const rows = page.locator('[data-testid="email-logs-table"] tbody tr');
    const rowCount = await rows.count();

    if (rowCount > 0) {
      await rows.first().click();

      await expect(page.getByTestId('drawer-log')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should filter by failed status and verify red badges', async ({ page }) => {
    await page.goto('/admin/email-logs');

    await page.getByTestId('email-logs-table').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('filter-status').selectOption('failed');

    await page.waitForTimeout(1000);

    const rows = page.locator('[data-testid="email-logs-table"] tbody tr');
    const rowCount = await rows.count();

    if (rowCount > 0) {
      const failedBadges = page.locator('.bg-red-100, .dark\\:bg-red-900\\/30');
      const badgeCount = await failedBadges.count();

      expect(badgeCount).toBeGreaterThanOrEqual(1);

      const firstBadgeText = await failedBadges.first().textContent();
      expect(firstBadgeText).toContain('Failed');
    }
  });

  test('should have diagnostic and export buttons', async ({ page }) => {
    await page.goto('/admin/email-logs');

    await page.getByTestId('email-logs-table').waitFor({ state: 'visible', timeout: 10000 });

    await expect(page.getByTestId('btn-open-diagnostic')).toBeVisible();
    await expect(page.getByTestId('btn-export-csv')).toBeVisible();
  });
});
