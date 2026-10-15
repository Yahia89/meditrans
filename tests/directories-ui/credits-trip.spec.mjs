import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { directoryRows, installDirectoryFixtures } from './fixtures.mjs';
import { revalidateIdentity } from '../startup-ui/fixtures.mjs';

test.use({ timezoneId: 'America/Chicago' });

const patient = { ...directoryRows.patients[0], monthly_credit: 300, notes: null, referral_date: null,
  referral_expiration_date: null, credit_used_for: 'Synthetic transport', service_type: 'Ambulatory' };
const trip = { id: '00000000-0000-4000-8000-000000009301', org_id: patient.org_id, patient_id: patient.id,
  pickup_time: '2026-10-02T15:00:00.000Z', status: 'completed', trip_type: 'One Way',
  pickup_location: 'Synthetic pickup', dropoff_location: 'Synthetic destination', distance_miles: 10,
  actual_distance_miles: 10, total_waiting_minutes: 0, billing_details: { service_type: 'Ambulatory' },
  driver: null, driver_id: null, patient, created_at: '2026-10-01T12:00:00.000Z' };

async function installCreditFixtures(context, page, baseURL, initialTrips = [trip]) {
  const fixture = await installDirectoryFixtures(context, page, baseURL, { savedView: 'list' });
  let trips = initialTrips;
  const tripReads = [];
  await page.clock.install({ time: new Date('2026-10-14T12:00:00.000Z') });
  await page.route('**/rest/v1/**', async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').at(-1);
    if (table === 'patients' && url.searchParams.get('id') === `eq.${patient.id}`) return route.fulfill({ json: patient });
    if (table === 'trips' && url.searchParams.get('patient_id') === `eq.${patient.id}`) {
      tripReads.push(url.href);
      return route.fulfill({ json: trips });
    }
    if (table === 'trips' && url.searchParams.has('id')) return route.fulfill({ json: trips.find(item => `eq.${item.id}` === url.searchParams.get('id')) ?? null });
    return route.fallback();
  });
  // Complete the synthetic unload keepalive directly, including its CORS
  // preflight, instead of forwarding it through several async fixture layers.
  await page.route('**/rest/v1/rpc/update_user_presence', route => route.fulfill({
    status: route.request().method() === 'OPTIONS' ? 204 : 200,
    headers: { 'access-control-allow-origin': new URL(baseURL).origin,
      'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
      'content-type': 'application/json' },
    body: route.request().method() === 'OPTIONS' ? '' : 'null',
  }));
  if (context.browser()?.browserType().name() === 'webkit') {
    // WebKit cancels Playwright-intercepted presence fetches as the document unloads,
    // emitting a native access-control pageerror even when fetch has a catch.
    // Fulfill only this already-synthetic presence endpoint in the browser. The
    // application call still executes; no render or other fetch error is hidden.
    await page.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        if (typeof input === 'string' && new URL(input, location.href).pathname === '/rest/v1/rpc/update_user_presence') {
          const calls = JSON.parse(sessionStorage.getItem('synthetic-presence-calls') ?? '[]');
          calls.push({ status: JSON.parse(init.body).p_status, keepalive: init?.keepalive === true });
          sessionStorage.setItem('synthetic-presence-calls', JSON.stringify(calls));
          return Promise.resolve(new Response('null', { status: 200, headers: { 'content-type': 'application/json' } }));
        }
        return originalFetch(input, init);
      };
    });
  }
  await page.addInitScript(() => { window.__patientTripMemoCalls = []; });
  if (process.env.PATIENT_DETAILS_DIAGNOSTIC === '1') {
    await page.route(/\/src\/components\/patient-details-page\.tsx(?:\?.*)?$/, async route => {
      const response = await route.fetch();
      const body = await response.text();
      const instrumented = body.replace(/useMemo\(\(\) => \{\s*setTripPage\(1\);\s*\}, \[\s*tripMonth,\s*tripStatusFilter,\s*selectedTripDate\s*\]\);/, matched => matched.replace('setTripPage(1);', `window.__patientTripMemoCalls.push({ at: performance.now(), date: selectedTripDate?.toISOString() ?? null, sameDateIdentity: window.__previousTripDate === selectedTripDate, stack: new Error("Observed original patient details pagination memo setter").stack }); window.__previousTripDate = selectedTripDate; setTripPage(1);`));
      expect(instrumented, 'Response-only memo observation must match the original setter').not.toBe(body);
      await route.fulfill({ response, body: instrumented });
    });
  }
  return { ...fixture, tripReads, replaceTrips: next => { trips = next; } };
}

