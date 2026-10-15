# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stability.spec.mjs >> authorization failure on refresh removes cached Patients and an open private draft
- Location: tests/directories-ui/stability.spec.mjs:427:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Access to clients could not be verified.', { exact: true })
Expected: visible
Timeout: 12000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('Access to clients could not be verified.', { exact: true }) with timeout 12000ms
  - waiting for getByText('Access to clients could not be verified.', { exact: true })

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
  - main:
    - button "Toggle Sidebar"
    - navigation "breadcrumb":
      - list:
        - listitem:
          - link "Patients" [disabled]
    - heading "Clients" [level=1]
    - alert:
      - text: Access to clients could not be verified.
      - button "Retry list"
- region "Notifications alt+T"
```

# Test source

```ts
  338 |   await page.goto('/?page=patients');
  339 |   await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('trips');
  340 |   expect(fixture.collectionRequests('patients')).toHaveLength(0);
  341 |   await expect(row(page, directoryRows.patients[0].full_name)).toHaveCount(0);
  342 |   settled(fixture);
  343 | });
  344 | 
  345 | test('induced render failure is recoverable by navigating to another directory', async ({ context, page, baseURL }) => {
  346 |   const fixture = await installDirectoryFixtures(context, page, baseURL);
  347 |   await page.route(/\/(?:assets\/patients-page-[^/]+\.js|src\/components\/patients-page\.tsx)(?:\?.*)?$/, route => route.fulfill({ contentType: 'application/javascript', body: 'export function PatientsPage(){throw new Error("Synthetic render failure SYNTHETIC_PRIVATE_DIAGNOSTIC_MARKER");}' }));
  348 |   await page.goto('/?page=patients');
  349 |   await expect(page.getByText('Page Error', { exact: true })).toBeVisible();
  350 |   await page.getByRole('button', { name: 'Drivers', exact: true }).click();
  351 |   await expect(row(page, directoryRows.drivers[0].full_name)).toBeVisible();
  352 |   await expect(page.getByText('Page Error', { exact: true })).toHaveCount(0);
  353 |   expect(fixture.errors.every(error => error.includes('Synthetic render failure'))).toBe(true);
  354 |   expect(fixture.consoleMessages.join('\n')).not.toContain('SYNTHETIC_PRIVATE_DIAGNOSTIC_MARKER');
  355 |   await expect(page.locator('body')).not.toContainText('SYNTHETIC_PRIVATE_DIAGNOSTIC_MARKER');
  356 |   expect(fixture.consoleErrors.some(message => message.includes('UI boundary diagnostic'))).toBe(true);
  357 |   expect(JSON.stringify(await fixture.captureDiagnostics())).not.toContain('SYNTHETIC_PRIVATE_DIAGNOSTIC_MARKER');
  358 |   expect(fixture.documents).toHaveLength(1);
  359 | });
  360 | 
  361 | test('induced chunk failure stays distinct and allows navigation without reload loop', async ({ context, page, baseURL }) => {
  362 |   const fixture = await installDirectoryFixtures(context, page, baseURL);
  363 |   let requests = 0;
  364 |   await page.route(/\/(?:assets\/patients-page-[^/]+\.js|src\/components\/patients-page\.tsx)(?:\?.*)?$/, route => { requests++; return route.abort('failed'); });
  365 |   await page.goto('/?page=dashboard');
  366 |   await page.getByRole('button', { name: 'Patients', exact: true }).click();
  367 |   await expect(page.getByText('This page could not load', { exact: true })).toBeVisible();
  368 |   await page.getByRole('button', { name: 'Try again', exact: true }).click();
  369 |   await expect(page.getByText('This page could not load', { exact: true })).toBeVisible();
  370 |   expect(requests).toBeLessThanOrEqual(2);
  371 |   await page.getByRole('button', { name: 'Employees', exact: true }).click();
  372 |   await expect(row(page, directoryRows.employees[0].full_name)).toBeVisible();
  373 |   expect(fixture.documents).toHaveLength(1);
  374 | });
  375 | 
  376 | test('expired saved session refreshes once before Patients collection loads', async ({ context, page, baseURL }) => {
  377 |   const fixture = await installDirectoryFixtures(context, page, baseURL, { expired: true });
  378 |   await page.goto('/?page=patients');
  379 |   await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
  380 |   expect(fixture.state.requests.filter(request => request.table === 'token')).toHaveLength(1);
  381 |   expect(fixture.collectionRequests('patients')).toHaveLength(1);
  382 |   settled(fixture);
  383 | });
  384 | 
  385 | for (const directory of directories.filter(item => item.page !== 'employees')) {
  386 |   test(`${directory.page} successful cached totals survive failed background refresh`, async ({ context, page, baseURL }) => {
  387 |     const fixture = await installDirectoryFixtures(context, page, baseURL);
  388 |     await page.clock.install();
  389 |     await page.goto(`/?page=${directory.page}`);
  390 |     await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
  391 |     const text = directory.page === 'patients' ? 'Trips: 12' : '17 trips';
  392 |     await expect(page.getByText(text, { exact: true })).toBeVisible();
  393 |     fixture.setCountsError(true);
  394 |     await revalidateIdentity(page);
  395 |     await expect(page.getByText('Showing saved trip totals. Refresh failed.', { exact: true })).toBeVisible();
  396 |     await expect(page.getByText(text, { exact: true })).toBeVisible();
  397 |     await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
  398 |     fixture.setCountsError(false);
  399 |     await page.getByRole('button', { name: 'Retry totals', exact: true }).click();
  400 |     await expect(page.getByText('Showing saved trip totals. Refresh failed.', { exact: true })).toHaveCount(0);
  401 |     settled(fixture);
  402 |   });
  403 | }
  404 | 
  405 | test('employee role keeps authorized Employees bookmark access', async ({ context, page, baseURL }) => {
  406 |   const fixture = await installDirectoryFixtures(context, page, baseURL, { stateOverrides: { role: 'employee' } });
  407 |   await page.goto('/?page=employees');
  408 |   await expect(row(page, directoryRows.employees[0].full_name)).toBeVisible();
  409 |   expect(new URL(page.url()).searchParams.get('page')).toBe('employees');
  410 |   expect(fixture.collectionRequests('employees')).toHaveLength(1);
  411 |   settled(fixture);
  412 | });
  413 | 
  414 | test('page boundary user retry recovers with sanitized diagnostic reference', async ({ context, page, baseURL }) => {
  415 |   const fixture = await installDirectoryFixtures(context, page, baseURL);
  416 |   await page.route(/\/(?:assets\/patients-page-[^/]+\.js|src\/components\/patients-page\.tsx)(?:\?.*)?$/, route => route.fulfill({ contentType: 'application/javascript', body: 'export function PatientsPage(){if(!window.__syntheticRenderRecovered) throw new Error("SYNTHETIC_PRIVATE_DIAGNOSTIC_MARKER"); return "Synthetic recovered page";}' }));
  417 |   await page.goto('/?page=patients');
  418 |   await expect(page.getByText('Page Error', { exact: true })).toBeVisible();
  419 |   await expect(page.locator('body')).not.toContainText('SYNTHETIC_PRIVATE_DIAGNOSTIC_MARKER');
  420 |   expect(fixture.consoleMessages.join('\n')).not.toContain('SYNTHETIC_PRIVATE_DIAGNOSTIC_MARKER');
  421 |   expect(fixture.consoleErrors.some(message => message.includes('UI boundary diagnostic'))).toBe(true);
  422 |   expect(JSON.stringify(await fixture.captureDiagnostics())).not.toContain('SYNTHETIC_PRIVATE_DIAGNOSTIC_MARKER');
  423 |   await page.evaluate(() => { window.__syntheticRenderRecovered = true; });
  424 |   await page.getByRole('button', { name: 'Try again', exact: true }).click();
  425 |   await expect(page.getByText('Synthetic recovered page', { exact: true })).toBeVisible();
  426 |   await expect(page.getByText('Page Error', { exact: true })).toHaveCount(0);
  427 |   expect(fixture.documents).toHaveLength(1);
  428 | });
  429 | 
  430 | test('authorization failure on refresh removes cached Patients and an open private draft', async ({ context, page, baseURL }) => {
  431 |   const fixture = await installDirectoryFixtures(context, page, baseURL);
  432 |   await page.clock.install();
  433 |   await page.goto('/?page=patients');
  434 |   const name = directoryRows.patients[0].full_name;
  435 |   await expect(row(page, name)).toBeVisible();
  436 |   await card(page, name).locator('button[aria-haspopup="menu"]').click();
  437 |   await page.getByRole('menuitem', { name: 'Edit Client', exact: true }).click();
> 438 |   await expect(page.getByRole('dialog')).toBeVisible();
      |                                                                                             ^ Error: expect(locator).toBeVisible() failed
  439 |   fixture.setListError('patients', true, 403);
  440 |   await revalidateIdentity(page);
  441 |   await expect(page.getByText('Access to clients could not be verified.', { exact: true })).toBeVisible();
  442 |   await expect(row(page, name)).toHaveCount(0);
  443 |   await expect(page.getByRole('dialog')).toHaveCount(0);
  444 |   settled(fixture);
  445 | });
  446 | 
```