# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stability.spec.mjs >> patients malformed limit 10oops safely falls back to supported pagination
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
  78  |     await expect(row(page, rows[directory.page][12].full_name)).toBeVisible();
  79  |     await page.getByRole('button', { name: 'Grid view', exact: true }).click();
  80  |     await expect(page.getByRole('heading', { name: rows[directory.page][0].full_name, exact: true })).toBeVisible();
  81  |     expect(new URL(page.url()).hash).toBe('#stable-bookmark');
  82  |     expect(fixture.collectionRequests(directory.page)).toHaveLength(1);
  83  |     settled(fixture);
  84  |   });
  85  | 
  86  |   test(`${directory.page} cold code and list phases preserve shell/header geometry`, async ({ context, page, baseURL }, testInfo) => {
  87  |     const codeGate = deferred();
  88  |     const listGate = deferred();
  89  |     const countsGate = deferred();
  90  |     const fixture = await installDirectoryFixtures(context, page, baseURL, { codeGate, codePage: directory.page, listGate, countsGate });
  91  |     await installGeometry(page);
  92  |     try {
  93  |       await page.goto('/?page=dashboard', { waitUntil: 'domcontentloaded' });
  94  |       await expect(page.getByRole('button', { name: directory.label, exact: true })).toBeVisible();
  95  |       const before = await page.evaluate(() => window.__directoryGeometry.at(-1));
  96  |       await page.getByRole('button', { name: directory.label, exact: true }).click();
  97  |       // Hold each independent phase long enough to sample frames and capture a reviewable trace.
  98  |       await expect.poll(() => fixture.chunks.some(chunk => chunk.includes(`/${directory.page}-page-`)) || page.url().includes(directory.page)).toBe(true);
  99  |       await page.waitForTimeout(250);
  100 |       await page.screenshot({ path: testInfo.outputPath(`${directory.page}-code-pending.png`), fullPage: true });
  101 |       const code = await page.evaluate(() => window.__directoryGeometry.at(-1));
  102 |       codeGate.resolve();
  103 |       await expect.poll(() => fixture.collectionRequests(directory.page).length).toBeGreaterThan(0);
  104 |       await page.waitForTimeout(100);
  105 |       await page.screenshot({ path: testInfo.outputPath(`${directory.page}-list-pending.png`), fullPage: true });
  106 |       const data = await page.evaluate(() => window.__directoryGeometry.at(-1));
  107 |       listGate.resolve();
  108 |       await expect(row(page, directoryRows[directory.page][0].full_name)).toBeVisible();
  109 |       await frames(page);
  110 |       const baseRows = await page.evaluate(() => window.__directoryGeometry.at(-1));
  111 |       countsGate.resolve();
  112 |       if (directory.page !== 'employees') await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
  113 |       await frames(page);
  114 |       const ready = await page.evaluate(() => window.__directoryGeometry.at(-1));
  115 |       await page.screenshot({ path: testInfo.outputPath(`${directory.page}-ready.png`), fullPage: true });
  116 |       const samples = await page.evaluate(() => window.__directoryGeometry);
  117 |       const geometry = JSON.stringify({ synthetic: true, before, code, data, baseRows, ready, samples, chunks: fixture.chunks, documents: fixture.documents, errors: fixture.errors, consoleErrors: fixture.consoleErrors }, null, 2);
  118 |       await writeFile(testInfo.outputPath('geometry.json'), geometry);
  119 |       await testInfo.attach('geometry', { body: geometry, contentType: 'application/json' });
  120 |       expect(code.sidebar?.id).toBe(before.sidebar?.id);
  121 |       expect(data.sidebar?.id).toBe(before.sidebar?.id);
  122 |       expect(code.header, 'Route header remains visible during page code import').not.toBeNull();
  123 |       expect(data.header).not.toBeNull();
  124 |       expect(code.header?.height).toBe(ready.header?.height);
  125 |       expect(data.header?.height).toBe(ready.header?.height);
  126 |       expect(baseRows.search?.y).toBe(ready.search?.y);
  127 |       expect(data.search?.y).toBe(ready.search?.y);
  128 |       settled(fixture);
  129 |     } finally { codeGate.resolve(); listGate.resolve(); countsGate.resolve(); }
  130 |   });
  131 | 
  132 |   test(`${directory.page} cold direct entry shows stable controls before base records`, async ({ context, page, baseURL }) => {
  133 |     const listGate = deferred();
  134 |     const fixture = await installDirectoryFixtures(context, page, baseURL, { listGate });
  135 |     try {
  136 |       await page.goto(`/?page=${directory.page}`);
  137 |       await expect.poll(() => fixture.collectionRequests(directory.page).length).toBeGreaterThan(0);
  138 |       await expect(page.getByPlaceholder(directory.search)).toBeVisible();
  139 |       await expect(page.getByTestId('directory-rows-skeleton')).toBeVisible();
  140 |       await expect(page.getByText(/No (clients|drivers|employees) found/)).toHaveCount(0);
  141 |       await page.getByPlaceholder(directory.search).fill('Alpha');
  142 |       listGate.resolve();
  143 |       await expect(row(page, directoryRows[directory.page][0].full_name)).toBeVisible();
  144 |       await expect(row(page, directoryRows[directory.page][1].full_name)).toHaveCount(0);
  145 |       await expect(page.getByPlaceholder(directory.search)).toHaveValue('Alpha');
  146 |       settled(fixture);
  147 |     } finally { listGate.resolve(); }
  148 |   });
  149 | 
  150 |   test(`${directory.page} late enrichment preserves page two and open form draft`, async ({ context, page, baseURL }) => {
  151 |     const enrichmentGate = deferred();
  152 |     const rows = createDirectoryRows();
  153 |     const fixture = await installDirectoryFixtures(context, page, baseURL, { rows, countsGate: enrichmentGate, presenceGate: enrichmentGate });
  154 |     try {
  155 |       await page.goto(`/?page=${directory.page}&limit=5`);
  156 |       await expect(row(page, rows[directory.page][0].full_name)).toBeVisible();
  157 |       await page.getByRole('button', { name: 'Next', exact: true }).click();
  158 |       const name = rows[directory.page][5].full_name;
  159 |       await expect(row(page, name)).toBeVisible();
  160 |       await card(page, name).locator('button[aria-haspopup="menu"]').click();
  161 |       await page.getByRole('menuitem', { name: directory.edit, exact: true }).click();
  162 |       const dialog = page.getByRole('dialog', { name: directory.editTitle, exact: true });
  163 |       await dialog.getByPlaceholder(directory.namePlaceholder, { exact: true }).fill('Unsaved synthetic draft');
  164 |       enrichmentGate.resolve();
  165 |       await frames(page);
  166 |       await expect(dialog.getByPlaceholder(directory.namePlaceholder, { exact: true })).toHaveValue('Unsaved synthetic draft');
  167 |       await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  168 |       await expect(row(page, name)).toBeVisible();
  169 |       await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeEnabled();
  170 |       settled(fixture);
  171 |     } finally { enrichmentGate.resolve(); }
  172 |   });
  173 | }
  174 | 
  175 | for (const limit of ['0', '-1', 'garbage', '2.5', '999999', '10oops']) {
  176 |   test(`patients malformed limit ${limit} safely falls back to supported pagination`, async ({ context, page, baseURL }) => {
  177 |     const rows = createDirectoryRows();
> 178 |     const fixture = await installDirectoryFixtures(context, page, baseURL, { rows });
      |                                              ^ Error: expect(locator).toContainText(expected) failed
  179 |     await page.goto(`/?page=patients&limit=${encodeURIComponent(limit)}`);
  180 |     await expect(row(page, rows.patients[0].full_name)).toBeVisible();
  181 |     await expect(page.getByRole('combobox')).toContainText('Show 5');
  182 |     await expect(row(page, rows.patients[5].full_name)).toHaveCount(0);
  183 |     await expect(page.locator('body')).not.toContainText(/NaN|Infinity|page 1 of 0/i);
  184 |     settled(fixture);
  185 |   });
  186 | }
  187 | 
  188 | for (const savedView of ['list', 'bento']) {
  189 |   test(`patients saved ${savedView} preference survives cold entry, search and session refresh`, async ({ context, page, baseURL }) => {
  190 |     const fixture = await installDirectoryFixtures(context, page, baseURL, { savedView });
  191 |     await page.goto('/?page=patients');
  192 |     await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
  193 |     if (savedView === 'list') await expect(page.getByRole('table')).toBeVisible();
  194 |     else await expect(page.getByRole('heading', { name: directoryRows.patients[0].full_name, exact: true })).toBeVisible();
  195 |     await page.getByPlaceholder(directories[0].search).fill('Alpha');
  196 |     await broadcastSession(page, 'TOKEN_REFRESHED', syntheticSession(users.a));
  197 |     await expect(page.getByPlaceholder(directories[0].search)).toHaveValue('Alpha');
  198 |     await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
  199 |     expect(fixture.collectionRequests('patients')).toHaveLength(1);
  200 |     settled(fixture);
  201 |   });
  202 | }
  203 | 
  204 | test('employees failed presence remains unknown and retry preserves later page/filter behavior', async ({ context, page, baseURL }) => {
  205 |   const rows = createDirectoryRows();
  206 |   const fixture = await installDirectoryFixtures(context, page, baseURL, { rows, presenceError: true });
  207 |   await page.goto('/?page=employees&limit=5');
  208 |   await expect(row(page, rows.employees[0].full_name)).toBeVisible();
  209 |   await expect(page.getByRole('button', { name: 'Retry presence', exact: true })).toBeVisible();
  210 |   await expect(page.getByText('No linked account', { exact: true }).first()).toBeVisible();
  211 |   await page.getByRole('button', { name: 'Next', exact: true }).click();
  212 |   await page.getByRole('combobox').filter({ hasText: 'All Status' }).click();
  213 |   await page.getByRole('option', { name: 'Online Only', exact: true }).click();
  214 |   await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  215 |   fixture.setPresenceError(false);
  216 |   await page.getByRole('button', { name: 'Retry presence', exact: true }).click();
  217 |   await expect(row(page, rows.employees[0].full_name)).toBeVisible();
  218 |   settled(fixture);
  219 | });
  220 | 
  221 | test('delayed organization resolution makes no premature directory read', async ({ context, page, baseURL }) => {
  222 |   const membershipGate = deferred();
  223 |   const fixture = await installDirectoryFixtures(context, page, baseURL, { stateOverrides: { membershipGate } });
  224 |   try {
  225 |     await page.goto('/?page=patients');
  226 |     await expect.poll(() => fixture.state.requests.filter(request => request.table === 'organization_memberships').length).toBeGreaterThan(0);
  227 |     expect(fixture.collectionRequests('patients')).toHaveLength(0);
  228 |     membershipGate.resolve();
  229 |     await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
  230 |     settled(fixture);
  231 |   } finally { membershipGate.resolve(); }
  232 | });
  233 | 
  234 | test('rapid directory navigation and browser history preserve URL without document reloads', async ({ context, page, baseURL }) => {
  235 |   const fixture = await installDirectoryFixtures(context, page, baseURL);
  236 |   await page.goto('/?page=dashboard&limit=5&filter=retained#directory-trace');
  237 |   for (const directory of directories) await page.getByRole('button', { name: directory.label, exact: true }).click();
  238 |   await expect(row(page, directoryRows.employees[0].full_name)).toBeVisible();
  239 |   await page.goBack();
  240 |   await expect(row(page, directoryRows.drivers[0].full_name)).toBeVisible();
  241 |   await page.goForward();
  242 |   await expect(row(page, directoryRows.employees[0].full_name)).toBeVisible();
  243 |   expect(new URL(page.url()).searchParams.get('filter')).toBe('retained');
  244 |   expect(new URL(page.url()).hash).toBe('#directory-trace');
  245 |   settled(fixture);
  246 | });
  247 | 
  248 | for (const directory of directories) {
  249 |   test(`${directory.page} cached refresh failure retains rows and final-page shrink clamps safely`, async ({ context, page, baseURL }) => {
  250 |     const rows = createDirectoryRows();
  251 |     const fixture = await installDirectoryFixtures(context, page, baseURL, { rows });
  252 |     await page.clock.install();
  253 |     await page.goto(`/?page=${directory.page}&limit=5`);
  254 |     await expect(row(page, rows[directory.page][0].full_name)).toBeVisible();
  255 |     await page.getByRole('button', { name: 'Next', exact: true }).click();
  256 |     await page.getByRole('button', { name: 'Next', exact: true }).click();
  257 |     await expect(row(page, rows[directory.page][12].full_name)).toBeVisible();
  258 |     fixture.setListError(directory.page, true);
  259 |     await revalidateIdentity(page);
  260 |     await expect(page.getByText(`Showing saved ${directory.noun}. Refresh failed.`, { exact: true })).toBeVisible();
  261 |     await expect(row(page, rows[directory.page][12].full_name)).toBeVisible();
  262 |     fixture.setListError(directory.page, false);
  263 |     fixture.replaceRows(directory.page, rows[directory.page].slice(0, 4));
  264 |     await page.getByRole('button', { name: 'Retry list', exact: true }).click();
  265 |     await expect(row(page, rows[directory.page][0].full_name)).toBeVisible();
  266 |     await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  267 |     await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  268 |     await expect(page.locator('body')).not.toContainText(/NaN|Infinity|page 1 of 0/i);
  269 |     settled(fixture);
  270 |   });
  271 | }
  272 | 
  273 | test('first Patients entry after login and expired-session refresh resolves authorized data', async ({ context, page, baseURL }) => {
  274 |   const fixture = await installDirectoryFixtures(context, page, baseURL, { signedOut: true });
  275 |   await page.goto('/?page=patients');
  276 |   await expect(page.getByRole('heading', { name: 'Login to your account' })).toBeVisible();
  277 |   expect(fixture.collectionRequests('patients')).toHaveLength(0);
  278 |   await page.getByLabel('Email', { exact: true }).fill(users.a.email);
```