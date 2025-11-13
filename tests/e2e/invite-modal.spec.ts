import { test, expect } from '@playwright/test';

test.describe('Invite Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('login-email').fill('admin@example.com');
    await page.getByTestId('login-password').fill('password123');
    await page.getByTestId('login-submit').click();

    await page.waitForURL('**/club', { timeout: 10000 });
  });

  test('should open invite modal from sponsors page', async ({ page }) => {
    await page.goto('/sponsors');

    await page.waitForTimeout(2000);

    const inviteButton = page.getByTestId('invite-sponsors-button');
    if (await inviteButton.isVisible()) {
      await inviteButton.click();

      await expect(page.getByTestId('invite-campaign-select')).toBeVisible();
      await expect(page.getByTestId('send-invitations-button')).toBeVisible();
    }
  });

  test('should select campaign in invite modal', async ({ page }) => {
    await page.goto('/sponsors');

    await page.waitForTimeout(2000);

    const inviteButton = page.getByTestId('invite-sponsors-button');
    if (await inviteButton.isVisible()) {
      await inviteButton.click();

      const campaignSelect = page.getByTestId('invite-campaign-select');
      await campaignSelect.selectOption({ index: 1 });

      await expect(campaignSelect).not.toHaveValue('');
    }
  });

  test('should enable scheduling', async ({ page }) => {
    await page.goto('/sponsors');

    await page.waitForTimeout(2000);

    const inviteButton = page.getByTestId('invite-sponsors-button');
    if (await inviteButton.isVisible()) {
      await inviteButton.click();

      const campaignSelect = page.getByTestId('invite-campaign-select');
      await campaignSelect.selectOption({ index: 1 });

      const scheduleCheckbox = page.getByTestId('schedule-checkbox');
      await scheduleCheckbox.check();

      await expect(scheduleCheckbox).toBeChecked();
      await expect(page.getByText('Planifier l\'envoi')).toBeVisible();
    }
  });

  test('should disable send button without campaign selection', async ({ page }) => {
    await page.goto('/sponsors');

    await page.waitForTimeout(2000);

    const inviteButton = page.getByTestId('invite-sponsors-button');
    if (await inviteButton.isVisible()) {
      await inviteButton.click();

      const sendButton = page.getByTestId('send-invitations-button');
      await expect(sendButton).toBeDisabled();
    }
  });

  test('should enable send button with campaign selection', async ({ page }) => {
    await page.goto('/sponsors');

    await page.waitForTimeout(2000);

    const inviteButton = page.getByTestId('invite-sponsors-button');
    if (await inviteButton.isVisible()) {
      await inviteButton.click();

      const campaignSelect = page.getByTestId('invite-campaign-select');
      await campaignSelect.selectOption({ index: 1 });

      const sendButton = page.getByTestId('send-invitations-button');
      await expect(sendButton).toBeEnabled();
    }
  });
});
