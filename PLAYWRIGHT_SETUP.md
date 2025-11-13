# Playwright E2E Testing Setup

This document describes the Playwright end-to-end testing setup for the sponsoring platform.

## Installation

Playwright is already installed and configured in the project. The required packages are:

```json
{
  "@playwright/test": "^1.56.1",
  "playwright": "^1.56.1"
}
```

## Configuration

The Playwright configuration is located in `playwright.config.ts`. Key settings:

```typescript
{
  testDir: './tests/e2e',
  baseURL: 'http://localhost:5173',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
}
```

## NPM Scripts

Available test commands:

```bash
# Run all tests
npm run test:e2e

# Run tests in UI mode (interactive)
npm run test:e2e:ui

# Run tests in debug mode
npm run test:e2e:debug

# Show HTML test report
npm run test:e2e:report
```

## Test Files

Test files are located in `tests/e2e/` directory:

### `login.spec.ts`
Tests for authentication flow:
- Display login form
- Show error on invalid credentials
- Login successfully with valid credentials

### `scheduled-sends.spec.ts`
Tests for scheduled sends functionality:
- Display scheduled sends page
- Filter by campaign
- Filter by status
- Show cancel button for pending jobs
- Cancel a pending job

### `invite-modal.spec.ts`
Tests for invitation modal:
- Open invite modal from sponsors page
- Select campaign in invite modal
- Enable scheduling
- Disable send button without campaign
- Enable send button with campaign

### `sponsor-response.spec.ts` (existing)
Tests for sponsor response flow

## Data Test IDs

Components have been annotated with `data-testid` attributes for reliable test selectors:

### Login Component
- `login-form` - Login form element
- `login-email` - Email input field
- `login-password` - Password input field
- `login-submit` - Submit button
- `login-error` - Error message display

### CampaignsList Component
- `create-campaign-button` - New campaign button
- `campaign-card` - Campaign list item

### SponsorsList Component
- `invite-sponsors-button` - Invite button (when sponsors selected)
- `add-sponsor-form` - Add sponsor form

### InviteModal Component
- `invite-campaign-select` - Campaign dropdown
- `schedule-checkbox` - Schedule send checkbox
- `send-invitations-button` - Send/Schedule button

### ScheduledSends Component
- `filter-campaign` - Campaign filter dropdown
- `filter-status` - Status filter dropdown
- `cancel-job-button` - Cancel job button

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup (e.g., login)
    await page.goto('/');
    await page.getByTestId('login-email').fill('admin@example.com');
    await page.getByTestId('login-password').fill('password123');
    await page.getByTestId('login-submit').click();
    await page.waitForURL('**/club', { timeout: 10000 });
  });

  test('should do something', async ({ page }) => {
    await page.goto('/some-page');

    const element = page.getByTestId('element-id');
    await expect(element).toBeVisible();
  });
});
```

### Best Practices

1. **Use data-testid selectors**: Prefer `getByTestId()` over CSS selectors
   ```typescript
   // Good
   await page.getByTestId('login-submit').click();

   // Avoid
   await page.locator('.button.submit').click();
   ```

2. **Wait for navigation**: Use `waitForURL()` after actions that navigate
   ```typescript
   await page.getByTestId('login-submit').click();
   await page.waitForURL('**/dashboard', { timeout: 10000 });
   ```

3. **Handle dynamic content**: Use `waitForTimeout()` sparingly, prefer visibility checks
   ```typescript
   // Better
   await expect(page.getByTestId('data-loaded')).toBeVisible();

   // Avoid if possible
   await page.waitForTimeout(2000);
   ```

4. **Check for existence before interaction**: Use `isVisible()` for optional elements
   ```typescript
   const button = page.getByTestId('optional-button');
   if (await button.isVisible()) {
     await button.click();
   }
   ```

5. **Handle dialogs**: Listen for dialog events before triggering
   ```typescript
   page.on('dialog', dialog => dialog.accept());
   await page.getByTestId('delete-button').click();
   ```

## Authentication

Most tests require authentication. Use the beforeEach hook:

```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('login-email').fill('admin@example.com');
  await page.getByTestId('login-password').fill('password123');
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/club', { timeout: 10000 });
});
```

**Note**: You'll need valid test credentials in your Supabase database for tests to pass.

## Test Database Setup

For E2E tests to work properly:

1. Create a test tenant in your Supabase database
2. Create a test user with email `admin@example.com` and password `password123`
3. Ensure test data exists (campaigns, sponsors, etc.)

Alternatively, use Supabase's test environments or mock the authentication layer.

## Running Tests

### Local Development

```bash
# Run all tests (headless)
npm run test:e2e

