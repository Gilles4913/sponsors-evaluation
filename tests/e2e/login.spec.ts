import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should display login form', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByTestId('login-password')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('login-email').fill('invalid@example.com');
    await page.getByTestId('login-password').fill('wrongpassword');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('login-email').fill('admin@example.com');
    await page.getByTestId('login-password').fill('password123');
    await page.getByTestId('login-submit').click();

    await page.waitForURL('**/club', { timeout: 10000 });

    await expect(page.url()).toContain('/club');
  });
});
