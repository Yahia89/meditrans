# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: credits-trip.spec.mjs >> Patient credit trip navigation: direct dated trip bookmark
- Location: tests/directories-ui/credits-trip.spec.mjs:38:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Show all', exact: true })
Expected: visible
Timeout: 12000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('button', { name: 'Show all', exact: true }) with timeout 12000ms
  - waiting for getByRole('button', { name: 'Show all', exact: true })

```

```yaml
- list:
  - listitem:
    - button "Startup Alpha Company CRM System"
- list:
  - listitem:
    - button "Dashboard"
  - listitem:
    - button "Trips"
  - listitem:
    - button "Live"
  - listitem:
    - button "Patients"
  - listitem:
    - button "Drivers"
  - listitem:
    - button "STS Inspection"
  - listitem:
    - button "Employees"
  - listitem:
    - button "Upload"
  - listitem:
    - button "Summary"
  - listitem:
    - button "Billing & Payments"
  - listitem:
    - button "Client Credits"
- list:
  - listitem:
    - button "Company"
- list:
  - listitem:
    - button "SA Startup Alpha User startup-a@example.invalid"
- main:
  - alert:
    - img
    - heading "Page Error" [level=2]
    - paragraph: This page encountered an unexpected error. Try again, or open another page from the sidebar.
    - paragraph: "Reference: UI-RENDER-LOOP-5F601DF0"
    - button "Try again"
- region "Notifications alt+T"
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | import { writeFile } from 'node:fs/promises';
  3  | import { directoryRows, installDirectoryFixtures } from './fixtures.mjs';
  4  | 
  5  | test.use({ timezoneId: 'America/Chicago' });
  6  | 
  7  | const patient = { ...directoryRows.patients[0], monthly_credit: 300, notes: null, referral_date: null,
  8  |   referral_expiration_date: null, credit_used_for: 'Synthetic transport', service_type: 'Ambulatory' };
  9  | const trip = { id: '00000000-0000-4000-8000-000000009301', org_id: patient.org_id, patient_id: patient.id,
  10 |   pickup_time: '2026-10-02T15:00:00.000Z', status: 'completed', trip_type: 'One Way',
  11 |   pickup_location: 'Synthetic pickup', dropoff_location: 'Synthetic destination', distance_miles: 10,
  12 |   actual_distance_miles: 10, total_waiting_minutes: 0, billing_details: { service_type: 'Ambulatory' },
  13 |   driver: null, created_at: '2026-10-01T12:00:00.000Z' };
  14 | 
  15 | async function installCreditFixtures(context, page, baseURL) {
  16 |   const fixture = await installDirectoryFixtures(context, page, baseURL, { savedView: 'list' });
  17 |   await page.clock.install({ time: new Date('2026-10-14T12:00:00.000Z') });
  18 |   await page.route('**/rest/v1/**', async route => {
  19 |     const url = new URL(route.request().url());
  20 |     const table = url.pathname.split('/').at(-1);
  21 |     if (table === 'patients' && url.searchParams.get('id') === `eq.${patient.id}`) return route.fulfill({ json: patient });
  22 |     if (table === 'trips' && url.searchParams.get('patient_id') === `eq.${patient.id}`) return route.fulfill({ json: [trip] });
  23 |     return route.fallback();
  24 |   });
  25 |   await page.addInitScript(() => { window.__patientTripMemoCalls = []; });
  26 |   if (process.env.PATIENT_DETAILS_DIAGNOSTIC === '1') {
  27 |     await page.route(/\/src\/components\/patient-details-page\.tsx(?:\?.*)?$/, async route => {
  28 |       const response = await route.fetch();
  29 |       const body = await response.text();
  30 |       const instrumented = body.replace(/useMemo\(\(\) => \{\s*setTripPage\(1\);\s*\}, \[tripMonth, tripStatusFilter, selectedTripDate\]\);/, matched => matched.replace('setTripPage(1);', `window.__patientTripMemoCalls.push({ at: performance.now(), date: selectedTripDate?.toISOString() ?? null, sameDateIdentity: window.__previousTripDate === selectedTripDate, stack: new Error("Observed original patient details pagination memo setter").stack }); window.__previousTripDate = selectedTripDate; setTripPage(1);`));
  31 |       await route.fulfill({ response, body: instrumented });
  32 |     });
  33 |   }
  34 |   return fixture;
  35 | }
  36 | 
  37 | for (const entry of ['credit calendar click', 'direct dated trip bookmark']) {
  38 |   test(`Patient credit trip navigation: ${entry}`, async ({ context, page, baseURL }, info) => {
  39 |     const fixture = await installCreditFixtures(context, page, baseURL);
  40 |     const dateQuery = '&date=2026-10-02T05%3A00%3A00.000Z';
  41 |     try {
  42 |       await page.goto(`/?page=patient-details&id=${patient.id}&section=${entry === 'credit calendar click' ? 'credits' : `trips${dateQuery}`}`);
  43 |       if (entry === 'credit calendar click') {
  44 |         await expect(page.getByText('Credit Overview', { exact: true })).toBeVisible();
  45 |         const dayWithSpend = page.locator('div.aspect-square.cursor-pointer').filter({ hasText: '$46' });
  46 |         await expect(dayWithSpend).toHaveCount(1);
  47 |         await dayWithSpend.click();
  48 |       }
> 49 |       await expect(page.getByRole('button', { name: 'Show all', exact: true })).toBeVisible();
     |                                                                                 ^ Error: expect(locator).toBeVisible() failed
  50 |       await expect(page.getByText('Synthetic pickup', { exact: true })).toBeVisible();
  51 |       expect(new URL(page.url()).searchParams.get('section')).toBe('trips');
  52 |       expect(new URL(page.url()).searchParams.get('date')).toBe('2026-10-02T05:00:00.000Z');
  53 |       expect(fixture.errors).toEqual([]);
  54 |       expect(fixture.consoleErrors).toEqual([]);
  55 |     } finally {
  56 |       await writeFile(info.outputPath('credits-trip-evidence.json'), JSON.stringify({ synthetic: true, entry,
  57 |         mode: process.env.DIRECTORIES_DEV === '1' ? 'development StrictMode' : 'production preview',
  58 |         instrumentation: process.env.PATIENT_DETAILS_DIAGNOSTIC === '1' ? 'Observation before unchanged setter; no state or dependency change' : null,
  59 |         url: page.url(), errors: fixture.errors, consoleErrors: fixture.consoleErrors, diagnostics: await fixture.captureDiagnostics(),
  60 |         setterCalls: await page.evaluate(() => window.__patientTripMemoCalls), body: await page.locator('main').first().innerText(),
  61 |       }, null, 2));
  62 |     }
  63 |   });
  64 | }
  65 | 
```