# Run with UI for debugging
npm run test:e2e:ui

# Run specific test file
npx playwright test tests/e2e/login.spec.ts

# Run tests in specific browser
npx playwright test --project=chromium

# Run in headed mode (see browser)
npx playwright test --headed

# Debug specific test
npx playwright test --debug tests/e2e/login.spec.ts
```

### CI/CD

In CI environments, tests will:
- Run with 2 retries
- Use single worker (sequential execution)
- Not reuse existing dev server
- Generate HTML reports on failure

Example GitHub Actions workflow:

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          CI: true
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Debugging Tests

### Playwright Inspector

```bash
# Launch inspector
npm run test:e2e:debug

# Or for specific test
npx playwright test --debug tests/e2e/login.spec.ts
```

The inspector allows you to:
- Step through tests line by line
- Inspect DOM elements
- View console logs
- See network requests

### Trace Viewer

Traces are automatically captured on first retry. View them:

```bash
npx playwright show-trace trace.zip
```

Or use the trace viewer in the HTML report:

```bash
npm run test:e2e:report
```

### Screenshots

Screenshots are taken automatically on failure. Find them in:
```
test-results/
  <test-name>/
    test-failed-1.png
```

## Test Coverage

Current test coverage includes:

- ✅ Authentication (login, logout, error handling)
- ✅ Scheduled sends (list, filter, cancel)
- ✅ Invite modal (campaign selection, scheduling)
- ✅ Sponsor response flow (existing)

### Areas to Add Coverage

- Campaign creation and editing
- Sponsor management (add, edit, delete, import CSV)
- Email template management
- Reminders configuration
- Settings management
- Super admin features
- Dark mode toggle
- Responsive layouts (mobile/tablet)

## Troubleshooting

### Issue: Tests timing out

**Solution**: Increase timeout in specific tests
```typescript
test('slow operation', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // test code
});
```

### Issue: Authentication not working

**Solution**:
1. Verify test credentials exist in database
2. Check Supabase URL and keys in `.env`
3. Ensure RLS policies allow test user access

### Issue: Flaky tests

**Solution**:
1. Add explicit waits for async operations
2. Use `waitForLoadState('networkidle')` for heavy pages
3. Avoid `waitForTimeout()`, use visibility checks instead

### Issue: Can't find element

**Solution**:
1. Verify `data-testid` attribute exists in component
2. Check if element is within correct page/modal
3. Use Playwright Inspector to inspect DOM

## Performance

### Parallel Execution

Tests run in parallel by default. Disable for debugging:

```bash
npx playwright test --workers=1
```

### Sharding (CI)

For large test suites, use sharding:

```bash
# Run shard 1 of 4
npx playwright test --shard=1/4

