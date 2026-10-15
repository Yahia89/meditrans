# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stability.spec.mjs >> patients malformed limit -1 safely falls back to supported pagination
- Location: tests/directories-ui/stability.spec.mjs:173:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('combobox')
Expected substring: "Show 5"
Received string:    ""
Timeout: 12000ms

Call log:
  - Expect "toContainText" getByRole('combobox') with timeout 12000ms
  - waiting for getByRole('combobox')
    28 × locator resolved to <button dir="ltr" type="button" role="combobox" data-state="closed" data-size="default" aria-expanded="false" aria-autocomplete="none" data-slot="select-trigger" aria-controls="radix-_r_f_" class="data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex items-center ju…>…</button>
       - unexpected value ""

```

```yaml
- combobox:
  - img
```

# Test source

```ts
  78  |     await page.getByRole('button', { name: 'Grid view', exact: true }).click();
  79  |     await expect(page.getByRole('heading', { name: rows[directory.page][0].full_name, exact: true })).toBeVisible();
  80  |     expect(new URL(page.url()).hash).toBe('#stable-bookmark');
  81  |     expect(fixture.collectionRequests(directory.page)).toHaveLength(1);
  82  |     settled(fixture);
  83  |   });
  84  | 
  85  |   test(`${directory.page} cold code and list phases preserve shell/header geometry`, async ({ context, page, baseURL }, testInfo) => {
  86  |     const codeGate = deferred();
  87  |     const listGate = deferred();
  88  |     const countsGate = deferred();
  89  |     const fixture = await installDirectoryFixtures(context, page, baseURL, { codeGate, codePage: directory.page, listGate, countsGate });
  90  |     await installGeometry(page);
  91  |     try {
  92  |       await page.goto('/?page=dashboard', { waitUntil: 'domcontentloaded' });
  93  |       await expect(page.getByRole('button', { name: directory.label, exact: true })).toBeVisible();
  94  |       const before = await page.evaluate(() => window.__directoryGeometry.at(-1));
  95  |       await page.getByRole('button', { name: directory.label, exact: true }).click();
  96  |       // Hold each independent phase long enough to sample frames and capture a reviewable trace.
  97  |       await expect.poll(() => fixture.chunks.some(chunk => chunk.includes(`/${directory.page}-page-`)) || page.url().includes(directory.page)).toBe(true);
  98  |       await page.waitForTimeout(250);
  99  |       await page.screenshot({ path: testInfo.outputPath(`${directory.page}-code-pending.png`), fullPage: true });
  100 |       const code = await page.evaluate(() => window.__directoryGeometry.at(-1));
  101 |       codeGate.resolve();
  102 |       await expect.poll(() => fixture.collectionRequests(directory.page).length).toBeGreaterThan(0);
  103 |       await page.waitForTimeout(100);
  104 |       await page.screenshot({ path: testInfo.outputPath(`${directory.page}-list-pending.png`), fullPage: true });
  105 |       const data = await page.evaluate(() => window.__directoryGeometry.at(-1));
  106 |       listGate.resolve();
  107 |       await expect(row(page, directoryRows[directory.page][0].full_name)).toBeVisible();
  108 |       await frames(page);
  109 |       const baseRows = await page.evaluate(() => window.__directoryGeometry.at(-1));
  110 |       countsGate.resolve();
  111 |       if (directory.page !== 'employees') await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
  112 |       await frames(page);
  113 |       const ready = await page.evaluate(() => window.__directoryGeometry.at(-1));
  114 |       await page.screenshot({ path: testInfo.outputPath(`${directory.page}-ready.png`), fullPage: true });
  115 |       const samples = await page.evaluate(() => window.__directoryGeometry);
  116 |       await testInfo.attach('geometry', { body: JSON.stringify({ synthetic: true, before, code, data, baseRows, ready, samples, chunks: fixture.chunks, documents: fixture.documents, errors: fixture.errors, consoleErrors: fixture.consoleErrors }, null, 2), contentType: 'application/json' });
  117 |       expect(code.sidebar?.id).toBe(before.sidebar?.id);
  118 |       expect(data.sidebar?.id).toBe(before.sidebar?.id);
  119 |       expect(code.header, 'Route header remains visible during page code import').not.toBeNull();
  120 |       expect(data.header).not.toBeNull();
  121 |       expect(code.header?.height).toBe(ready.header?.height);
  122 |       expect(data.header?.height).toBe(ready.header?.height);
  123 |       expect(baseRows.search?.y).toBe(ready.search?.y);
  124 |       expect(data.search?.y).toBe(ready.search?.y);
  125 |       settled(fixture);
  126 |     } finally { codeGate.resolve(); listGate.resolve(); countsGate.resolve(); }
  127 |   });
  128 | 
  129 |   test(`${directory.page} cold direct entry shows stable controls before base records`, async ({ context, page, baseURL }) => {
  130 |     const listGate = deferred();
  131 |     const fixture = await installDirectoryFixtures(context, page, baseURL, { listGate });
  132 |     try {
  133 |       await page.goto(`/?page=${directory.page}`);
  134 |       await expect.poll(() => fixture.collectionRequests(directory.page).length).toBeGreaterThan(0);
  135 |       await expect(page.getByPlaceholder(directory.search)).toBeVisible();
  136 |       await expect(page.getByTestId('directory-rows-skeleton')).toBeVisible();
  137 |       await expect(page.getByText(/No (clients|drivers|employees) found/)).toHaveCount(0);
  138 |       await page.getByPlaceholder(directory.search).fill('Alpha');
  139 |       listGate.resolve();
  140 |       await expect(row(page, directoryRows[directory.page][0].full_name)).toBeVisible();
  141 |       await expect(row(page, directoryRows[directory.page][1].full_name)).toHaveCount(0);
  142 |       await expect(page.getByPlaceholder(directory.search)).toHaveValue('Alpha');
  143 |       settled(fixture);
  144 |     } finally { listGate.resolve(); }
  145 |   });
  146 | 
  147 |   test(`${directory.page} late enrichment preserves page two and open form draft`, async ({ context, page, baseURL }) => {
  148 |     const enrichmentGate = deferred();
  149 |     const rows = createDirectoryRows();
  150 |     const fixture = await installDirectoryFixtures(context, page, baseURL, { rows, countsGate: enrichmentGate, presenceGate: enrichmentGate });
  151 |     try {
  152 |       await page.goto(`/?page=${directory.page}&limit=5`);
  153 |       await expect(row(page, rows[directory.page][0].full_name)).toBeVisible();
  154 |       await page.getByRole('button', { name: 'Next', exact: true }).click();
  155 |       const name = rows[directory.page][5].full_name;
  156 |       await expect(row(page, name)).toBeVisible();
  157 |       await card(page, name).locator('button[aria-haspopup="menu"]').click();
  158 |       await page.getByRole('menuitem', { name: directory.edit, exact: true }).click();
  159 |       const dialog = page.getByRole('dialog', { name: directory.editTitle, exact: true });
  160 |       await dialog.getByPlaceholder(directory.namePlaceholder, { exact: true }).fill('Unsaved synthetic draft');
  161 |       enrichmentGate.resolve();
  162 |       await frames(page);
  163 |       await expect(dialog.getByPlaceholder(directory.namePlaceholder, { exact: true })).toHaveValue('Unsaved synthetic draft');
  164 |       await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  165 |       await expect(row(page, name)).toBeVisible();
  166 |       await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeEnabled();
  167 |       settled(fixture);
  168 |     } finally { enrichmentGate.resolve(); }
  169 |   });
  170 | }
  171 | 
  172 | for (const limit of ['0', '-1', 'garbage', '2.5', '999999', '10oops']) {
  173 |   test(`patients malformed limit ${limit} safely falls back to supported pagination`, async ({ context, page, baseURL }) => {
  174 |     const rows = createDirectoryRows();
  175 |     const fixture = await installDirectoryFixtures(context, page, baseURL, { rows });
  176 |     await page.goto(`/?page=patients&limit=${encodeURIComponent(limit)}`);
  177 |     await expect(row(page, rows.patients[0].full_name)).toBeVisible();
> 178 |     await expect(page.getByRole('combobox')).toContainText('Show 5');
      |                                              ^ Error: expect(locator).toContainText(expected) failed
  179 |     await expect(row(page, rows.patients[5].full_name)).toHaveCount(0);
  180 |     await expect(page.locator('body')).not.toContainText(/NaN|Infinity|page 1 of 0/i);
  181 |     settled(fixture);
  182 |   });
  183 | }
  184 | 
  185 | for (const savedView of ['list', 'bento']) {
  186 |   test(`patients saved ${savedView} preference survives cold entry, search and session refresh`, async ({ context, page, baseURL }) => {
  187 |     const fixture = await installDirectoryFixtures(context, page, baseURL, { savedView });
  188 |     await page.goto('/?page=patients');
  189 |     await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
  190 |     if (savedView === 'list') await expect(page.getByRole('table')).toBeVisible();
  191 |     else await expect(page.getByRole('heading', { name: directoryRows.patients[0].full_name, exact: true })).toBeVisible();
  192 |     await page.getByPlaceholder(directories[0].search).fill('Alpha');
  193 |     await broadcastSession(page, 'TOKEN_REFRESHED', syntheticSession(users.a));
  194 |     await expect(page.getByPlaceholder(directories[0].search)).toHaveValue('Alpha');
  195 |     await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
  196 |     expect(fixture.collectionRequests('patients')).toHaveLength(1);
  197 |     settled(fixture);
  198 |   });
  199 | }
  200 | 
  201 | test('employees failed presence remains unknown and retry preserves later page/filter behavior', async ({ context, page, baseURL }) => {
  202 |   const rows = createDirectoryRows();
  203 |   const fixture = await installDirectoryFixtures(context, page, baseURL, { rows, presenceError: true });
  204 |   await page.goto('/?page=employees&limit=5');
  205 |   await expect(row(page, rows.employees[0].full_name)).toBeVisible();
  206 |   await expect(page.getByRole('button', { name: 'Retry presence', exact: true })).toBeVisible();
  207 |   await expect(page.getByText('No linked account', { exact: true }).first()).toBeVisible();
  208 |   await page.getByRole('button', { name: 'Next', exact: true }).click();
  209 |   await page.getByRole('combobox').filter({ hasText: 'All Status' }).click();
  210 |   await page.getByRole('option', { name: 'Online Only', exact: true }).click();
  211 |   await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  212 |   fixture.setPresenceError(false);
  213 |   await page.getByRole('button', { name: 'Retry presence', exact: true }).click();
  214 |   await expect(row(page, rows.employees[0].full_name)).toBeVisible();
  215 |   settled(fixture);
  216 | });
  217 | 
  218 | test('delayed organization resolution makes no premature directory read', async ({ context, page, baseURL }) => {
  219 |   const membershipGate = deferred();
  220 |   const fixture = await installDirectoryFixtures(context, page, baseURL, { stateOverrides: { membershipGate } });
  221 |   try {
  222 |     await page.goto('/?page=patients');
  223 |     await expect.poll(() => fixture.state.requests.filter(request => request.table === 'organization_memberships').length).toBeGreaterThan(0);
  224 |     expect(fixture.collectionRequests('patients')).toHaveLength(0);
  225 |     membershipGate.resolve();
  226 |     await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
  227 |     settled(fixture);
  228 |   } finally { membershipGate.resolve(); }
  229 | });
  230 | 
  231 | test('rapid directory navigation and browser history preserve URL without document reloads', async ({ context, page, baseURL }) => {
  232 |   const fixture = await installDirectoryFixtures(context, page, baseURL);
  233 |   await page.goto('/?page=dashboard&limit=5&filter=retained#directory-trace');
  234 |   for (const directory of directories) await page.getByRole('button', { name: directory.label, exact: true }).click();
  235 |   await expect(row(page, directoryRows.employees[0].full_name)).toBeVisible();
  236 |   await page.goBack();
  237 |   await expect(row(page, directoryRows.drivers[0].full_name)).toBeVisible();
  238 |   await page.goForward();
  239 |   await expect(row(page, directoryRows.employees[0].full_name)).toBeVisible();
  240 |   expect(new URL(page.url()).searchParams.get('filter')).toBe('retained');
  241 |   expect(new URL(page.url()).hash).toBe('#directory-trace');
  242 |   settled(fixture);
  243 | });
  244 | 
```