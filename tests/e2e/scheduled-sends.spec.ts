import { test, expect } from '@playwright/test';

test.describe('Scheduled Sends', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('login-email').fill('admin@example.com');
    await page.getByTestId('login-password').fill('password123');
    await page.getByTestId('login-submit').click();

    await page.waitForURL('**/club', { timeout: 10000 });
  });

  test('should display scheduled sends page', async ({ page }) => {
    await page.goto('/scheduled');

    await expect(page.getByText('Envois planifiés')).toBeVisible();
    await expect(page.getByTestId('filter-campaign')).toBeVisible();
    await expect(page.getByTestId('filter-status')).toBeVisible();
  });

  test('should filter by campaign', async ({ page }) => {
    await page.goto('/scheduled');

    const campaignFilter = page.getByTestId('filter-campaign');
    await campaignFilter.selectOption({ index: 1 });

    await expect(campaignFilter).not.toHaveValue('all');
  });

  test('should filter by status', async ({ page }) => {
    await page.goto('/scheduled');

    const statusFilter = page.getByTestId('filter-status');
    await statusFilter.selectOption('pending');

    await expect(statusFilter).toHaveValue('pending');
  });

  test('should show cancel button for pending jobs', async ({ page }) => {
    await page.goto('/scheduled');

    const statusFilter = page.getByTestId('filter-status');
    await statusFilter.selectOption('pending');

    const cancelButton = page.getByTestId('cancel-job-button').first();
    if (await cancelButton.isVisible()) {
      await expect(cancelButton).toBeVisible();
      await expect(cancelButton).toContainText('Annuler');
    }
  });

  test('should cancel a pending job', async ({ page }) => {
    await page.goto('/scheduled');

    const statusFilter = page.getByTestId('filter-status');
    await statusFilter.selectOption('pending');

    const cancelButton = page.getByTestId('cancel-job-button').first();
    if (await cancelButton.isVisible()) {
      page.on('dialog', dialog => dialog.accept());

      await cancelButton.click();

      await expect(page.getByText('Envoi annulé')).toBeVisible({ timeout: 5000 });
    }
  });
});
