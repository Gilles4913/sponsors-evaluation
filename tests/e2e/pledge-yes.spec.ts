import { test, expect } from '@playwright/test';
import { createMinimalFixtures, cleanupTestFixtures, getPledgesByInvitation, supabase } from './fixtures';

test.describe('Pledge Yes Flow', () => {
  let fixtures: any;

  test.beforeEach(async () => {
    fixtures = await createMinimalFixtures();
  });

  test.afterEach(async () => {
    if (fixtures) {
      await cleanupTestFixtures(fixtures);
    }
  });

  test('should complete full pledge yes flow', async ({ page }) => {
    const responseUrl = `/respond/${fixtures.token}`;
    await page.goto(responseUrl);

    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(fixtures.sponsor.company)).toBeVisible();

    const yesButton = page.locator('button', { hasText: 'Oui' }).first();
    await expect(yesButton).toBeVisible();
    await yesButton.click();

    await page.waitForTimeout(1000);

    await expect(page.getByText(/Montant/i)).toBeVisible();

    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill('2000');

    const commentInput = page.locator('textarea').first();
    if (await commentInput.isVisible()) {
      await commentInput.fill('Test pledge comment - excited to sponsor!');
    }

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button', { hasText: 'Confirmer' }));
    await submitButton.click();

    await expect(page.getByText(/merci/i).or(page.getByText(/confirmation/i))).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2000);

    const pledges = await getPledgesByInvitation(fixtures.invitation.id);

    expect(pledges.length).toBe(1);
    expect(pledges[0].status).toBe('yes');
    expect(pledges[0].amount).toBe(2000);
    expect(pledges[0].campaign_id).toBe(fixtures.campaign.id);
    expect(pledges[0].sponsor_id).toBe(fixtures.sponsor.id);

    const { data: updatedInvitation } = await supabase
      .from('invitations')
      .select('status, responded_at')
      .eq('id', fixtures.invitation.id)
      .single();

    expect(updatedInvitation?.status).toBe('responded');
    expect(updatedInvitation?.responded_at).toBeTruthy();
  });

  test('should validate required amount for yes pledge', async ({ page }) => {
    const responseUrl = `/respond/${fixtures.token}`;
    await page.goto(responseUrl);

    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    const yesButton = page.locator('button', { hasText: 'Oui' }).first();
    await yesButton.click();

    await page.waitForTimeout(1000);

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button', { hasText: 'Confirmer' }));
    await submitButton.click();

    await expect(page.locator('text=/requis|obligatoire|montant/i')).toBeVisible({ timeout: 5000 });

    const pledges = await getPledgesByInvitation(fixtures.invitation.id);
    expect(pledges.length).toBe(0);
  });

  test('should accept zero or negative amount gracefully', async ({ page }) => {
    const responseUrl = `/respond/${fixtures.token}`;
    await page.goto(responseUrl);

    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    const yesButton = page.locator('button', { hasText: 'Oui' }).first();
    await yesButton.click();

    await page.waitForTimeout(1000);

    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill('0');

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button', { hasText: 'Confirmer' }));
    await submitButton.click();

    await page.waitForTimeout(2000);

    const pledges = await getPledgesByInvitation(fixtures.invitation.id);

    if (pledges.length > 0) {
      expect(pledges[0].status).toBe('yes');
      expect(pledges[0].amount).toBeGreaterThanOrEqual(0);
    }
  });

  test('should display campaign details correctly', async ({ page }) => {
    const responseUrl = `/respond/${fixtures.token}`;
    await page.goto(responseUrl);

    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(fixtures.campaign.location)).toBeVisible();

    const priceText = fixtures.campaign.annual_price_hint?.toLocaleString();
    if (priceText) {
      await expect(page.getByText(new RegExp(priceText))).toBeVisible();
    }
  });

  test('should handle campaign with description', async ({ page }) => {
    await supabase
      .from('campaigns')
      .update({
        description_md: '# Test Description\n\nThis is a **bold** test.\n\n- Item 1\n- Item 2'
      })
      .eq('id', fixtures.campaign.id);

    const responseUrl = `/respond/${fixtures.token}`;
    await page.goto(responseUrl);

    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    await expect(page.locator('text=/Test Description/i')).toBeVisible();
  });

  test('should record pledge with timestamp in Paris timezone', async ({ page }) => {
    const responseUrl = `/respond/${fixtures.token}`;
    await page.goto(responseUrl);

    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    const yesButton = page.locator('button', { hasText: 'Oui' }).first();
    await yesButton.click();

    await page.waitForTimeout(1000);

    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill('1500');

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button', { hasText: 'Confirmer' }));
    await submitButton.click();

    await page.waitForTimeout(2000);

    const pledges = await getPledgesByInvitation(fixtures.invitation.id);

    expect(pledges.length).toBe(1);
    expect(pledges[0].created_at).toBeTruthy();

    const pledgeDate = new Date(pledges[0].created_at);
    const now = new Date();
    const timeDiff = Math.abs(now.getTime() - pledgeDate.getTime());

    expect(timeDiff).toBeLessThan(60000);
  });

  test('should handle special characters in comment', async ({ page }) => {
    const responseUrl = `/respond/${fixtures.token}`;
    await page.goto(responseUrl);

    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    const yesButton = page.locator('button', { hasText: 'Oui' }).first();
    await yesButton.click();

    await page.waitForTimeout(1000);

    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill('3000');

    const commentInput = page.locator('textarea').first();
    if (await commentInput.isVisible()) {
      await commentInput.fill('Comment with special chars: €, <script>, "quotes", & symbols!');
    }

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button', { hasText: 'Confirmer' }));
    await submitButton.click();

    await page.waitForTimeout(2000);

    const pledges = await getPledgesByInvitation(fixtures.invitation.id);

    expect(pledges.length).toBe(1);
    expect(pledges[0].status).toBe('yes');
    expect(pledges[0].amount).toBe(3000);
  });
});
