# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stability.spec.mjs >> patients cold code and list phases preserve shell/header geometry
- Location: tests/directories-ui/stability.spec.mjs:85:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 64
Received: 0
```

# Page snapshot

```yaml
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
              - link "Patients" [disabled] [ref=e141]
      - generic [ref=e143]:
        - generic [ref=e144]:
          - generic [ref=e145]:
            - heading "Clients" [level=1] [ref=e147]
            - paragraph [ref=e148]: Manage and view all client records
          - button "Add Client" [ref=e149] [cursor=pointer]
        - generic [ref=e151]:
          - generic [ref=e153]:
            - generic [ref=e154]: Total Clients
            - generic [ref=e155]: "2"
          - generic [ref=e157]:
            - generic [ref=e158]: Approved
            - generic [ref=e159]: "1"
          - generic [ref=e161]:
            - generic [ref=e162]: New This Month
            - generic [ref=e163]: "23"
          - generic [ref=e165]:
            - generic [ref=e166]: Total Trips
            - generic [ref=e167]: "12"
        - generic [ref=e168]:
          - textbox "Search clients by name, email, or phone..." [ref=e172]
          - combobox [ref=e173] [cursor=pointer]:
            - generic [ref=e174]: Show 5
          - button "Export" [ref=e175] [cursor=pointer]
          - generic [ref=e176]:
            - button [ref=e177] [cursor=pointer]
            - button [ref=e180] [cursor=pointer]
        - generic [ref=e183]:
          - generic [ref=e184]: 0 clients selected
          - generic [ref=e187]:
            - button "Delete" [disabled]
            - button "Clear Selection" [disabled]
        - generic [ref=e188]:
          - generic [ref=e189]:
            - generic [ref=e190]:
              - generic [ref=e191]:
                - checkbox [ref=e192] [cursor=pointer]
                - generic [ref=e193] [cursor=pointer]: DAC
                - generic [ref=e194] [cursor=pointer]:
                  - heading "Directory Alpha Client" [level=3] [ref=e195]
                  - generic [ref=e196]: "Age: 56"
              - generic [ref=e201]: Approved
            - generic [ref=e203]:
              - generic [ref=e204]:
                - generic [ref=e205]: (555) 123-4567
                - generic [ref=e209]: alpha-client@example.invalid
              - generic [ref=e214]:
                - generic [ref=e215]: 123 Fixture Street
                - generic [ref=e220]: "Trips: 12"
            - generic [ref=e221]:
              - button "View Details" [ref=e222] [cursor=pointer]
              - button [ref=e223] [cursor=pointer]
          - generic [ref=e224]:
            - generic [ref=e225]:
              - generic [ref=e226]:
                - checkbox [ref=e227] [cursor=pointer]
                - generic [ref=e228] [cursor=pointer]: DBC
                - generic [ref=e229] [cursor=pointer]:
                  - heading "Directory Beta Client" [level=3] [ref=e230]
                  - generic [ref=e231]: "Age: 46"
              - generic [ref=e236]: Pending
            - generic [ref=e238]:
              - generic [ref=e239]:
                - generic [ref=e240]: (555) 123-4567
                - generic [ref=e244]: beta-client@example.invalid
              - generic [ref=e249]:
                - generic [ref=e250]: —
                - generic [ref=e255]: "Trips: 0"
            - generic [ref=e256]:
              - button "View Details" [ref=e257] [cursor=pointer]
              - button [ref=e258] [cursor=pointer]
        - generic [ref=e259]:
          - paragraph [ref=e260]: Showing 1 - 2 of 2 clients
          - generic [ref=e261]:
            - button "Previous" [disabled]
            - button "1" [ref=e263] [cursor=pointer]
            - button "Next" [disabled]
  - region "Notifications alt+T"
