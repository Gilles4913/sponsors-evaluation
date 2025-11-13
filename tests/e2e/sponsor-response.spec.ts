import { test, expect } from '@playwright/test';

test.describe('Sponsor Response Flow', () => {
  test.describe('Accessibility', () => {
    test('should have proper ARIA labels and roles', async ({ page }) => {
      await page.goto('/response/test-token');

      const form = page.locator('form');
      await expect(form).toBeVisible();

      const amountInput = page.locator('#amount');
      await expect(amountInput).toHaveAttribute('aria-required', 'true');
      await expect(amountInput).toHaveAttribute('aria-describedby');

      const consentCheckbox = page.locator('#consent');
      await expect(consentCheckbox).toHaveAttribute('aria-required', 'true');
      await expect(consentCheckbox).toHaveAttribute('aria-describedby', 'consent-text');
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/response/test-token');

      await page.keyboard.press('Tab');

      const firstFocusable = page.locator(':focus');
      await expect(firstFocusable).toBeVisible();

      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        const focused = page.locator(':focus');
        await expect(focused).toBeVisible();
      }
    });

    test('should have visible focus indicators', async ({ page }) => {
      await page.goto('/response/test-token');

      const submitButton = page.getByRole('button', { name: /envoyer ma réponse/i });
      await submitButton.focus();

      const focusedButton = await submitButton.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          boxShadow: styles.boxShadow,
        };
      });

      expect(focusedButton.outline !== 'none' || focusedButton.boxShadow !== 'none').toBeTruthy();
    });
  });

  test.describe('Form Validation', () => {
    test('should validate amount field when status is yes', async ({ page }) => {
      await page.goto('/response/test-token');

      const yesButton = page.getByRole('button', { name: 'Oui' });
      await yesButton.click();

      const amountInput = page.locator('#amount');
      await expect(amountInput).toBeVisible();

      await amountInput.fill('-100');
      await amountInput.blur();

      const errorMessage = page.locator('#amount-error');
      await expect(errorMessage).toBeVisible();
    });

    test('should show character count for comment field', async ({ page }) => {
      await page.goto('/response/test-token');

      const commentField = page.locator('#comment');
      await commentField.fill('Test comment');

      const hint = page.locator('#comment-hint');
      await expect(hint).toContainText('restants');
    });

    test('should validate comment length', async ({ page }) => {
      await page.goto('/response/test-token');

      const commentField = page.locator('#comment');
      const longComment = 'a'.repeat(501);
      await commentField.fill(longComment);
      await commentField.blur();

      const errorMessage = page.locator('#comment-error');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('500 caractères');
    });

    test('should require consent checkbox', async ({ page }) => {
      await page.goto('/response/test-token');

      const submitButton = page.getByRole('button', { name: /envoyer ma réponse/i });
      await expect(submitButton).toBeDisabled();

      const consentCheckbox = page.locator('#consent');
      await consentCheckbox.check();

      await expect(submitButton).toBeEnabled();
    });
  });

  test.describe('User Flow', () => {
    test('should complete pledge response with yes status', async ({ page }) => {
      await page.goto('/response/valid-token');

      const campaignTitle = page.getByRole('heading', { level: 1 });
      await expect(campaignTitle).toBeVisible();

      const yesButton = page.getByRole('button', { name: 'Oui' });
      await yesButton.click();
      await expect(yesButton).toHaveClass(/bg-green-500/);

      const amountInput = page.locator('#amount');
      await amountInput.fill('5000');

      const commentField = page.locator('#comment');
      await commentField.fill('Intéressé par ce projet de sponsoring');

      const consentCheckbox = page.locator('#consent');
      await consentCheckbox.check();

      const submitButton = page.getByRole('button', { name: /envoyer ma réponse/i });
      await submitButton.click();

      await expect(page.getByRole('heading', { name: /merci/i })).toBeVisible({ timeout: 5000 });

      const successMessage = page.getByText(/votre réponse a été enregistrée/i);
      await expect(successMessage).toBeVisible();

      const pledgeAmount = page.getByText(/5.*000/);
      await expect(pledgeAmount).toBeVisible();
    });

    test('should complete pledge response with maybe status', async ({ page }) => {
      await page.goto('/response/valid-token');

      const maybeButton = page.getByRole('button', { name: 'Peut-être' });
      await maybeButton.click();
      await expect(maybeButton).toHaveClass(/bg-amber-500/);

      const amountInput = page.locator('#amount');
      await expect(amountInput).not.toBeVisible();

      const commentField = page.locator('#comment');
      await commentField.fill('Je dois consulter mon équipe avant de confirmer');

      const consentCheckbox = page.locator('#consent');
      await consentCheckbox.check();

      const submitButton = page.getByRole('button', { name: /envoyer ma réponse/i });
      await submitButton.click();

      await expect(page.getByRole('heading', { name: /merci/i })).toBeVisible({ timeout: 5000 });
    });

    test('should complete pledge response with no status', async ({ page }) => {
      await page.goto('/response/valid-token');

      const noButton = page.getByRole('button', { name: 'Non' });
      await noButton.click();
      await expect(noButton).toHaveClass(/bg-red-500/);

      const consentCheckbox = page.locator('#consent');
      await consentCheckbox.check();

      const submitButton = page.getByRole('button', { name: /envoyer ma réponse/i });
      await submitButton.click();

      await expect(page.getByRole('heading', { name: /merci/i })).toBeVisible({ timeout: 5000 });
    });

    test('should show error for invalid token', async ({ page }) => {
      await page.goto('/response/invalid-token');

      const errorHeading = page.getByRole('heading', { name: /invitation non valide/i });
      await expect(errorHeading).toBeVisible();

      const errorMessage = page.getByText(/ce lien d'invitation n'est pas valide/i);
      await expect(errorMessage).toBeVisible();
    });

    test('should show already responded message', async ({ page }) => {
      await page.goto('/response/already-responded-token');

      const successHeading = page.getByRole('heading', { name: /merci/i });
      await expect(successHeading).toBeVisible();

      const responseMessage = page.getByText(/votre réponse a été enregistrée/i);
      await expect(responseMessage).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display properly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/response/test-token');

      const form = page.locator('form');
      await expect(form).toBeVisible();

      const statusButtons = page.locator('button:has-text("Oui"), button:has-text("Peut-être"), button:has-text("Non")');
      const count = await statusButtons.count();
      expect(count).toBe(3);

      for (let i = 0; i < count; i++) {
        await expect(statusButtons.nth(i)).toBeVisible();
      }
    });

    test('should be scrollable on small screens', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/response/test-token');

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      const submitButton = page.getByRole('button', { name: /envoyer ma réponse/i });
      await expect(submitButton).toBeInViewport();
    });
  });

  test.describe('Error Handling', () => {
    test('should display error message on submission failure', async ({ page }) => {
      await page.route('**/rest/v1/pledges*', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Database error' }),
        });
      });

      await page.goto('/response/valid-token');

      const yesButton = page.getByRole('button', { name: 'Oui' });
      await yesButton.click();

      const amountInput = page.locator('#amount');
      await amountInput.fill('5000');

      const consentCheckbox = page.locator('#consent');
      await consentCheckbox.check();

      const submitButton = page.getByRole('button', { name: /envoyer ma réponse/i });
      await submitButton.click();

      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible({ timeout: 5000 });
    });

    test('should clear errors on field change', async ({ page }) => {
      await page.goto('/response/test-token');

      const yesButton = page.getByRole('button', { name: 'Oui' });
      await yesButton.click();

      const amountInput = page.locator('#amount');
      await amountInput.fill('-100');
      await amountInput.blur();

      let errorMessage = page.locator('#amount-error');
      await expect(errorMessage).toBeVisible();

      await amountInput.fill('5000');

      errorMessage = page.locator('#amount-error');
      await expect(errorMessage).not.toBeVisible();
    });
  });
});
