import { test, expect } from '@playwright/test';
import { createMinimalFixtures, cleanupTestFixtures, getCampaignStats, supabase } from './fixtures';

test.describe('Campaign Aggregates and Statistics', () => {
  let fixtures: any;

  test.beforeEach(async () => {
    fixtures = await createMinimalFixtures();
  });

  test.afterEach(async () => {
    if (fixtures) {
      await cleanupTestFixtures(fixtures);
    }
  });

  test('should calculate correct aggregate for single yes pledge', async ({ page }) => {
    const responseUrl = `/respond/${fixtures.token}`;

    await page.goto(responseUrl);
    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    const yesButton = page.locator('button', { hasText: 'Oui' }).first();
    await yesButton.click();
    await page.waitForTimeout(1000);

    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill('1000');

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button', { hasText: 'Confirmer' }));
    await submitButton.click();
    await page.waitForTimeout(2000);

    const stats = await getCampaignStats(fixtures.campaign.id);

    expect(stats.totalPledges).toBe(1);
    expect(stats.totalPledged).toBe(1000);
    expect(stats.yesCount).toBe(1);
    expect(stats.maybeCount).toBe(0);
    expect(stats.noCount).toBe(0);
  });

  test('should calculate correct aggregate for multiple pledges', async ({ browser }) => {
    const sponsor2Email = `sponsor2-${Date.now()}@example.com`;
    const token2 = `token2_${Date.now()}`;

    const { data: sponsor2 } = await supabase
      .from('sponsors')
      .insert({
        tenant_id: fixtures.tenant.id,
        company: 'Company 2',
        contact_name: 'Contact 2',
        email: sponsor2Email,
        segment: 'argent',
      })
      .select()
      .single();

    const { data: invitation2 } = await supabase
      .from('invitations')
      .insert({
        campaign_id: fixtures.campaign.id,
        sponsor_id: sponsor2.id,
        email: sponsor2Email,
        token: token2,
        status: 'sent',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    const sponsor3Email = `sponsor3-${Date.now()}@example.com`;
    const token3 = `token3_${Date.now()}`;

    const { data: sponsor3 } = await supabase
      .from('sponsors')
      .insert({
        tenant_id: fixtures.tenant.id,
        company: 'Company 3',
        contact_name: 'Contact 3',
        email: sponsor3Email,
        segment: 'bronze',
      })
      .select()
      .single();

    const { data: invitation3 } = await supabase
      .from('invitations')
      .insert({
        campaign_id: fixtures.campaign.id,
        sponsor_id: sponsor3.id,
        email: sponsor3Email,
        token: token3,
        status: 'sent',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    const page3 = await context3.newPage();

    await page1.goto(`/respond/${fixtures.token}`);
    await page2.goto(`/respond/${token2}`);
    await page3.goto(`/respond/${token3}`);

    await Promise.all([
      expect(page1.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 }),
      expect(page2.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 }),
      expect(page3.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 }),
    ]);

    const yes1 = page1.locator('button', { hasText: 'Oui' }).first();
    await yes1.click();
    await page1.waitForTimeout(1000);
    await page1.locator('input[type="number"]').first().fill('2000');
    await page1.locator('button[type="submit"]').or(page1.locator('button', { hasText: 'Confirmer' })).click();

    const yes2 = page2.locator('button', { hasText: 'Oui' }).first();
    await yes2.click();
    await page2.waitForTimeout(1000);
    await page2.locator('input[type="number"]').first().fill('3500');
    await page2.locator('button[type="submit"]').or(page2.locator('button', { hasText: 'Confirmer' })).click();

    const maybe3 = page3.locator('button', { hasText: 'Peut-être' }).or(page3.locator('button', { hasText: 'Maybe' }));
    await maybe3.click();
    await page3.waitForTimeout(1000);
    const submit3 = page3.locator('button[type="submit"]').or(page3.locator('button', { hasText: 'Confirmer' }));
    if (await submit3.isVisible()) {
      await submit3.click();
    }

    await page1.waitForTimeout(3000);

    const stats = await getCampaignStats(fixtures.campaign.id);

    expect(stats.totalPledges).toBe(3);
    expect(stats.totalPledged).toBe(5500);
    expect(stats.yesCount).toBe(2);
    expect(stats.maybeCount).toBe(1);
    expect(stats.noCount).toBe(0);

    await context1.close();
    await context2.close();
    await context3.close();
  });

  test('should not include maybe and no pledges in total amount', async ({ browser }) => {
    const sponsor2Email = `sponsor2-${Date.now()}@example.com`;
    const token2 = `token2_${Date.now()}`;

    const { data: sponsor2 } = await supabase
      .from('sponsors')
      .insert({
        tenant_id: fixtures.tenant.id,
        company: 'Company 2',
        contact_name: 'Contact 2',
        email: sponsor2Email,
        segment: 'or',
      })
      .select()
      .single();

    await supabase
      .from('invitations')
      .insert({
        campaign_id: fixtures.campaign.id,
        sponsor_id: sponsor2.id,
        email: sponsor2Email,
        token: token2,
        status: 'sent',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await page1.goto(`/respond/${fixtures.token}`);
    await page2.goto(`/respond/${token2}`);

    await expect(page1.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });
    await expect(page2.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    const yes1 = page1.locator('button', { hasText: 'Oui' }).first();
    await yes1.click();
    await page1.waitForTimeout(1000);
    await page1.locator('input[type="number"]').first().fill('4000');
    await page1.locator('button[type="submit"]').or(page1.locator('button', { hasText: 'Confirmer' })).click();

    const no2 = page2.locator('button', { hasText: 'Non' }).first();
    await no2.click();
    await page2.waitForTimeout(1000);
    const submit2 = page2.locator('button[type="submit"]').or(page2.locator('button', { hasText: 'Confirmer' }));
    if (await submit2.isVisible()) {
      await submit2.click();
    }

    await page1.waitForTimeout(2000);

    const stats = await getCampaignStats(fixtures.campaign.id);

    expect(stats.totalPledges).toBe(2);
    expect(stats.totalPledged).toBe(4000);
    expect(stats.yesCount).toBe(1);
    expect(stats.maybeCount).toBe(0);
    expect(stats.noCount).toBe(1);

    await context1.close();
    await context2.close();
  });

  test('should calculate progress percentage correctly', async ({ page }) => {
    const responseUrl = `/respond/${fixtures.token}`;

    await page.goto(responseUrl);
    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    const yesButton = page.locator('button', { hasText: 'Oui' }).first();
    await yesButton.click();
    await page.waitForTimeout(1000);

    await page.locator('input[type="number"]').first().fill('2500');

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button', { hasText: 'Confirmer' }));
    await submitButton.click();
    await page.waitForTimeout(2000);

    const stats = await getCampaignStats(fixtures.campaign.id);
    const objectiveAmount = fixtures.campaign.objective_amount;

    if (objectiveAmount) {
      const expectedPercentage = (stats.totalPledged / objectiveAmount) * 100;
      expect(expectedPercentage).toBeCloseTo(50, 0);
    }
  });

  test('should handle zero objective amount gracefully', async ({ page }) => {
    await supabase
      .from('campaigns')
      .update({ objective_amount: 0 })
      .eq('id', fixtures.campaign.id);

    const responseUrl = `/respond/${fixtures.token}`;

    await page.goto(responseUrl);
    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    const yesButton = page.locator('button', { hasText: 'Oui' }).first();
    await yesButton.click();
    await page.waitForTimeout(1000);

    await page.locator('input[type="number"]').first().fill('1000');

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button', { hasText: 'Confirmer' }));
    await submitButton.click();
    await page.waitForTimeout(2000);

    const stats = await getCampaignStats(fixtures.campaign.id);

    expect(stats.totalPledged).toBe(1000);
    expect(stats.yesCount).toBe(1);
  });

  test('should aggregate large amounts correctly', async ({ page }) => {
    const responseUrl = `/respond/${fixtures.token}`;

    await page.goto(responseUrl);
    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    const yesButton = page.locator('button', { hasText: 'Oui' }).first();
    await yesButton.click();
    await page.waitForTimeout(1000);

    await page.locator('input[type="number"]').first().fill('999999');

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button', { hasText: 'Confirmer' }));
    await submitButton.click();
    await page.waitForTimeout(2000);

    const stats = await getCampaignStats(fixtures.campaign.id);

    expect(stats.totalPledged).toBe(999999);
    expect(stats.yesCount).toBe(1);
  });

  test('should handle decimal amounts if allowed', async ({ page }) => {
    const responseUrl = `/respond/${fixtures.token}`;

    await page.goto(responseUrl);
    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    const yesButton = page.locator('button', { hasText: 'Oui' }).first();
    await yesButton.click();
    await page.waitForTimeout(1000);

    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill('1234.56');

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button', { hasText: 'Confirmer' }));
    await submitButton.click();
    await page.waitForTimeout(2000);

    const stats = await getCampaignStats(fixtures.campaign.id);

    expect(stats.totalPledged).toBeGreaterThan(1234);
    expect(stats.totalPledged).toBeLessThanOrEqual(1235);
  });

  test('should count all response types correctly', async ({ browser }) => {
    const createSponsorAndInvite = async (index: number) => {
      const email = `sponsor${index}-${Date.now()}@example.com`;
      const token = `token${index}_${Date.now()}`;

      const { data: sponsor } = await supabase
        .from('sponsors')
        .insert({
          tenant_id: fixtures.tenant.id,
          company: `Company ${index}`,
          contact_name: `Contact ${index}`,
          email: email,
          segment: 'bronze',
        })
        .select()
        .single();

      await supabase
        .from('invitations')
        .insert({
          campaign_id: fixtures.campaign.id,
          sponsor_id: sponsor.id,
          email: email,
          token: token,
          status: 'sent',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      return token;
    };

    const token2 = await createSponsorAndInvite(2);
    const token3 = await createSponsorAndInvite(3);
    const token4 = await createSponsorAndInvite(4);

    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);

    const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));

    await pages[0].goto(`/respond/${fixtures.token}`);
    await pages[1].goto(`/respond/${token2}`);
    await pages[2].goto(`/respond/${token3}`);
    await pages[3].goto(`/respond/${token4}`);

    await Promise.all(pages.map(p => expect(p.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 })));

    const yes1 = pages[0].locator('button', { hasText: 'Oui' }).first();
    await yes1.click();
    await pages[0].waitForTimeout(1000);
    await pages[0].locator('input[type="number"]').first().fill('1500');
    await pages[0].locator('button[type="submit"]').or(pages[0].locator('button', { hasText: 'Confirmer' })).click();

    const yes2 = pages[1].locator('button', { hasText: 'Oui' }).first();
    await yes2.click();
    await pages[1].waitForTimeout(1000);
    await pages[1].locator('input[type="number"]').first().fill('2500');
    await pages[1].locator('button[type="submit"]').or(pages[1].locator('button', { hasText: 'Confirmer' })).click();

    const maybe3 = pages[2].locator('button', { hasText: 'Peut-être' }).or(pages[2].locator('button', { hasText: 'Maybe' }));
    await maybe3.click();
    await pages[2].waitForTimeout(1000);
    const submit3 = pages[2].locator('button[type="submit"]').or(pages[2].locator('button', { hasText: 'Confirmer' }));
    if (await submit3.isVisible()) await submit3.click();

    const no4 = pages[3].locator('button', { hasText: 'Non' }).first();
    await no4.click();
    await pages[3].waitForTimeout(1000);
    const submit4 = pages[3].locator('button[type="submit"]').or(pages[3].locator('button', { hasText: 'Confirmer' }));
    if (await submit4.isVisible()) await submit4.click();

    await pages[0].waitForTimeout(3000);

    const stats = await getCampaignStats(fixtures.campaign.id);

    expect(stats.totalPledges).toBe(4);
    expect(stats.totalPledged).toBe(4000);
    expect(stats.yesCount).toBe(2);
    expect(stats.maybeCount).toBe(1);
    expect(stats.noCount).toBe(1);

    await Promise.all(contexts.map(ctx => ctx.close()));
  });

  test('should maintain aggregate accuracy after page refresh', async ({ page }) => {
    const responseUrl = `/respond/${fixtures.token}`;

    await page.goto(responseUrl);
    await expect(page.getByText(fixtures.campaign.title)).toBeVisible({ timeout: 10000 });

    const yesButton = page.locator('button', { hasText: 'Oui' }).first();
    await yesButton.click();
    await page.waitForTimeout(1000);

    await page.locator('input[type="number"]').first().fill('3000');

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button', { hasText: 'Confirmer' }));
    await submitButton.click();
    await page.waitForTimeout(2000);

    const statsBeforeRefresh = await getCampaignStats(fixtures.campaign.id);

    await page.reload();
    await page.waitForTimeout(2000);

    const statsAfterRefresh = await getCampaignStats(fixtures.campaign.id);

    expect(statsAfterRefresh).toEqual(statsBeforeRefresh);
    expect(statsAfterRefresh.totalPledged).toBe(3000);
  });
});
