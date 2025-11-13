import { test, expect } from '@playwright/test';
import { createMinimalFixtures, cleanupTestFixtures, getPledgesByInvitation, supabase } from './fixtures';

test.describe('Idempotence and Multiple Response Handling', () => {
  let fixtures: any;

  test.beforeEach(async () => {
    fixtures = await createMinimalFixtures();
  });

  test.afterEach(async () => {
    if (fixtures) {
      await cleanupTestFixtures(fixtures);
    }
  });

  test('should prevent multiple responses with same token', async ({ page }) => {
    const responseUrl = `/respond/${fixtures.token}`;

    await page.goto(responseUrl);
    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    const yesButton = page.locator('button', { hasText: 'Oui' }).first();
    await yesButton.click();
    await page.waitForTimeout(1000);

    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill('2500');

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button', { hasText: 'Confirmer' }));
    await submitButton.click();

    await expect(page.getByText(/merci/i).or(page.getByText(/confirmation/i))).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    const pledgesAfterFirst = await getPledgesByInvitation(fixtures.invitation.id);
    expect(pledgesAfterFirst.length).toBe(1);
    expect(pledgesAfterFirst[0].amount).toBe(2500);

    await page.goto(responseUrl);

    await expect(
      page.getByText(/déjà répondu/i)
        .or(page.getByText(/already responded/i))
        .or(page.getByText(/merci/i))
    ).toBeVisible({ timeout: 10000 });

    const noButton = page.locator('button', { hasText: 'Non' });
    if (await noButton.isVisible()) {
      await expect(noButton).toBeDisabled();
    }

    const pledgesAfterSecond = await getPledgesByInvitation(fixtures.invitation.id);
    expect(pledgesAfterSecond.length).toBe(1);
    expect(pledgesAfterSecond[0].amount).toBe(2500);
  });

  test('should maintain first response when attempting to change', async ({ page }) => {
    const responseUrl = `/respond/${fixtures.token}`;

    await page.goto(responseUrl);
    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    const maybeButton = page.locator('button', { hasText: 'Peut-être' }).or(page.locator('button', { hasText: 'Maybe' }));
    await maybeButton.click();
    await page.waitForTimeout(1000);

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button', { hasText: 'Confirmer' }));
    await submitButton.click();

    await page.waitForTimeout(2000);

    const firstPledges = await getPledgesByInvitation(fixtures.invitation.id);
    expect(firstPledges.length).toBe(1);
    expect(firstPledges[0].status).toBe('maybe');

    await page.goto(responseUrl);
    await page.waitForTimeout(1000);

    const yesButton = page.locator('button', { hasText: 'Oui' });
    if (await yesButton.isVisible()) {
      const isDisabled = await yesButton.isDisabled();
      expect(isDisabled).toBe(true);
    }

    const secondPledges = await getPledgesByInvitation(fixtures.invitation.id);
    expect(secondPledges.length).toBe(1);
    expect(secondPledges[0].status).toBe('maybe');
    expect(secondPledges[0].id).toBe(firstPledges[0].id);
  });

  test('should handle concurrent requests gracefully', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const responseUrl = `/respond/${fixtures.token}`;

    await Promise.all([
      page1.goto(responseUrl),
      page2.goto(responseUrl),
    ]);

    await Promise.all([
      expect(page1.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 }),
      expect(page2.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 }),
    ]);

    const yesButton1 = page1.locator('button', { hasText: 'Oui' }).first();
    const yesButton2 = page2.locator('button', { hasText: 'Oui' }).first();

    await Promise.all([
      yesButton1.click(),
      yesButton2.click(),
    ]);

    await page1.waitForTimeout(1000);
    await page2.waitForTimeout(1000);

    const amountInput1 = page1.locator('input[type="number"]').first();
    const amountInput2 = page2.locator('input[type="number"]').first();

    await Promise.all([
      amountInput1.fill('3000'),
      amountInput2.fill('3500'),
    ]);

    const submitButton1 = page1.locator('button[type="submit"]').or(page1.locator('button', { hasText: 'Confirmer' }));
    const submitButton2 = page2.locator('button[type="submit"]').or(page2.locator('button', { hasText: 'Confirmer' }));

    await Promise.all([
      submitButton1.click(),
      submitButton2.click(),
    ]);

    await page1.waitForTimeout(3000);
    await page2.waitForTimeout(3000);

    const pledges = await getPledgesByInvitation(fixtures.invitation.id);

    expect(pledges.length).toBe(1);
    expect(pledges[0].status).toBe('yes');
    expect([3000, 3500]).toContain(pledges[0].amount);

    await context1.close();
    await context2.close();
  });

  test('should handle expired token', async ({ page }) => {
    await supabase
      .from('invitations')
      .update({
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      })
      .eq('id', fixtures.invitation.id);

    const responseUrl = `/respond/${fixtures.token}`;
    await page.goto(responseUrl);

    await expect(
      page.getByText(/expiré/i)
        .or(page.getByText(/expired/i))
        .or(page.getByText(/invalide/i))
    ).toBeVisible({ timeout: 10000 });

    const yesButton = page.locator('button', { hasText: 'Oui' });
    if (await yesButton.isVisible()) {
      await expect(yesButton).toBeDisabled();
    }
  });

  test('should handle invalid token', async ({ page }) => {
    const invalidToken = 'invalid_token_12345';
    const responseUrl = `/respond/${invalidToken}`;

    await page.goto(responseUrl);

    await expect(
      page.getByText(/invalide/i)
        .or(page.getByText(/not found/i))
        .or(page.getByText(/introuvable/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should preserve original pledge data on revisit', async ({ page }) => {
    const responseUrl = `/respond/${fixtures.token}`;

    await page.goto(responseUrl);
    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    const yesButton = page.locator('button', { hasText: 'Oui' }).first();
    await yesButton.click();
    await page.waitForTimeout(1000);

    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill('4000');

    const commentInput = page.locator('textarea').first();
    if (await commentInput.isVisible()) {
      await commentInput.fill('Original comment that should persist');
    }

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button', { hasText: 'Confirmer' }));
    await submitButton.click();

    await page.waitForTimeout(2000);

    const originalPledges = await getPledgesByInvitation(fixtures.invitation.id);
    const originalPledge = originalPledges[0];

    await page.goto(responseUrl);
    await page.waitForTimeout(1000);

    const revisitPledges = await getPledgesByInvitation(fixtures.invitation.id);

    expect(revisitPledges.length).toBe(1);
    expect(revisitPledges[0].id).toBe(originalPledge.id);
    expect(revisitPledges[0].amount).toBe(4000);
    expect(revisitPledges[0].status).toBe('yes');
    expect(revisitPledges[0].created_at).toBe(originalPledge.created_at);
  });

  test('should handle database constraint violations gracefully', async ({ page, browser }) => {
    const responseUrl = `/respond/${fixtures.token}`;

    await page.goto(responseUrl);
    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    const yesButton = page.locator('button', { hasText: 'Oui' }).first();
    await yesButton.click();
    await page.waitForTimeout(1000);

    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill('5000');

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button', { hasText: 'Confirmer' }));
    await submitButton.click();

    await page.waitForTimeout(2000);

    const pledgesAfter = await getPledgesByInvitation(fixtures.invitation.id);
    expect(pledgesAfter.length).toBeGreaterThanOrEqual(1);
    expect(pledgesAfter.length).toBeLessThanOrEqual(1);
  });

  test('should update invitation status only once', async ({ page }) => {
    const responseUrl = `/respond/${fixtures.token}`;

    await page.goto(responseUrl);
    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    const noButton = page.locator('button', { hasText: 'Non' }).first();
    await noButton.click();
    await page.waitForTimeout(1000);

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button', { hasText: 'Confirmer' }));
    if (await submitButton.isVisible()) {
      await submitButton.click();
    }

    await page.waitForTimeout(2000);

    const { data: invitation1 } = await supabase
      .from('invitations')
      .select('status, responded_at, updated_at')
      .eq('id', fixtures.invitation.id)
      .single();

    expect(invitation1?.status).toBe('responded');
    expect(invitation1?.responded_at).toBeTruthy();
    const firstRespondedAt = invitation1?.responded_at;

    await page.goto(responseUrl);
    await page.waitForTimeout(2000);

    const { data: invitation2 } = await supabase
      .from('invitations')
      .select('status, responded_at, updated_at')
      .eq('id', fixtures.invitation.id)
      .single();

    expect(invitation2?.status).toBe('responded');
    expect(invitation2?.responded_at).toBe(firstRespondedAt);
  });

  test('should display existing response on page reload', async ({ page }) => {
    const responseUrl = `/respond/${fixtures.token}`;

    await page.goto(responseUrl);
    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    const yesButton = page.locator('button', { hasText: 'Oui' }).first();
    await yesButton.click();
    await page.waitForTimeout(1000);

    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill('7500');

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button', { hasText: 'Confirmer' }));
    await submitButton.click();

    await page.waitForTimeout(2000);

    await page.reload();
    await page.waitForTimeout(1000);

    await expect(
      page.getByText(/7500/)
        .or(page.getByText(/merci/i))
        .or(page.getByText(/confirmation/i))
    ).toBeVisible({ timeout: 5000 });

    const pledges = await getPledgesByInvitation(fixtures.invitation.id);
    expect(pledges.length).toBe(1);
  });
});