```

# Test source

```ts
  21  |       const node = document.querySelector(selector);
  22  |       if (!node) return null;
  23  |       if (!identities.has(node)) identities.set(node, ++serial);
  24  |       const rect = node.getBoundingClientRect();
  25  |       return { id: identities.get(node), x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  26  |     };
  27  |     window.__directoryGeometry = samples;
  28  |     const sample = () => {
  29  |       if (samples.length < 2000) samples.push({ at: performance.now(), page: new URL(location.href).searchParams.get('page'),
  30  |         sidebar: inspect('[data-sidebar="sidebar"]'), main: inspect('main'), header: inspect('main header'),
  31  |         search: inspect('input[placeholder^="Search clients"], input[placeholder^="Search drivers"], input[placeholder^="Search employees"]'),
  32  |         cold: Boolean(document.querySelector('[data-testid="directory-page-skeleton"], [data-testid="directory-rows-skeleton"]')),
  33  |       });
  34  |       requestAnimationFrame(sample);
  35  |     };
  36  |     requestAnimationFrame(sample);
  37  |   });
  38  | }
  39  | 
  40  | for (const directory of directories) {
  41  |   test(`${directory.page} cold list failure is distinct from empty and retries`, async ({ context, page, baseURL }) => {
  42  |     const fixture = await installDirectoryFixtures(context, page, baseURL, { listErrors: [directory.page] });
  43  |     await page.goto(`/?page=${directory.page}`);
  44  |     await expect(page.getByRole('button', { name: 'Retry list', exact: true })).toBeVisible();
  45  |     await expect(page.getByText(new RegExp(`^${directory.noun} could not be loaded\\.$`, 'i'))).toBeVisible();
  46  |     await expect(page.getByText(/No (clients|drivers|employees) found/)).toHaveCount(0);
  47  |     fixture.setListError(directory.page, false);
  48  |     await page.getByRole('button', { name: 'Retry list', exact: true }).click();
  49  |     await expect(row(page, directoryRows[directory.page][0].full_name)).toBeVisible();
  50  |     settled(fixture);
  51  |   });
  52  | 
  53  |   test(`${directory.page} pagination handles later-page search, empty, limits, and both views`, async ({ context, page, baseURL }) => {
  54  |     const rows = createDirectoryRows();
  55  |     const fixture = await installDirectoryFixtures(context, page, baseURL, { rows });
  56  |     await page.goto(`/?page=${directory.page}&limit=5#stable-bookmark`);
  57  |     await expect(row(page, rows[directory.page][0].full_name)).toBeVisible();
  58  |     await page.getByRole('button', { name: 'Next', exact: true }).click();
  59  |     await expect(row(page, rows[directory.page][5].full_name)).toBeVisible();
  60  |     await page.getByPlaceholder(directory.search).fill('01');
  61  |     await expect(row(page, rows[directory.page][0].full_name)).toBeVisible();
  62  |     await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  63  |     await page.getByPlaceholder(directory.search).fill('absent-fixture');
  64  |     await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  65  |     await expect(page.locator('body')).not.toContainText(/NaN|Infinity|page 1 of 0/i);
  66  |     await page.getByPlaceholder(directory.search).fill('');
  67  |     await expect(row(page, rows[directory.page][0].full_name)).toBeVisible();
  68  |     await page.getByRole('combobox').filter({ hasText: 'Show 5' }).click();
  69  |     await page.getByRole('option', { name: 'Show 10', exact: true }).click();
  70  |     await expect(row(page, rows[directory.page][9].full_name)).toBeVisible();
  71  |     await page.getByRole('combobox').filter({ hasText: 'Show 10' }).click();
  72  |     await page.getByRole('option', { name: 'Show All', exact: true }).click();
  73  |     await expect(row(page, rows[directory.page][12].full_name)).toBeVisible();
  74  |     await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  75  |     await page.getByRole('button', { name: 'List view', exact: true }).click();
  76  |     await expect(page.getByRole('table')).toBeVisible();
  77  |     await expect(row(page, rows[directory.page][12].full_name)).toBeVisible();
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
> 121 |       expect(code.header?.height).toBe(ready.header?.height);
      |                                   ^ Error: expect(received).toBe(expected) // Object.is equality
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
  178 |     await expect(page.getByRole('combobox')).toContainText('Show 5');
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
```