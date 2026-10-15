# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: credits-trip.spec.mjs >> Patient credit trip pagination resets filters, preserves refresh, and clamps shrink
- Location: tests/directories-ui/credits-trip.spec.mjs:96:1

# Error details

```
Error: expect(locator).not.toContainText(expected) failed

Locator: locator('main')
Expected pattern: not /Page 0|of 0|NaN|Infinity/
Error: strict mode violation: locator('main') resolved to 2 elements:
    1) <main data-testid="workspace-main" class="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">…</main> aka getByTestId('workspace-main')
    2) <main data-slot="sidebar-inset" class="bg-background relative flex w-full flex-1 flex-col md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2 min-w-0">…</main> aka getByText('Toggle SidebarPatient DetailsDirectory Alpha ClientClient ProfileAccess')

Call log:
  - Expect "not toContainText" locator('main') with timeout 12000ms
  - waiting for locator('main')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - generic [ref=e6]:
      - list [ref=e8]:
        - listitem [ref=e9]:
          - button "Startup Alpha Company CRM System" [ref=e10] [cursor=pointer]:
            - generic [ref=e11]:
              - generic [ref=e12]: Startup Alpha Company
              - generic [ref=e13]: CRM System
      - list [ref=e15]:
        - listitem [ref=e16]:
          - button "Dashboard" [ref=e17] [cursor=pointer]
        - listitem [ref=e26]:
          - button "Trips" [ref=e27] [cursor=pointer]
        - listitem [ref=e33]:
          - button "Live" [ref=e34] [cursor=pointer]
        - listitem [ref=e42]:
          - button "Patients" [ref=e43] [cursor=pointer]
        - listitem [ref=e50]:
          - button "Drivers" [ref=e51] [cursor=pointer]
        - listitem [ref=e58]:
          - button "STS Inspection" [ref=e59] [cursor=pointer]
        - listitem [ref=e68]:
          - button "Employees" [ref=e69] [cursor=pointer]
        - listitem [ref=e77]:
          - button "Upload" [ref=e78] [cursor=pointer]
        - listitem [ref=e84]:
          - button "Summary" [ref=e85] [cursor=pointer]
        - listitem [ref=e93]:
          - button "Billing & Payments" [ref=e94] [cursor=pointer]
        - listitem [ref=e102]:
          - button "Client Credits" [ref=e103] [cursor=pointer]
      - generic [ref=e110]:
        - list [ref=e111]:
          - listitem [ref=e112]:
            - button "Company" [ref=e113] [cursor=pointer]
        - list [ref=e121]:
          - listitem [ref=e122]:
            - button "SA Startup Alpha User startup-a@example.invalid" [ref=e123] [cursor=pointer]:
              - generic [ref=e124]: SA
              - generic [ref=e126]:
                - generic [ref=e127]: Startup Alpha User
                - generic [ref=e128]: startup-a@example.invalid
    - main [ref=e132]:
      - main [ref=e133]:
        - generic [ref=e135]:
          - button "Toggle Sidebar" [ref=e136] [cursor=pointer]
          - navigation "breadcrumb" [ref=e138]:
            - list [ref=e139]:
              - listitem [ref=e140]:
                - link "Patient Details" [disabled] [ref=e141]
        - generic [ref=e143]:
          - generic [ref=e144]:
            - generic [ref=e145]:
              - button [ref=e146] [cursor=pointer]
              - generic [ref=e150]:
                - heading "Directory Alpha Client" [level=1] [ref=e151]
                - generic [ref=e152]:
                  - generic [ref=e153]: Client Profile
                  - generic [ref=e154]: Access Active
                  - generic [ref=e155]: "ID: 00000000"
            - generic [ref=e156]:
              - button "Print Out" [ref=e157] [cursor=pointer]
              - button "Edit Details" [ref=e158] [cursor=pointer]
              - button "Disable Access" [ref=e159] [cursor=pointer]
              - button "Delete Patient" [ref=e160] [cursor=pointer]
          - generic [ref=e162]:
            - button "Overview" [ref=e163] [cursor=pointer]
            - button "Documents 0" [ref=e167] [cursor=pointer]:
              - text: Documents
              - generic [ref=e171]: "0"
            - button "Trip History 13" [ref=e172] [cursor=pointer]:
              - text: Trip History
              - generic [ref=e176]: "13"
            - button "Credits $300" [ref=e177] [cursor=pointer]:
              - text: Credits
              - generic [ref=e181]: $300
            - button "Trips summary" [ref=e182] [cursor=pointer]
          - generic [ref=e186]:
            - generic [ref=e188]:
              - generic [ref=e189]:
                - button [ref=e190] [cursor=pointer]
                - button "October 2026" [ref=e191] [cursor=pointer]
                - button [ref=e192] [cursor=pointer]
              - generic [ref=e193]:
                - combobox [ref=e196]:
                  - option "All Status"
                  - option "Pending" [selected]
                  - option "Assigned"
                  - option "In Progress"
                  - option "Completed"
                  - option "Cancelled"
                - generic [ref=e197]: 0 trips
            - generic [ref=e205]:
              - heading "No trips found" [level=3] [ref=e206]
              - paragraph [ref=e207]: No trips scheduled for October 2026 with status "pending"
    - region "Notifications alt+T"
  - button "Open Tanstack query devtools" [ref=e259] [cursor=pointer]
```

# Test source

```ts
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
  83  |       expect(fixture.errors).toEqual([]);
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
> 121 |     await expect(page.locator('main')).not.toContainText(/Page 0|of 0|NaN|Infinity/);
      |                                            ^ Error: expect(locator).not.toContainText(expected) failed
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
  141 |     await expect(page.locator('main')).not.toContainText(/Page 0|of 0|NaN|Infinity/);
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
```