for (const entry of ['credit calendar click', 'direct dated trip bookmark']) {
  test(`Patient credit trip navigation: ${entry}`, async ({ context, page, baseURL }, info) => {
    const fixture = await installCreditFixtures(context, page, baseURL);
    const dateQuery = '&date=2026-10-02T05%3A00%3A00.000Z';
    try {
      if (entry === 'credit calendar click') {
        await page.goto('/?page=patients');
        await page.getByText(patient.full_name, { exact: true }).click();
        await expect(page.getByRole('heading', { name: patient.full_name, exact: true })).toBeVisible();
        await page.getByRole('button', { name: /^Credits/ }).click();
        await expect(page.getByText('Credit Overview', { exact: true })).toBeVisible();
        const dayWithSpend = page.locator('div.aspect-square.cursor-pointer').filter({ hasText: '$46' });
        await expect(dayWithSpend).toHaveCount(1);
        await dayWithSpend.click();
      } else {
        await page.goto(`/?page=patient-details&id=${patient.id}&section=trips${dateQuery}`);
      }
      await expect(page.getByRole('button', { name: 'Show all', exact: true })).toBeVisible();
      await expect(page.getByText('Synthetic pickup', { exact: true })).toBeVisible();
      expect(new URL(page.url()).searchParams.get('section')).toBe('trips');
      expect(new URL(page.url()).searchParams.get('date')).toBe('2026-10-02T05:00:00.000Z');
      await page.getByText('Synthetic pickup', { exact: true }).click();
      await expect(page.getByRole('button', { name: 'Back to Trips', exact: true })).toBeVisible();
      expect(new URL(page.url()).searchParams.get('page')).toBe('trip-details');
      expect(new URL(page.url()).searchParams.get('tripId')).toBe(trip.id);
      await page.getByRole('button', { name: 'Back to Trips', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Show all', exact: true })).toBeVisible();
      await expect(page.getByText('Synthetic pickup', { exact: true })).toBeVisible();
      expect(new URL(page.url()).searchParams.get('page')).toBe('patient-details');
      await page.goBack();
      await expect(page.getByRole('button', { name: 'Back to Trips', exact: true })).toBeVisible();
      await page.goForward();
      await expect(page.getByRole('button', { name: 'Show all', exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByText('Synthetic pickup', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Show all', exact: true }).click();
      await expect.poll(() => new URL(page.url()).searchParams.get('date')).toBeNull();
      await expect(page.getByText('Synthetic pickup', { exact: true })).toBeVisible();
      expect(fixture.errors).toEqual([]);
      expect(fixture.consoleErrors).toEqual([]);
      if (context.browser()?.browserType().name() === 'webkit') {
        expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('synthetic-presence-calls') ?? '[]').length)).toBeGreaterThan(0);
      }
    } finally {
      await writeFile(info.outputPath('credits-trip-evidence.json'), JSON.stringify({ synthetic: true, entry,
        mode: process.env.DIRECTORIES_DEV === '1' ? 'development StrictMode' : 'production preview',
        instrumentation: process.env.PATIENT_DETAILS_DIAGNOSTIC === '1' ? 'Observation before unchanged setter; no state or dependency change' : null,
        url: page.url(), errors: fixture.errors, consoleErrors: fixture.consoleErrors, diagnostics: await fixture.captureDiagnostics(),
        setterCalls: await page.evaluate(() => window.__patientTripMemoCalls), body: await page.locator('main').first().innerText(),
        presenceFixture: context.browser()?.browserType().name() === 'webkit' ? 'Only synthetic update_user_presence endpoint is fulfilled in browser to avoid WebKit route-unload cancellation' : null,
        presenceFixtureCalls: await page.evaluate(() => JSON.parse(sessionStorage.getItem('synthetic-presence-calls') ?? '[]')),
      }, null, 2));
    }
  });
}

test('Patient credit trip pagination resets filters, preserves refresh, and clamps shrink', async ({ context, page, baseURL }, info) => {
  const trips = Array.from({ length: 13 }, (_, index) => ({ ...trip,
    id: `00000000-0000-4000-8000-${String(9301 + index).padStart(12, '0')}`,
    pickup_location: `Synthetic pickup ${String(index + 1).padStart(2, '0')}`,
    pickup_time: index < 7 ? trip.pickup_time : '2026-10-03T15:00:00.000Z',
  }));
  const fixture = await installCreditFixtures(context, page, baseURL, trips);
  const nextPage = async label => page.getByText(label, { exact: true }).locator('..').getByRole('button').last().click();
  try {
    await page.goto(`/?page=patient-details&id=${patient.id}&section=credits`);
    await expect(page.getByText('Credit Overview', { exact: true })).toBeVisible();
    await page.locator('div.aspect-square.cursor-pointer').filter({ hasText: '$322' }).click();
    await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
    await nextPage('Page 1 of 2');
    await expect(page.getByText(trips[6].pickup_location, { exact: true })).toBeVisible();
    const beforeRefresh = fixture.tripReads.length;
    await revalidateIdentity(page);
    await expect.poll(() => fixture.tripReads.length).toBeGreaterThan(beforeRefresh);
    await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
    await expect(page.getByText(trips[6].pickup_location, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Show all', exact: true }).click();
    await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
    await nextPage('Page 1 of 3');
    await page.locator('select:visible').selectOption('pending');
    await expect(page.getByText('No trips found', { exact: true })).toBeVisible();
    await expect(page.locator('main').first()).not.toContainText(/Page 0|of 0|NaN|Infinity/);
    await page.locator('select:visible').selectOption('all');
    await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
    await nextPage('Page 1 of 3');
    await page.getByRole('button', { name: 'October 2026', exact: true }).locator('..').getByRole('button').first().click();
    await expect(page.getByText('No trips found', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'September 2026', exact: true }).locator('..').getByRole('button').last().click();
    await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
    await nextPage('Page 1 of 3');
    await page.getByRole('button', { name: 'October 2026', exact: true }).click();
    await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
    await nextPage('Page 1 of 3');
    await nextPage('Page 2 of 3');
    await expect(page.getByText(trips[12].pickup_location, { exact: true })).toBeVisible();
    fixture.replaceTrips(trips.slice(0, 2));
    const beforeShrink = fixture.tripReads.length;
    await revalidateIdentity(page);
    await expect.poll(() => fixture.tripReads.length).toBeGreaterThan(beforeShrink);
    await expect(page.getByText(trips[0].pickup_location, { exact: true })).toBeVisible();
    await expect(page.getByText(trips[12].pickup_location, { exact: true })).toHaveCount(0);
    await expect(page.locator('main').first()).not.toContainText(/Page 0|of 0|NaN|Infinity/);
    expect(fixture.errors).toEqual([]);
    expect(fixture.consoleErrors).toEqual([]);
  } finally {
    await writeFile(info.outputPath('credits-pagination-evidence.json'), JSON.stringify({ synthetic: true,
      url: page.url(), errors: fixture.errors, consoleErrors: fixture.consoleErrors, diagnostics: await fixture.captureDiagnostics(),
      tripReads: fixture.tripReads.length, body: await page.locator('main').first().innerText(),
    }, null, 2));
  }
});

for (const date of ['not-a-date', 'Infinity']) {
  test(`Patient trip malformed date bookmark falls back to month: ${date}`, async ({ context, page, baseURL }) => {
    const fixture = await installCreditFixtures(context, page, baseURL);
    await page.goto(`/?page=patient-details&id=${patient.id}&section=trips&date=${date}`);
    await expect(page.getByText('Synthetic pickup', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'October 2026', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show all', exact: true })).toHaveCount(0);
    expect(fixture.errors).toEqual([]);
    expect(fixture.consoleErrors).toEqual([]);
  });
}
