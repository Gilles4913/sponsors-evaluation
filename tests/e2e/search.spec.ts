import { test, expect } from '@playwright/test';
import { supabase, createTestFixtures, cleanupTestFixtures } from './fixtures';

test.describe('Search Functionality', () => {
  let fixtures: Awaited<ReturnType<typeof createTestFixtures>>;

  test.beforeAll(async () => {
    fixtures = await createTestFixtures();
  });

  test.afterAll(async () => {
    await cleanupTestFixtures(fixtures);
  });

  test('super admin can search clubs and view as tenant to search sponsors', async ({ page }) => {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'super@admin.com';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';

    await page.goto('/');

    await page.getByTestId('login-email').fill(superAdminEmail);
    await page.getByTestId('login-password').fill(superAdminPassword);
    await page.getByTestId('login-submit').click();

    await page.waitForURL('**/super-admin/**', { timeout: 10000 });
    expect(page.url()).toContain('/super-admin');

    await page.goto('/super-admin/clubs');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByTestId('sa-club-search');
    await expect(searchInput).toBeVisible();

    await searchInput.fill(fixtures.tenant.name);
    await searchInput.press('Enter');

    await page.waitForTimeout(1000);

    const tableRows = page.locator('table tbody tr');
    await expect(tableRows).toHaveCount(1, { timeout: 5000 });

    const firstRow = tableRows.first();
    await expect(firstRow).toContainText(fixtures.tenant.name);

    const viewAsButton = firstRow.locator('button[title="Voir comme ce club"]');
    await expect(viewAsButton).toBeVisible();
    await viewAsButton.click();

    await page.waitForURL('**/club/dashboard**', { timeout: 10000 });
    expect(page.url()).toContain('/club/dashboard');
    expect(page.url()).toContain('asTenant=');

    await page.goto('/club/sponsors');
    await page.waitForLoadState('networkidle');

    const sponsorSearchInput = page.getByTestId('club-sponsor-search');
    await expect(sponsorSearchInput).toBeVisible();

    await sponsorSearchInput.fill(fixtures.sponsor.company);
    await sponsorSearchInput.press('Enter');

    await page.waitForTimeout(1000);

    const sponsorTableRows = page.locator('table tbody tr').filter({ hasNotText: 'Aucun sponsor' });
    await expect(sponsorTableRows.first()).toBeVisible({ timeout: 5000 });
    await expect(sponsorTableRows.first()).toContainText(fixtures.sponsor.company);

    const searchResultText = page.locator('text=' + fixtures.sponsor.company);
    await expect(searchResultText).toBeVisible();
  });

  test('super admin club search shows no results for non-existent club', async ({ page }) => {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'super@admin.com';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';

    await page.goto('/');

    await page.getByTestId('login-email').fill(superAdminEmail);
    await page.getByTestId('login-password').fill(superAdminPassword);
    await page.getByTestId('login-submit').click();

    await page.waitForURL('**/super-admin/**', { timeout: 10000 });

    await page.goto('/super-admin/clubs');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByTestId('sa-club-search');
    await searchInput.fill('NonExistentClubXYZ123456789');
    await searchInput.press('Enter');

    await page.waitForTimeout(1000);

    const noResultsMessage = page.locator('text=Aucun club trouvé');
    await expect(noResultsMessage).toBeVisible({ timeout: 5000 });
  });

  test('sponsor search shows no results for non-existent sponsor', async ({ page }) => {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'super@admin.com';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';

    await page.goto('/');

    await page.getByTestId('login-email').fill(superAdminEmail);
    await page.getByTestId('login-password').fill(superAdminPassword);
    await page.getByTestId('login-submit').click();

    await page.waitForURL('**/super-admin/**', { timeout: 10000 });

    await page.goto('/super-admin/clubs');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByTestId('sa-club-search');
    await searchInput.fill(fixtures.tenant.name);
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    const tableRows = page.locator('table tbody tr');
    const viewAsButton = tableRows.first().locator('button[title="Voir comme ce club"]');
    await viewAsButton.click();

    await page.waitForURL('**/club/dashboard**', { timeout: 10000 });

    await page.goto('/club/sponsors');
    await page.waitForLoadState('networkidle');

    const sponsorSearchInput = page.getByTestId('club-sponsor-search');
    await sponsorSearchInput.fill('NonExistentSponsorXYZ987654321');
    await sponsorSearchInput.press('Enter');

    await page.waitForTimeout(1000);

    const noResultsMessage = page.locator('text=Aucun sponsor trouvé');
    await expect(noResultsMessage).toBeVisible({ timeout: 5000 });
  });

  test('search input can be cleared with X button', async ({ page }) => {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'super@admin.com';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';

    await page.goto('/');

    await page.getByTestId('login-email').fill(superAdminEmail);
    await page.getByTestId('login-password').fill(superAdminPassword);
    await page.getByTestId('login-submit').click();

    await page.waitForURL('**/super-admin/**', { timeout: 10000 });

    await page.goto('/super-admin/clubs');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByTestId('sa-club-search');
    await searchInput.fill('some search term');

    const clearButton = page.locator('button[aria-label="Effacer la recherche"]').first();
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    await expect(searchInput).toHaveValue('');
  });
});
