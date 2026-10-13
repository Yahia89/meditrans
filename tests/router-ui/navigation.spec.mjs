import { expect, test } from '@playwright/test';
import { broadcastSession, createStartupState, installStartupFixtures, syntheticSession, users } from '../startup-ui/fixtures.mjs';

async function setup(context, page) {
  const state = createStartupState();
  await installStartupFixtures(context, state);
  await page.route('http://localhost:5187/**', route => route.continue());
  const presence = [];
  const documents = [];
  const chunks = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.endsWith('/rpc/update_user_presence')) presence.push(request.postDataJSON().p_status);
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
    if (new URL(request.url()).pathname.startsWith('/assets/')) chunks.push(new URL(request.url()).pathname);
  });
  return { state, presence, documents, chunks };
}

function retainedQuery(page, expectedPage) {
  const url = new URL(page.url());
  expect(url.searchParams.get('page')).toBe(expectedPage);
  expect(url.searchParams.getAll('filter')).toEqual(['open', 'closed']);
  expect(url.searchParams.get('limit')).toBe('20');
  expect(url.hash).toBe('#retained-fragment');
}

test('dashboard, trips, browser history and manual billing navigation preserve the session and query', async ({ context, page }) => {
  const { state, presence, documents } = await setup(context, page);
  await page.goto('/?page=dashboard&filter=open&filter=closed&limit=20#retained-fragment');
  await expect(page.getByRole('heading', { name: 'Fleet Performance' })).toBeVisible();
  await expect.poll(() => presence).toEqual(['online']);
  await page.getByRole('button', { name: 'Trips', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Trip Scheduler' })).toBeVisible();
  retainedQuery(page, 'trips');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Fleet Performance' })).toBeVisible();
  retainedQuery(page, 'dashboard');
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Trip Scheduler' })).toBeVisible();
  retainedQuery(page, 'trips');
  await page.getByRole('button', { name: 'Billing & Payments', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add billing record', exact: true }).first()).toBeVisible();
  retainedQuery(page, 'medicaid-billing');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Trip Scheduler' })).toBeVisible();
  retainedQuery(page, 'trips');
  expect(documents).toHaveLength(1);
  expect(presence).toEqual(['online']);
  expect(state.requests.filter(request => request.table === 'organization_memberships')).toHaveLength(1);
  expect(await page.evaluate(() => window.__startupLocationWatches)).toBe(0);
});

test('opening and explicitly cancelling a trip dialog preserves scheduler filters and unrelated URL state', async ({ context, page }) => {
  const { state, presence, chunks } = await setup(context, page);
  await page.goto('/?page=trips&filter=open&filter=closed&limit=20#retained-fragment');
  await expect(page.getByRole('heading', { name: 'Trip Scheduler' })).toBeVisible();
  await page.getByPlaceholder('Search trips...').fill('Synthetic search');
  await page.locator('select').selectOption('pending');
  expect(chunks.filter(chunk => /\/(TripDialog|CreateDischargeDialog|BulkImportDialog|upload-page)-/.test(chunk))).toHaveLength(0);
  await page.getByRole('button', { name: 'New Trip', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Schedule New Trip' })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('modal')).toBe('create');
  retainedQuery(page, 'trips');
  const notes = page.getByPlaceholder('Add any specific details for the driver or trip...');
  await notes.fill('Synthetic unsaved trip notes');
  await broadcastSession(page, 'TOKEN_REFRESHED', syntheticSession(users.a));
  await page.evaluate(async () => {
    // Let the broadcast and React commit settle before checking the draft.
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  await expect(notes).toHaveValue('Synthetic unsaved trip notes');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('modal')).toBeNull();
  retainedQuery(page, 'trips');
  await expect(page.getByPlaceholder('Search trips...')).toHaveValue('Synthetic search');
  await expect(page.locator('select')).toHaveValue('pending');
  expect(presence).toEqual(['online']);
  expect(state.requests.filter(request => ['POST', 'PATCH', 'DELETE'].includes(request.method)
    && !request.path.includes('/rpc/'))).toHaveLength(0);
});

test('the nuqs page-size adapter and batched detail route share one history without dropping filters', async ({ context, page }) => {
  const { presence, documents } = await setup(context, page);
  await page.goto('/?page=patients&filter=open&filter=closed&limit=10#retained-fragment');
  await expect(page.getByRole('heading', { name: 'Alpha Private Fixture Rider', exact: true })).toBeVisible();
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Show 25', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('limit')).toBe('25');
  await page.getByRole('heading', { name: 'Alpha Private Fixture Rider', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('patient-details');
  await expect(page.getByRole('heading', { level: 1, name: 'Alpha Private Fixture Rider', exact: true })).toBeVisible();
  const detail = new URL(page.url());
  expect(detail.searchParams.get('from')).toBe('patients');
  expect(detail.searchParams.get('id')).toBeTruthy();
  expect(detail.searchParams.get('limit')).toBe('25');
  expect(detail.searchParams.getAll('filter')).toEqual(['open', 'closed']);
  expect(detail.hash).toBe('#retained-fragment');
  await page.goBack();
  await expect(page.getByRole('combobox')).toHaveText('Show 25');
  expect(new URL(page.url()).searchParams.get('page')).toBe('patients');
  expect(new URL(page.url()).searchParams.has('id')).toBe(false);
  expect(new URL(page.url()).searchParams.has('from')).toBe(false);
  await page.goForward();
  await expect(page.getByRole('heading', { level: 1, name: 'Alpha Private Fixture Rider', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('id')).toBe(detail.searchParams.get('id'));
  expect(new URL(page.url()).searchParams.get('limit')).toBe('25');
  expect(presence).toEqual(['online']);
  expect(documents).toHaveLength(1);
});


test('a stale route chunk offers manual refresh without reloading the current document automatically', async ({ context, page }) => {
  const { documents } = await setup(context, page);
  await page.clock.install();
  let nextDeployment = false;
  await page.route('http://localhost:5187/**', async route => {
    if (!nextDeployment) return route.fallback();
    const path = new URL(route.request().url()).pathname;
    if (path !== '/' && !path.endsWith('.js')) return route.fallback();
    const response = await route.fetch();
    // A real deployment publishes a new entry/module graph with new asset URLs.
    // WebKit remembers a failed import across reloads when its URL is unchanged.
    const body = (await response.text()).replace(
      /(["'`])((?:\.{0,2}\/)?(?:assets\/)?[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{6,}\.js)\1/g,
      '$1$2?synthetic-release=next$1',
    );
    return route.fulfill({ response, body });
  });
  const staleChunk = '**/assets/MedicaidBillingPage-*.js';
  await page.route(staleChunk, route => route.fulfill({ status: 404, contentType: 'text/javascript', headers: { 'cache-control': 'no-store' }, body: '' }));
  await page.goto('/?page=dashboard&filter=open&filter=closed&limit=20#retained-fragment');
  await expect(page.getByRole('heading', { name: 'Fleet Performance' })).toBeVisible();
  await page.getByRole('button', { name: 'Billing & Payments', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A newer version is available' })).toBeVisible();
  await expect(page.getByText('Save or copy any unfinished work before refreshing to load the current version.')).toBeVisible();
  await page.clock.fastForward(10_000);
  expect(documents).toHaveLength(1);
  retainedQuery(page, 'medicaid-billing');
  await page.unroute(staleChunk);
  nextDeployment = true;
  await page.getByRole('button', { name: 'Refresh page', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add billing record', exact: true }).first()).toBeVisible();
  retainedQuery(page, 'medicaid-billing');
  expect(documents).toHaveLength(2);
});
