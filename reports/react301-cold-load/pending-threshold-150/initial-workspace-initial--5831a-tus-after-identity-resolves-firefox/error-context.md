# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: initial-workspace.spec.mjs >> initial workspace code keeps a visible status after identity resolves
- Location: tests/directories-ui/initial-workspace.spec.mjs:6:1

# Error details

```
Error: Identity loading must hand off directly to a visible workspace status

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 72

- Array []
+ Array [
+   Object {
+     "at": 268,
+     "authLoading": false,
+     "content": false,
+     "shell": false,
+     "workspacePending": false,
+   },
+   Object {
+     "at": 285,
+     "authLoading": false,
+     "content": false,
+     "shell": false,
+     "workspacePending": false,
+   },
+   Object {
+     "at": 301,
+     "authLoading": false,
+     "content": false,
+     "shell": false,
+     "workspacePending": false,
+   },
+   Object {
+     "at": 318,
+     "authLoading": false,
+     "content": false,
+     "shell": false,
+     "workspacePending": false,
+   },
+   Object {
+     "at": 334,
+     "authLoading": false,
+     "content": false,
+     "shell": false,
+     "workspacePending": false,
+   },
+   Object {
+     "at": 352,
+     "authLoading": false,
+     "content": false,
+     "shell": false,
+     "workspacePending": false,
+   },
+   Object {
+     "at": 369,
+     "authLoading": false,
+     "content": false,
+     "shell": false,
+     "workspacePending": false,
+   },
+   Object {
+     "at": 384,
+     "authLoading": false,
+     "content": false,
+     "shell": false,
+     "workspacePending": false,
+   },
+   Object {
+     "at": 401,
+     "authLoading": false,
+     "content": false,
+     "shell": false,
+     "workspacePending": false,
+   },
+   Object {
+     "at": 418,
+     "authLoading": false,
+     "content": false,
+     "shell": false,
+     "workspacePending": false,
+   },
+ ]
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
        - generic [ref=e150]:
          - status
        - generic [ref=e152]:
          - generic [ref=e154]:
            - generic [ref=e155]: Total Clients
            - generic [ref=e156]: "2"
          - generic [ref=e158]:
            - generic [ref=e159]: Approved
            - generic [ref=e160]: "1"
          - generic [ref=e162]:
            - generic [ref=e163]: New This Month
            - generic [ref=e164]: "0"
          - generic [ref=e166]:
            - generic [ref=e167]: Total Trips
            - generic [ref=e168]: "12"
        - generic [ref=e169]:
          - textbox "Search clients" [ref=e173]:
            - /placeholder: Search clients by name, email, or phone...
          - combobox [ref=e174] [cursor=pointer]:
            - generic [ref=e175]: Show 5
          - button "Export" [ref=e176] [cursor=pointer]
          - generic [ref=e177]:
            - button "Grid view" [ref=e178] [cursor=pointer]
            - button "List view" [ref=e181] [cursor=pointer]
        - generic [ref=e184]:
          - generic [ref=e185]: 0 clients selected
          - generic [ref=e188]:
            - button "Delete" [disabled]
            - button "Clear Selection" [disabled]
        - generic [ref=e189]:
          - generic [ref=e190]:
            - generic [ref=e191]:
              - generic [ref=e192]:
                - checkbox [ref=e193] [cursor=pointer]
                - generic [ref=e194] [cursor=pointer]: DAC
                - generic [ref=e195] [cursor=pointer]:
                  - heading "Directory Alpha Client" [level=3] [ref=e196]
                  - generic [ref=e197]: "Age: 56"
              - generic [ref=e202]: Approved
            - generic [ref=e204]:
              - generic [ref=e205]:
                - generic [ref=e206]: (555) 123-4567
                - generic [ref=e210]: alpha-client@example.invalid
              - generic [ref=e215]:
                - generic [ref=e216]: 123 Fixture Street
                - generic [ref=e221]: "Trips: 12"
            - generic [ref=e222]:
              - button "View Details" [ref=e223] [cursor=pointer]
              - button [ref=e224] [cursor=pointer]
          - generic [ref=e225]:
            - generic [ref=e226]:
              - generic [ref=e227]:
                - checkbox [ref=e228] [cursor=pointer]
                - generic [ref=e229] [cursor=pointer]: DBC
                - generic [ref=e230] [cursor=pointer]:
                  - heading "Directory Beta Client" [level=3] [ref=e231]
                  - generic [ref=e232]: "Age: 46"
              - generic [ref=e237]: Pending
            - generic [ref=e239]:
              - generic [ref=e240]:
                - generic [ref=e241]: (555) 123-4567
                - generic [ref=e245]: beta-client@example.invalid
              - generic [ref=e250]:
                - generic [ref=e251]: —
                - generic [ref=e256]: "Trips: 0"
            - generic [ref=e257]:
              - button "View Details" [ref=e258] [cursor=pointer]
              - button [ref=e259] [cursor=pointer]
        - generic [ref=e260]:
          - paragraph [ref=e261]: Showing 1 - 2 of 2 clients
          - generic [ref=e262]:
            - button "Previous" [disabled]
            - button "1" [ref=e264] [cursor=pointer]
            - button "Next" [disabled]
  - region "Notifications alt+T"
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | import { writeFile } from 'node:fs/promises';
  3  | import { deferred } from '../startup-ui/fixtures.mjs';
  4  | import { directoryRows, installDirectoryFixtures } from './fixtures.mjs';
  5  | 
  6  | test('initial workspace code keeps a visible status after identity resolves', async ({ context, page, baseURL }, testInfo) => {
  7  |   const workspaceGate = deferred();
  8  |   const membershipGate = deferred();
  9  |   const fixture = await installDirectoryFixtures(context, page, baseURL, { stateOverrides: { membershipGate } });
  10 |   const blockedModules = [];
  11 |   await page.route(/\/(?:assets\/routes-[^/]+\.js|src\/routes\/index\.tsx\?tsr-split=component)(?:\?.*)?$/, async route => {
  12 |     blockedModules.push(new URL(route.request().url()).pathname);
  13 |     await workspaceGate.promise;
  14 |     return route.continue();
  15 |   });
  16 |   await page.addInitScript(() => {
  17 |     const samples = [];
  18 |     window.__initialWorkspaceFrames = samples;
  19 |     const sample = () => {
  20 |       const root = document.getElementById('root');
  21 |       if (samples.length < 1200) samples.push({ at: performance.now(), content: Boolean(root?.innerText.trim()),
  22 |         authLoading: root?.innerText.trim() === 'Loading...',
  23 |         workspacePending: root?.innerText.includes('Opening workspace') ?? false,
  24 |         shell: Boolean(document.querySelector('[data-sidebar="sidebar"]')),
  25 |       });
  26 |       requestAnimationFrame(sample);
  27 |     };
  28 |     requestAnimationFrame(sample);
  29 |   });
  30 |   try {
  31 |     await page.goto('/?page=patients', { waitUntil: 'domcontentloaded' });
  32 |     await expect(page.getByText('Loading...', { exact: true })).toBeVisible();
  33 |     await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  34 |     membershipGate.resolve();
  35 |     await expect.poll(() => blockedModules.length).toBeGreaterThan(0);
  36 |     await expect(page.getByText('Opening workspace…', { exact: true })).toBeVisible();
  37 |     // The gate, rather than a timed network sleep, keeps this phase reproducible.
  38 |     await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  39 |     const pendingFrames = await page.evaluate(() => window.__initialWorkspaceFrames);
  40 |     workspaceGate.resolve();
  41 |     await expect(page.getByRole('heading', { name: directoryRows.patients[0].full_name, exact: true })).toBeVisible();
  42 |     const firstContent = pendingFrames.findIndex(frame => frame.authLoading);
  43 |     const relevant = pendingFrames.slice(firstContent);
  44 |     const blankFrames = relevant.filter(frame => !frame.content);
  45 |     const result = { synthetic: true, blockedModules, pendingFrames: relevant, blankFrames,
  46 |       blankSpanMs: blankFrames.length ? blankFrames.at(-1).at - blankFrames[0].at : 0,
  47 |       documents: fixture.documents, chunks: fixture.chunks, errors: fixture.errors };
  48 |     await writeFile(testInfo.outputPath('initial-workspace.json'), JSON.stringify(result, null, 2));
  49 |     await testInfo.attach('initial-workspace', { body: JSON.stringify(result), contentType: 'application/json' });
  50 |     expect(firstContent).toBeGreaterThanOrEqual(0);
> 51 |     expect(blankFrames, 'Identity loading must hand off directly to a visible workspace status').toEqual([]);
     |                                                                                                  ^ Error: Identity loading must hand off directly to a visible workspace status
  52 |     expect(fixture.documents).toHaveLength(1);
  53 |     expect(fixture.errors).toEqual([]);
  54 |   } finally {
  55 |     membershipGate.resolve();
  56 |     workspaceGate.resolve();
  57 |   }
  58 | });
  59 | 
```