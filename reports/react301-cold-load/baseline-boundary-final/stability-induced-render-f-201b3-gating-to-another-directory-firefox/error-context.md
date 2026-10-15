# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stability.spec.mjs >> induced render failure is recoverable by navigating to another directory
- Location: tests/directories-ui/stability.spec.mjs:332:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Directory Alpha Driver', { exact: true }).first()
Expected: visible
Timeout: 12000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('Directory Alpha Driver', { exact: true }).first() with timeout 12000ms
  - waiting for getByText('Directory Alpha Driver', { exact: true }).first()

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
  - img
  - heading "Page Error" [level=2]
  - paragraph: Synthetic render failure
  - button "Refresh Page"
- region "Notifications alt+T"
```

# Test source

```ts
  238 |   for (const directory of directories) await page.getByRole('button', { name: directory.label, exact: true }).click();
  239 |   await expect(row(page, directoryRows.employees[0].full_name)).toBeVisible();
  240 |   await page.goBack();
  241 |   await expect(row(page, directoryRows.drivers[0].full_name)).toBeVisible();
  242 |   await page.goForward();
  243 |   await expect(row(page, directoryRows.employees[0].full_name)).toBeVisible();
  244 |   expect(new URL(page.url()).searchParams.get('filter')).toBe('retained');
  245 |   expect(new URL(page.url()).hash).toBe('#directory-trace');
  246 |   settled(fixture);
  247 | });
  248 | 
  249 | for (const directory of directories) {
  250 |   test(`${directory.page} cached refresh failure retains rows and final-page shrink clamps safely`, async ({ context, page, baseURL }) => {
  251 |     const rows = createDirectoryRows();
  252 |     const fixture = await installDirectoryFixtures(context, page, baseURL, { rows });
  253 |     await page.clock.install();
  254 |     await page.goto(`/?page=${directory.page}&limit=5`);
  255 |     await expect(row(page, rows[directory.page][0].full_name)).toBeVisible();
  256 |     await page.getByRole('button', { name: 'Next', exact: true }).click();
  257 |     await page.getByRole('button', { name: 'Next', exact: true }).click();
  258 |     await expect(row(page, rows[directory.page][12].full_name)).toBeVisible();
  259 |     fixture.setListError(directory.page, true);
  260 |     await revalidateIdentity(page);
  261 |     await expect(page.getByText(`Showing saved ${directory.noun}. Refresh failed.`, { exact: true })).toBeVisible();
  262 |     await expect(row(page, rows[directory.page][12].full_name)).toBeVisible();
  263 |     fixture.setListError(directory.page, false);
  264 |     fixture.replaceRows(directory.page, rows[directory.page].slice(0, 4));
  265 |     await page.getByRole('button', { name: 'Retry list', exact: true }).click();
  266 |     await expect(row(page, rows[directory.page][0].full_name)).toBeVisible();
  267 |     await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  268 |     await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  269 |     await expect(page.locator('body')).not.toContainText(/NaN|Infinity|page 1 of 0/i);
  270 |     settled(fixture);
  271 |   });
  272 | }
  273 | 
  274 | test('first Patients entry after login and token refresh resolves authorized data', async ({ context, page, baseURL }) => {
  275 |   const fixture = await installDirectoryFixtures(context, page, baseURL, { signedOut: true });
  276 |   await page.goto('/?page=patients');
  277 |   await expect(page.getByRole('heading', { name: 'Login to your account' })).toBeVisible();
  278 |   expect(fixture.collectionRequests('patients')).toHaveLength(0);
  279 |   await page.getByLabel('Email', { exact: true }).fill(users.a.email);
  280 |   await page.getByLabel('Password', { exact: true }).fill('synthetic-test-password');
  281 |   await page.getByRole('button', { name: 'Login', exact: true }).click();
  282 |   await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
  283 |   await broadcastSession(page, 'TOKEN_REFRESHED', syntheticSession(users.a));
  284 |   await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
  285 |   expect(fixture.collectionRequests('patients')).toHaveLength(1);
  286 |   settled(fixture);
  287 | });
  288 | 
  289 | test('account switch clears directory and draft before next identity resolves', async ({ context, page, baseURL }) => {
  290 |   const fixture = await installDirectoryFixtures(context, page, baseURL);
  291 |   await page.goto('/?page=patients');
  292 |   await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
  293 |   await page.getByRole('button', { name: 'Add Client', exact: true }).click();
  294 |   await expect(page.getByRole('dialog')).toBeVisible();
  295 |   const gate = deferred();
  296 |   fixture.state.membershipGate = gate; fixture.state.current = 'b';
  297 |   try {
  298 |     await broadcastSession(page, 'SIGNED_IN', syntheticSession(users.b));
  299 |     await expect(row(page, directoryRows.patients[0].full_name)).toHaveCount(0);
  300 |     await expect(page.getByRole('dialog')).toHaveCount(0);
  301 |   } finally { gate.resolve(); }
  302 |   await expect(page.getByRole('button', { name: 'Startup Beta Company CRM System' })).toBeVisible();
  303 |   await expect(row(page, directoryRows.patients[0].full_name)).toHaveCount(0);
  304 |   settled(fixture);
  305 | });
  306 | 
  307 | test('company switch and membership removal never retain former tenant rows', async ({ context, page, baseURL }) => {
  308 |   const fixture = await installDirectoryFixtures(context, page, baseURL, { stateOverrides: { multiOrg: true } });
  309 |   await page.clock.install();
  310 |   await page.goto('/?page=employees');
  311 |   await expect(row(page, directoryRows.employees[0].full_name)).toBeVisible();
  312 |   fixture.state.defaultOrg = 'b';
  313 |   await revalidateIdentity(page);
  314 |   await expect(page.getByRole('button', { name: 'Startup Beta Company CRM System' })).toBeVisible();
  315 |   await expect(row(page, directoryRows.employees[0].full_name)).toHaveCount(0);
  316 |   fixture.state.hasMembership = false;
  317 |   await revalidateIdentity(page);
  318 |   await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('account');
  319 |   await expect(row(page, directoryRows.employees[0].full_name)).toHaveCount(0);
  320 |   settled(fixture);
  321 | });
  322 | 
  323 | test('restricted disabled driver cannot read Patients directory', async ({ context, page, baseURL }) => {
  324 |   const fixture = await installDirectoryFixtures(context, page, baseURL, { stateOverrides: { role: 'driver', hasDriver: true, driverDisabled: true } });
  325 |   await page.goto('/?page=patients');
  326 |   await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('trips');
  327 |   expect(fixture.collectionRequests('patients')).toHaveLength(0);
  328 |   await expect(row(page, directoryRows.patients[0].full_name)).toHaveCount(0);
  329 |   settled(fixture);
  330 | });
  331 | 
  332 | test('induced render failure is recoverable by navigating to another directory', async ({ context, page, baseURL }) => {
  333 |   const fixture = await installDirectoryFixtures(context, page, baseURL);
  334 |   await page.route(/\/(?:assets\/patients-page-[^/]+\.js|src\/components\/patients-page\.tsx)(?:\?.*)?$/, route => route.fulfill({ contentType: 'application/javascript', body: 'export function PatientsPage(){throw new Error("Synthetic render failure");}' }));
  335 |   await page.goto('/?page=patients');
  336 |   await expect(page.getByText('Page Error', { exact: true })).toBeVisible();
  337 |   await page.getByRole('button', { name: 'Drivers', exact: true }).click();
> 338 |   await expect(row(page, directoryRows.drivers[0].full_name)).toBeVisible();
      |                                                               ^ Error: expect(locator).toBeVisible() failed
  339 |   await expect(page.getByText('Page Error', { exact: true })).toHaveCount(0);
  340 |   expect(fixture.errors.every(error => error.includes('Synthetic render failure'))).toBe(true);
  341 |   expect(fixture.documents).toHaveLength(1);
  342 | });
  343 | 
  344 | test('induced chunk failure stays distinct and allows navigation without reload loop', async ({ context, page, baseURL }) => {
  345 |   const fixture = await installDirectoryFixtures(context, page, baseURL);
  346 |   let requests = 0;
  347 |   await page.route(/\/(?:assets\/patients-page-[^/]+\.js|src\/components\/patients-page\.tsx)(?:\?.*)?$/, route => { requests++; return route.abort('failed'); });
  348 |   await page.goto('/?page=dashboard');
  349 |   await page.getByRole('button', { name: 'Patients', exact: true }).click();
  350 |   await expect(page.getByText('This page could not load', { exact: true })).toBeVisible();
  351 |   await page.getByRole('button', { name: 'Try again', exact: true }).click();
  352 |   await expect(page.getByText('This page could not load', { exact: true })).toBeVisible();
  353 |   expect(requests).toBeLessThanOrEqual(2);
  354 |   await page.getByRole('button', { name: 'Employees', exact: true }).click();
  355 |   await expect(row(page, directoryRows.employees[0].full_name)).toBeVisible();
  356 |   expect(fixture.documents).toHaveLength(1);
  357 | });
  358 | 
  359 | test('expired saved session refreshes once before Patients collection loads', async ({ context, page, baseURL }) => {
  360 |   const fixture = await installDirectoryFixtures(context, page, baseURL, { expired: true });
  361 |   await page.goto('/?page=patients');
  362 |   await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
  363 |   expect(fixture.state.requests.filter(request => request.table === 'token')).toHaveLength(1);
  364 |   expect(fixture.collectionRequests('patients')).toHaveLength(1);
  365 |   settled(fixture);
  366 | });
  367 | 
  368 | for (const directory of directories.filter(item => item.page !== 'employees')) {
  369 |   test(`${directory.page} successful cached totals survive failed background refresh`, async ({ context, page, baseURL }) => {
  370 |     const fixture = await installDirectoryFixtures(context, page, baseURL);
  371 |     await page.clock.install();
  372 |     await page.goto(`/?page=${directory.page}`);
  373 |     await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
  374 |     const text = directory.page === 'patients' ? 'Trips: 12' : '17 trips';
  375 |     await expect(page.getByText(text, { exact: true })).toBeVisible();
  376 |     fixture.setCountsError(true);
  377 |     await revalidateIdentity(page);
  378 |     await expect(page.getByText('Showing saved trip totals. Refresh failed.', { exact: true })).toBeVisible();
  379 |     await expect(page.getByText(text, { exact: true })).toBeVisible();
  380 |     await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
  381 |     fixture.setCountsError(false);
  382 |     await page.getByRole('button', { name: 'Retry totals', exact: true }).click();
  383 |     await expect(page.getByText('Showing saved trip totals. Refresh failed.', { exact: true })).toHaveCount(0);
  384 |     settled(fixture);
  385 |   });
  386 | }
  387 | 
```