# Run shard 2 of 4
npx playwright test --shard=2/4
```

## Continuous Integration

### GitHub Actions

The project includes a complete GitHub Actions workflow for running Playwright tests in CI.

**Workflow File**: `.github/workflows/playwright.yml`

#### Features

1. **Automatic Triggers**:
   - Push to main/master/develop branches
   - Pull requests to main/master/develop
   - Manual workflow dispatch

2. **Test Sharding**:
   - Runs tests in parallel across 2 shards
   - Reduces total CI time by ~50%
   - Configurable shard count in matrix strategy

3. **Browser Installation**:
   - Automatically installs Playwright browsers
   - Includes system dependencies with `--with-deps`

4. **Environment Variables**:
   - Reads secrets from GitHub repository settings
   - Required secrets:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `VITE_SUPABASE_SERVICE_ROLE_KEY` (optional)

5. **Artifact Storage**:
   - Playwright HTML reports (30 days retention)
   - Test results including screenshots (30 days)
   - Trace files on failure (30 days)
   - Merged reports from all shards

6. **PR Comments**:
   - Automatically comments on pull requests
   - Links to test results and artifacts
   - Shows test summary

#### Setup Instructions

1. **Add GitHub Secrets**:
   - Go to repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Add the following secrets:
     ```
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (optional)
     ```

2. **Enable GitHub Actions**:
   - Ensure Actions are enabled in repository settings
   - Workflow will run automatically on push/PR

3. **View Results**:
   - Go to Actions tab in repository
   - Click on workflow run
   - View test results and download artifacts

#### Workflow Structure

```yaml
name: Playwright E2E Tests

on:
  push:
    branches: [main, master, develop]
  pull_request:
    branches: [main, master, develop]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shardIndex: [1, 2]
        shardTotal: [2]
    steps:
      - Checkout code
      - Setup Node.js 18
      - Install dependencies (npm ci)
      - Install Playwright browsers
      - Run tests with sharding
      - Upload artifacts (reports, traces)

  merge-reports:
    needs: [test]
    runs-on: ubuntu-latest
    steps:
      - Download all shard reports
      - Merge into single HTML report
      - Upload merged report
      - Comment on PR (if applicable)
```

#### Customization

**Change shard count**:
```yaml
strategy:
  matrix:
    shardIndex: [1, 2, 3, 4]  # 4 shards
    shardTotal: [4]
```

**Change Node version**:
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'  # Use Node 20
```

**Change timeout**:
```yaml
jobs:
  test:
    timeout-minutes: 90  # Increase to 90 minutes
```

**Add test database setup**:
```yaml
- name: Setup test database
  run: |
    npx supabase db reset --db-url ${{ secrets.DATABASE_URL }}
    npx supabase db push --db-url ${{ secrets.DATABASE_URL }}
```

#### Viewing Test Results

**HTML Report**:
1. Go to Actions → Workflow run
2. Scroll to Artifacts section
3. Download `playwright-merged-report`
4. Extract and open `index.html`

**Traces**:
1. Download `playwright-traces-*` artifact
2. Run `npx playwright show-trace trace.zip`
3. Interactive trace viewer opens

**Screenshots**:
1. Download `test-results-*` artifact
2. Find screenshots in `test-results/` directory

#### CI/CD Best Practices

1. **Use test database**: Don't run tests against production
2. **Seed test data**: Create fixtures in CI environment
3. **Parallel execution**: Use sharding for faster runs
4. **Retry flaky tests**: Configure in `playwright.config.ts`
5. **Cache dependencies**: Use `cache: 'npm'` in setup-node
6. **Store artifacts**: Keep reports for debugging
7. **Clean up**: Delete old test data after runs

#### Status Badge

Add to README.md:
```markdown
![Playwright Tests](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/playwright.yml/badge.svg)
```

### Other CI Platforms

Playwright tests also work with:

- **GitLab CI**: Use `.gitlab-ci.yml` with similar structure
- **CircleCI**: Use `.circleci/config.yml`
- **Jenkins**: Use Jenkinsfile with Node plugin
- **Azure DevOps**: Use azure-pipelines.yml

See [Playwright CI documentation](https://playwright.dev/docs/ci) for platform-specific examples.

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)

## Next Steps

1. Add more test coverage for untested features
2. Set up visual regression testing with Playwright screenshots
3. Configure tests in CI/CD pipeline
4. Create test data fixtures for consistent test state
5. Add accessibility testing with `@axe-core/playwright`
