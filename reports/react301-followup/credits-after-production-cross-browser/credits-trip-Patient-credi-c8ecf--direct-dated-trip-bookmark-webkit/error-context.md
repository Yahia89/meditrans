# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: credits-trip.spec.mjs >> Patient credit trip navigation: direct dated trip bookmark
- Location: tests/directories-ui/credits-trip.spec.mjs:46:3

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "/devszzjyobijwldayicb.supabase.co/rest/v1/rpc/update_user_presence due to access control checks.",
+ ]
```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - generic [ref=f1e6]:
    - list [ref=f1e8]:
      - listitem [ref=f1e9]:
        - button "Startup Alpha Company CRM System" [ref=f1e10] [cursor=pointer]:
          - generic [ref=f1e11]:
            - generic [ref=f1e12]: Startup Alpha Company
            - generic [ref=f1e13]: CRM System
    - list [ref=f1e15]:
      - listitem [ref=f1e16]:
        - button "Dashboard" [ref=f1e17] [cursor=pointer]
      - listitem [ref=f1e21]:
        - button "Trips" [ref=f1e22] [cursor=pointer]
      - listitem [ref=f1e26]:
        - button "Live" [ref=f1e27] [cursor=pointer]
      - listitem [ref=f1e35]:
        - button "Patients" [ref=f1e36] [cursor=pointer]
      - listitem [ref=f1e43]:
        - button "Drivers" [ref=f1e44] [cursor=pointer]
      - listitem [ref=f1e50]:
        - button "STS Inspection" [ref=f1e51] [cursor=pointer]
      - listitem [ref=f1e56]:
        - button "Employees" [ref=f1e57] [cursor=pointer]
      - listitem [ref=f1e63]:
        - button "Upload" [ref=f1e64] [cursor=pointer]
      - listitem [ref=f1e69]:
        - button "Summary" [ref=f1e70] [cursor=pointer]
      - listitem [ref=f1e75]:
        - button "Billing & Payments" [ref=f1e76] [cursor=pointer]
      - listitem [ref=f1e81]:
        - button "Client Credits" [ref=f1e82] [cursor=pointer]
    - generic [ref=f1e89]:
      - list [ref=f1e90]:
        - listitem [ref=f1e91]:
          - button "Company" [ref=f1e92] [cursor=pointer]
      - list [ref=f1e98]:
        - listitem [ref=f1e99]:
          - button "SA Startup Alpha User startup-a@example.invalid" [ref=f1e100] [cursor=pointer]:
            - generic [ref=f1e101]: SA
            - generic [ref=f1e103]:
              - generic [ref=f1e104]: Startup Alpha User
              - generic [ref=f1e105]: startup-a@example.invalid
  - main [ref=f1e109]:
    - main [ref=f1e110]:
      - generic [ref=f1e112]:
        - button "Toggle Sidebar" [ref=f1e113] [cursor=pointer]
        - navigation "breadcrumb" [ref=f1e115]:
          - list [ref=f1e116]:
            - listitem [ref=f1e117]:
              - link "Patient Details" [disabled] [ref=f1e118]
      - generic [ref=f1e120]:
        - generic [ref=f1e121]:
          - generic [ref=f1e122]:
            - button [ref=f1e123] [cursor=pointer]
            - generic [ref=f1e126]:
              - heading "Directory Alpha Client" [level=1] [ref=f1e127]
              - generic [ref=f1e128]:
                - generic [ref=f1e129]: Client Profile
                - generic [ref=f1e130]: Access Active
                - generic [ref=f1e131]: "ID: 00000000"
          - generic [ref=f1e132]:
            - button "Print Out" [ref=f1e133] [cursor=pointer]
            - button "Edit Details" [ref=f1e134] [cursor=pointer]
            - button "Disable Access" [ref=f1e135] [cursor=pointer]
            - button "Delete Patient" [ref=f1e136] [cursor=pointer]
        - generic [ref=f1e138]:
          - button "Overview" [ref=f1e139] [cursor=pointer]
          - button "Documents 0" [ref=f1e143] [cursor=pointer]:
            - text: Documents
            - generic [ref=f1e147]: "0"
          - button "Trip History 1" [ref=f1e148] [cursor=pointer]:
            - text: Trip History
            - generic [ref=f1e152]: "1"
          - button "Credits $300" [ref=f1e153] [cursor=pointer]:
            - text: Credits
            - generic [ref=f1e157]: $300
          - button "Trips summary" [ref=f1e158] [cursor=pointer]
        - generic [ref=f1e162]:
          - generic [ref=f1e164]:
            - generic [ref=f1e165]:
              - button [ref=f1e166] [cursor=pointer]
              - button "October 2026" [ref=f1e167] [cursor=pointer]
              - button [ref=f1e168] [cursor=pointer]
            - generic [ref=f1e169]:
              - combobox [ref=f1e172]:
                - option "All Status" [selected]
                - option "Pending"
                - option "Assigned"
                - option "In Progress"
                - option "Completed"
                - option "Cancelled"
              - generic [ref=f1e173]: 1 trip
          - generic [ref=f1e175] [cursor=pointer]:
            - generic [ref=f1e176]:
              - generic [ref=f1e177]: COMPLETED
              - generic [ref=f1e178]: One Way
            - generic [ref=f1e179]:
              - generic [ref=f1e180]: Oct 2, 2026 at 10:00 AM
              - generic [ref=f1e184]:
                - generic [ref=f1e185]: Synthetic pickup
                - generic [ref=f1e190]: Synthetic destination
              - generic [ref=f1e195]: "Driver: Unassigned"
  - region "Notifications alt+T"
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | import { writeFile } from 'node:fs/promises';
  3   | import { directoryRows, installDirectoryFixtures } from './fixtures.mjs';
  4   | import { revalidateIdentity } from '../startup-ui/fixtures.mjs';
  5   | 
  6   | test.use({ timezoneId: 'America/Chicago' });
  7   | 
  8   | const patient = { ...directoryRows.patients[0], monthly_credit: 300, notes: null, referral_date: null,
  9   |   referral_expiration_date: null, credit_used_for: 'Synthetic transport', service_type: 'Ambulatory' };
  10  | const trip = { id: '00000000-0000-4000-8000-000000009301', org_id: patient.org_id, patient_id: patient.id,
  11  |   pickup_time: '2026-10-02T15:00:00.000Z', status: 'completed', trip_type: 'One Way',
  12  |   pickup_location: 'Synthetic pickup', dropoff_location: 'Synthetic destination', distance_miles: 10,
  13  |   actual_distance_miles: 10, total_waiting_minutes: 0, billing_details: { service_type: 'Ambulatory' },
  14  |   driver: null, driver_id: null, patient, created_at: '2026-10-01T12:00:00.000Z' };
  15  | 
  16  | async function installCreditFixtures(context, page, baseURL, initialTrips = [trip]) {
  17  |   const fixture = await installDirectoryFixtures(context, page, baseURL, { savedView: 'list' });
  18  |   let trips = initialTrips;
  19  |   const tripReads = [];
  20  |   await page.clock.install({ time: new Date('2026-10-14T12:00:00.000Z') });
  21  |   await page.route('**/rest/v1/**', async route => {
  22  |     const url = new URL(route.request().url());
  23  |     const table = url.pathname.split('/').at(-1);
  24  |     if (table === 'patients' && url.searchParams.get('id') === `eq.${patient.id}`) return route.fulfill({ json: patient });
  25  |     if (table === 'trips' && url.searchParams.get('patient_id') === `eq.${patient.id}`) {
  26  |       tripReads.push(url.href);
  27  |       return route.fulfill({ json: trips });
  28  |     }
  29  |     if (table === 'trips' && url.searchParams.has('id')) return route.fulfill({ json: trips.find(item => `eq.${item.id}` === url.searchParams.get('id')) ?? null });
  30  |     return route.fallback();
  31  |   });
  32  |   await page.addInitScript(() => { window.__patientTripMemoCalls = []; });
  33  |   if (process.env.PATIENT_DETAILS_DIAGNOSTIC === '1') {
  34  |     await page.route(/\/src\/components\/patient-details-page\.tsx(?:\?.*)?$/, async route => {
  35  |       const response = await route.fetch();
  36  |       const body = await response.text();
  37  |       const instrumented = body.replace(/useMemo\(\(\) => \{\s*setTripPage\(1\);\s*\}, \[\s*tripMonth,\s*tripStatusFilter,\s*selectedTripDate\s*\]\);/, matched => matched.replace('setTripPage(1);', `window.__patientTripMemoCalls.push({ at: performance.now(), date: selectedTripDate?.toISOString() ?? null, sameDateIdentity: window.__previousTripDate === selectedTripDate, stack: new Error("Observed original patient details pagination memo setter").stack }); window.__previousTripDate = selectedTripDate; setTripPage(1);`));
  38  |       expect(instrumented, 'Response-only memo observation must match the original setter').not.toBe(body);
  39  |       await route.fulfill({ response, body: instrumented });
  40  |     });
  41  |   }
  42  |   return { ...fixture, tripReads, replaceTrips: next => { trips = next; } };
  43  | }
  44  | 
  45  | for (const entry of ['credit calendar click', 'direct dated trip bookmark']) {
  46  |   test(`Patient credit trip navigation: ${entry}`, async ({ context, page, baseURL }, info) => {
  47  |     const fixture = await installCreditFixtures(context, page, baseURL);
  48  |     const dateQuery = '&date=2026-10-02T05%3A00%3A00.000Z';
  49  |     try {
  50  |       if (entry === 'credit calendar click') {
  51  |         await page.goto('/?page=patients');
  52  |         await page.getByText(patient.full_name, { exact: true }).click();
  53  |         await expect(page.getByRole('heading', { name: patient.full_name, exact: true })).toBeVisible();
  54  |         await page.getByRole('button', { name: /^Credits/ }).click();
  55  |         await expect(page.getByText('Credit Overview', { exact: true })).toBeVisible();
  56  |         const dayWithSpend = page.locator('div.aspect-square.cursor-pointer').filter({ hasText: '$46' });
  57  |         await expect(dayWithSpend).toHaveCount(1);
  58  |         await dayWithSpend.click();
  59  |       } else {
  60  |         await page.goto(`/?page=patient-details&id=${patient.id}&section=trips${dateQuery}`);
  61  |       }
  62  |       await expect(page.getByRole('button', { name: 'Show all', exact: true })).toBeVisible();
  63  |       await expect(page.getByText('Synthetic pickup', { exact: true })).toBeVisible();
  64  |       expect(new URL(page.url()).searchParams.get('section')).toBe('trips');
  65  |       expect(new URL(page.url()).searchParams.get('date')).toBe('2026-10-02T05:00:00.000Z');
  66  |       await page.getByText('Synthetic pickup', { exact: true }).click();
  67  |       await expect(page.getByRole('button', { name: 'Back to Trips', exact: true })).toBeVisible();
  68  |       expect(new URL(page.url()).searchParams.get('page')).toBe('trip-details');
  69  |       expect(new URL(page.url()).searchParams.get('tripId')).toBe(trip.id);
  70  |       await page.getByRole('button', { name: 'Back to Trips', exact: true }).click();
  71  |       await expect(page.getByRole('button', { name: 'Show all', exact: true })).toBeVisible();
  72  |       await expect(page.getByText('Synthetic pickup', { exact: true })).toBeVisible();
  73  |       expect(new URL(page.url()).searchParams.get('page')).toBe('patient-details');
  74  |       await page.goBack();
  75  |       await expect(page.getByRole('button', { name: 'Back to Trips', exact: true })).toBeVisible();
  76  |       await page.goForward();
  77  |       await expect(page.getByRole('button', { name: 'Show all', exact: true })).toBeVisible();
  78  |       await page.reload();
  79  |       await expect(page.getByText('Synthetic pickup', { exact: true })).toBeVisible();
  80  |       await page.getByRole('button', { name: 'Show all', exact: true }).click();
  81  |       await expect.poll(() => new URL(page.url()).searchParams.get('date')).toBeNull();
  82  |       await expect(page.getByText('Synthetic pickup', { exact: true })).toBeVisible();
> 83  |       expect(fixture.errors).toEqual([]);
      |                              ^ Error: expect(received).toEqual(expected) // deep equality
  84  |       expect(fixture.consoleErrors).toEqual([]);
  85  |     } finally {
  86  |       await writeFile(info.outputPath('credits-trip-evidence.json'), JSON.stringify({ synthetic: true, entry,
  87  |         mode: process.env.DIRECTORIES_DEV === '1' ? 'development StrictMode' : 'production preview',
  88  |         instrumentation: process.env.PATIENT_DETAILS_DIAGNOSTIC === '1' ? 'Observation before unchanged setter; no state or dependency change' : null,
  89  |         url: page.url(), errors: fixture.errors, consoleErrors: fixture.consoleErrors, diagnostics: await fixture.captureDiagnostics(),
  90  |         setterCalls: await page.evaluate(() => window.__patientTripMemoCalls), body: await page.locator('main').first().innerText(),
  91  |       }, null, 2));
  92  |     }
  93  |   });
  94  | }
  95  | 
  96  | test('Patient credit trip pagination resets filters, preserves refresh, and clamps shrink', async ({ context, page, baseURL }, info) => {
  97  |   const trips = Array.from({ length: 13 }, (_, index) => ({ ...trip,
  98  |     id: `00000000-0000-4000-8000-${String(9301 + index).padStart(12, '0')}`,
  99  |     pickup_location: `Synthetic pickup ${String(index + 1).padStart(2, '0')}`,
  100 |     pickup_time: index < 7 ? trip.pickup_time : '2026-10-03T15:00:00.000Z',
  101 |   }));
  102 |   const fixture = await installCreditFixtures(context, page, baseURL, trips);
  103 |   const nextPage = async label => page.getByText(label, { exact: true }).locator('..').getByRole('button').last().click();
  104 |   try {
  105 |     await page.goto(`/?page=patient-details&id=${patient.id}&section=credits`);
  106 |     await expect(page.getByText('Credit Overview', { exact: true })).toBeVisible();
  107 |     await page.locator('div.aspect-square.cursor-pointer').filter({ hasText: '$322' }).click();
  108 |     await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
  109 |     await nextPage('Page 1 of 2');
  110 |     await expect(page.getByText(trips[6].pickup_location, { exact: true })).toBeVisible();
  111 |     const beforeRefresh = fixture.tripReads.length;
  112 |     await revalidateIdentity(page);
  113 |     await expect.poll(() => fixture.tripReads.length).toBeGreaterThan(beforeRefresh);
  114 |     await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  115 |     await expect(page.getByText(trips[6].pickup_location, { exact: true })).toBeVisible();
  116 |     await page.getByRole('button', { name: 'Show all', exact: true }).click();
  117 |     await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
  118 |     await nextPage('Page 1 of 3');
  119 |     await page.locator('select:visible').selectOption('pending');
  120 |     await expect(page.getByText('No trips found', { exact: true })).toBeVisible();
  121 |     await expect(page.locator('main').first()).not.toContainText(/Page 0|of 0|NaN|Infinity/);
  122 |     await page.locator('select:visible').selectOption('all');
  123 |     await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
  124 |     await nextPage('Page 1 of 3');
  125 |     await page.getByRole('button', { name: 'October 2026', exact: true }).locator('..').getByRole('button').first().click();
  126 |     await expect(page.getByText('No trips found', { exact: true })).toBeVisible();
  127 |     await page.getByRole('button', { name: 'September 2026', exact: true }).locator('..').getByRole('button').last().click();
  128 |     await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
  129 |     await nextPage('Page 1 of 3');
  130 |     await page.getByRole('button', { name: 'October 2026', exact: true }).click();
  131 |     await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
  132 |     await nextPage('Page 1 of 3');
  133 |     await nextPage('Page 2 of 3');
  134 |     await expect(page.getByText(trips[12].pickup_location, { exact: true })).toBeVisible();
  135 |     fixture.replaceTrips(trips.slice(0, 2));
  136 |     const beforeShrink = fixture.tripReads.length;
  137 |     await revalidateIdentity(page);
  138 |     await expect.poll(() => fixture.tripReads.length).toBeGreaterThan(beforeShrink);
  139 |     await expect(page.getByText(trips[0].pickup_location, { exact: true })).toBeVisible();
  140 |     await expect(page.getByText(trips[12].pickup_location, { exact: true })).toHaveCount(0);
  141 |     await expect(page.locator('main').first()).not.toContainText(/Page 0|of 0|NaN|Infinity/);
  142 |     expect(fixture.errors).toEqual([]);
  143 |     expect(fixture.consoleErrors).toEqual([]);
  144 |   } finally {
  145 |     await writeFile(info.outputPath('credits-pagination-evidence.json'), JSON.stringify({ synthetic: true,
  146 |       url: page.url(), errors: fixture.errors, consoleErrors: fixture.consoleErrors, diagnostics: await fixture.captureDiagnostics(),
  147 |       tripReads: fixture.tripReads.length, body: await page.locator('main').first().innerText(),
  148 |     }, null, 2));
  149 |   }
  150 | });
  151 | 
  152 | for (const date of ['not-a-date', 'Infinity']) {
  153 |   test(`Patient trip malformed date bookmark falls back to month: ${date}`, async ({ context, page, baseURL }) => {
  154 |     const fixture = await installCreditFixtures(context, page, baseURL);
  155 |     await page.goto(`/?page=patient-details&id=${patient.id}&section=trips&date=${date}`);
  156 |     await expect(page.getByText('Synthetic pickup', { exact: true })).toBeVisible();
  157 |     await expect(page.getByRole('button', { name: 'October 2026', exact: true })).toBeVisible();
  158 |     await expect(page.getByRole('button', { name: 'Show all', exact: true })).toHaveCount(0);
  159 |     expect(fixture.errors).toEqual([]);
  160 |     expect(fixture.consoleErrors).toEqual([]);
  161 |   });
  162 | }
  163 | 
```