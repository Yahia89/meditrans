import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { deferred, broadcastSession, syntheticSession, users, revalidateIdentity } from '../startup-ui/fixtures.mjs';
import { createDirectoryRows, directoryRows, installDirectoryFixtures } from './fixtures.mjs';

const directories = [
  { page: 'patients', label: 'Patients', noun: 'clients', search: 'Search clients by name, email, or phone...', add: 'Add Client', edit: 'Edit Client', editTitle: 'Edit Patient', namePlaceholder: 'John Smith' },
  { page: 'drivers', label: 'Drivers', noun: 'drivers', search: 'Search drivers by name, email, phone or license plate...', add: 'Add Driver', edit: 'Edit Driver', editTitle: 'Edit Driver', namePlaceholder: 'Michael Chen' },
  { page: 'employees', label: 'Employees', noun: 'employees', search: 'Search employees by name, email, department or position...', add: 'Add Employee', edit: 'Edit Employee', editTitle: 'Edit Employee', namePlaceholder: 'Sarah Johnson' },
];
const card = (page, name) => page.locator('div.rounded-2xl').filter({ has: page.getByRole('heading', { name, exact: true }) });
const row = (page, name) => page.getByText(name, { exact: true }).first();
const settled = (fixture) => { expect(fixture.errors).toEqual([]); expect(fixture.consoleErrors).toEqual([]); expect(fixture.documents).toHaveLength(1); expect(fixture.requests.length).toBeLessThan(100); };
const frames = async page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function installGeometry(page) {
  await page.addInitScript(() => {
    const samples = [];
    const identities = new WeakMap();
    let serial = 0;
    const inspect = selector => {
      const node = document.querySelector(selector);
      if (!node) return null;
      if (!identities.has(node)) identities.set(node, ++serial);
      const rect = node.getBoundingClientRect();
      return { id: identities.get(node), x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    window.__directoryGeometry = samples;
    const sample = () => {
      if (samples.length < 2000) samples.push({ at: performance.now(), page: new URL(location.href).searchParams.get('page'),
        sidebar: inspect('[data-sidebar="sidebar"]'), main: inspect('main'), header: inspect('main header'),
        search: inspect('input[placeholder^="Search clients"], input[placeholder^="Search drivers"], input[placeholder^="Search employees"]'),
        cold: Boolean(document.querySelector('[data-testid="directory-page-skeleton"], [data-testid="directory-rows-skeleton"]')),
      });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

for (const directory of directories) {
  test(`${directory.page} cold list failure is distinct from empty and retries`, async ({ context, page, baseURL }) => {
    const fixture = await installDirectoryFixtures(context, page, baseURL, { listErrors: [directory.page] });
    await page.goto(`/?page=${directory.page}`);
    await expect(page.getByRole('button', { name: 'Retry list', exact: true })).toBeVisible();
    await expect(page.getByText(new RegExp(`^${directory.noun} could not be loaded\\.$`, 'i'))).toBeVisible();
    await expect(page.getByText(/No (clients|drivers|employees) found/)).toHaveCount(0);
    fixture.setListError(directory.page, false);
    await page.getByRole('button', { name: 'Retry list', exact: true }).click();
    await expect(row(page, directoryRows[directory.page][0].full_name)).toBeVisible();
    settled(fixture);
  });

  test(`${directory.page} pagination handles later-page search, empty, limits, and both views`, async ({ context, page, baseURL }) => {
    const rows = createDirectoryRows();
    const fixture = await installDirectoryFixtures(context, page, baseURL, { rows });
    await page.goto(`/?page=${directory.page}&limit=5#stable-bookmark`);
    await expect(row(page, rows[directory.page][0].full_name)).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(row(page, rows[directory.page][5].full_name)).toBeVisible();
    await page.getByPlaceholder(directory.search).fill('01');
    await expect(row(page, rows[directory.page][0].full_name)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
    await page.getByPlaceholder(directory.search).fill('absent-fixture');
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
    await expect(page.locator('body')).not.toContainText(/NaN|Infinity|page 1 of 0/i);
    await page.getByPlaceholder(directory.search).fill('');
    await expect(row(page, rows[directory.page][0].full_name)).toBeVisible();
    await page.getByRole('combobox').filter({ hasText: 'Show 5' }).click();
    await page.getByRole('option', { name: 'Show 10', exact: true }).click();
    await expect(row(page, rows[directory.page][9].full_name)).toBeVisible();
    await page.getByRole('combobox').filter({ hasText: 'Show 10' }).click();
    await page.getByRole('option', { name: 'Show All', exact: true }).click();
    await expect(row(page, rows[directory.page][12].full_name)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'List view', exact: true }).click();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(row(page, rows[directory.page][12].full_name)).toBeVisible();
    await page.getByRole('button', { name: 'Grid view', exact: true }).click();
    await expect(page.getByRole('heading', { name: rows[directory.page][0].full_name, exact: true })).toBeVisible();
    expect(new URL(page.url()).hash).toBe('#stable-bookmark');
    expect(fixture.collectionRequests(directory.page)).toHaveLength(1);
    settled(fixture);
  });

  test(`${directory.page} cold code and list phases preserve shell/header geometry`, async ({ context, page, baseURL }, testInfo) => {
    const codeGate = deferred();
    const listGate = deferred();
    const countsGate = deferred();
    const fixture = await installDirectoryFixtures(context, page, baseURL, { codeGate, codePage: directory.page, listGate, countsGate });
    await installGeometry(page);
    try {
      await page.goto('/?page=dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('button', { name: directory.label, exact: true })).toBeVisible();
      const before = await page.evaluate(() => window.__directoryGeometry.at(-1));
      await page.getByRole('button', { name: directory.label, exact: true }).click();
      // Hold each independent phase long enough to sample frames and capture a reviewable trace.
      await expect.poll(() => fixture.chunks.some(chunk => chunk.includes(`/${directory.page}-page-`)) || page.url().includes(directory.page)).toBe(true);
      await page.waitForTimeout(250);
      await page.screenshot({ path: testInfo.outputPath(`${directory.page}-code-pending.png`), fullPage: false });
      const code = await page.evaluate(() => window.__directoryGeometry.at(-1));
      codeGate.resolve();
      await expect.poll(() => fixture.collectionRequests(directory.page).length).toBeGreaterThan(0);
      await page.waitForTimeout(100);
      await page.screenshot({ path: testInfo.outputPath(`${directory.page}-list-pending.png`), fullPage: false });
      const data = await page.evaluate(() => window.__directoryGeometry.at(-1));
      listGate.resolve();
      await expect(row(page, directoryRows[directory.page][0].full_name)).toBeVisible();
      await frames(page);
      const baseRows = await page.evaluate(() => window.__directoryGeometry.at(-1));
      countsGate.resolve();
      if (directory.page !== 'employees') await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
      await frames(page);
      const ready = await page.evaluate(() => window.__directoryGeometry.at(-1));
      await page.screenshot({ path: testInfo.outputPath(`${directory.page}-ready.png`), fullPage: false });
      const samples = await page.evaluate(() => window.__directoryGeometry);
      const geometry = JSON.stringify({ synthetic: true, browser: { project: testInfo.project.name, version: context.browser()?.version(), viewport: page.viewportSize() }, buildMode: process.env.DIRECTORIES_DEV === '1' ? 'development StrictMode' : 'production preview', before, code, data, baseRows, ready, samples, chunks: fixture.chunks, documents: fixture.documents, errors: fixture.errors, consoleErrors: fixture.consoleErrors }, null, 2);
      await writeFile(testInfo.outputPath('geometry.json'), geometry);
      await testInfo.attach('geometry', { body: geometry, contentType: 'application/json' });
      const navigationFrames = samples.filter(sample => sample.page === directory.page && sample.at >= before.at);
      expect(navigationFrames.length).toBeGreaterThan(2);
      expect(navigationFrames.filter(sample => !sample.sidebar?.width || !sample.header?.height), 'Every sampled navigation frame retains visible shell and header').toEqual([]);
      expect(code.sidebar?.id).toBe(before.sidebar?.id);
      expect(data.sidebar?.id).toBe(before.sidebar?.id);
      expect(code.sidebar?.width, 'Sidebar is visible throughout the blocked code phase').toBeGreaterThan(0);
      expect(code.header, 'Route header remains visible during page code import').not.toBeNull();
      expect(data.header).not.toBeNull();
      expect(code.header?.height).toBe(ready.header?.height);
      expect(data.header?.height).toBe(ready.header?.height);
      expect(baseRows.search?.y).toBe(ready.search?.y);
      expect(data.search?.y).toBe(ready.search?.y);
      settled(fixture);
    } finally { codeGate.resolve(); listGate.resolve(); countsGate.resolve(); }
  });

  test(`${directory.page} cold direct entry shows stable controls before base records`, async ({ context, page, baseURL }) => {
    const listGate = deferred();
    const fixture = await installDirectoryFixtures(context, page, baseURL, { listGate });
    try {
      await page.goto(`/?page=${directory.page}`);
      await expect.poll(() => fixture.collectionRequests(directory.page).length).toBeGreaterThan(0);
      await expect(page.getByPlaceholder(directory.search)).toBeVisible();
      await expect(page.getByTestId('directory-rows-skeleton')).toBeVisible();
      await expect(page.getByText(/No (clients|drivers|employees) found/)).toHaveCount(0);
      await page.getByPlaceholder(directory.search).fill('Alpha');
      listGate.resolve();
      await expect(row(page, directoryRows[directory.page][0].full_name)).toBeVisible();
      await expect(row(page, directoryRows[directory.page][1].full_name)).toHaveCount(0);
      await expect(page.getByPlaceholder(directory.search)).toHaveValue('Alpha');
      settled(fixture);
    } finally { listGate.resolve(); }
  });

  test(`${directory.page} late enrichment preserves page two and open form draft`, async ({ context, page, baseURL }) => {
    const enrichmentGate = deferred();
    const rows = createDirectoryRows();
    rows.patients[5].primary_address = '123 Fixture Street';
    rows.patients[5].service_type = 'Original synthetic service';
    const fixture = await installDirectoryFixtures(context, page, baseURL, { rows, countsGate: enrichmentGate, presenceGate: enrichmentGate });
    try {
      await page.goto(`/?page=${directory.page}&limit=5`);
      await expect(row(page, rows[directory.page][0].full_name)).toBeVisible();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      const name = rows[directory.page][5].full_name;
      await expect(row(page, name)).toBeVisible();
      await card(page, name).locator('button[aria-haspopup="menu"]').click();
      await page.getByRole('menuitem', { name: directory.edit, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: directory.editTitle, exact: true });
      await dialog.getByPlaceholder(directory.namePlaceholder, { exact: true }).fill('Unsaved synthetic draft');
      if (directory.page === 'patients') {
        await dialog.getByRole('button', { name: 'Next Step', exact: true }).click();
        await dialog.getByPlaceholder('Please specify service type').fill('Unsaved custom service');
      }
      enrichmentGate.resolve();
      await expect(page.getByText(directory.page === 'employees' ? 'Loading presence…' : 'Trip totals are loading…', { exact: true })).toHaveCount(0);
      if (directory.page === 'patients') {
        await expect(dialog.getByPlaceholder('Please specify service type')).toHaveValue('Unsaved custom service');
        await dialog.getByRole('button', { name: 'Back', exact: true }).click();
      }
      await expect(dialog.getByPlaceholder(directory.namePlaceholder, { exact: true })).toHaveValue('Unsaved synthetic draft');
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(row(page, name)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeEnabled();
      settled(fixture);
    } finally { enrichmentGate.resolve(); }
  });
}

for (const limit of ['0', '-1', 'garbage', '2.5', '999999', '10oops']) {
  test(`patients malformed limit ${limit} safely falls back to supported pagination`, async ({ context, page, baseURL }) => {
    const rows = createDirectoryRows();
    const fixture = await installDirectoryFixtures(context, page, baseURL, { rows });
    await page.goto(`/?page=patients&limit=${encodeURIComponent(limit)}`);
    await expect(row(page, rows.patients[0].full_name)).toBeVisible();
    await expect(page.getByRole('combobox')).toContainText('Show 5');
    await expect(row(page, rows.patients[5].full_name)).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/NaN|Infinity|page 1 of 0/i);
    settled(fixture);
  });
}

for (const savedView of ['list', 'bento']) {
  test(`patients saved ${savedView} preference survives cold entry, search and session refresh`, async ({ context, page, baseURL }) => {
    const fixture = await installDirectoryFixtures(context, page, baseURL, { savedView });
    await page.goto('/?page=patients');
    await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
    if (savedView === 'list') await expect(page.getByRole('table')).toBeVisible();
    else await expect(page.getByRole('heading', { name: directoryRows.patients[0].full_name, exact: true })).toBeVisible();
    await page.getByPlaceholder(directories[0].search).fill('Alpha');
    await broadcastSession(page, 'TOKEN_REFRESHED', syntheticSession(users.a));
    await expect(page.getByPlaceholder(directories[0].search)).toHaveValue('Alpha');
    await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
    expect(fixture.collectionRequests('patients')).toHaveLength(1);
    settled(fixture);
  });
}

test('employees failed presence remains unknown and retry preserves later page/filter behavior', async ({ context, page, baseURL }) => {
  const rows = createDirectoryRows();
  const fixture = await installDirectoryFixtures(context, page, baseURL, { rows, presenceError: true });
  await page.goto('/?page=employees&limit=5');
  await expect(row(page, rows.employees[0].full_name)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry presence', exact: true })).toBeVisible();
  await expect(page.getByText('No linked account', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('combobox').filter({ hasText: 'All Status' }).click();
  await page.getByRole('option', { name: 'Online Only', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  fixture.setPresenceError(false);
  await page.getByRole('button', { name: 'Retry presence', exact: true }).click();
  await expect(row(page, rows.employees[0].full_name)).toBeVisible();
  settled(fixture);
});

test('delayed organization resolution makes no premature directory read', async ({ context, page, baseURL }) => {
  const membershipGate = deferred();
  const fixture = await installDirectoryFixtures(context, page, baseURL, { stateOverrides: { membershipGate } });
  try {
    await page.goto('/?page=patients');
    await expect.poll(() => fixture.state.requests.filter(request => request.table === 'organization_memberships').length).toBeGreaterThan(0);
    expect(fixture.collectionRequests('patients')).toHaveLength(0);
    membershipGate.resolve();
    await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
    settled(fixture);
  } finally { membershipGate.resolve(); }
});

test('rapid directory navigation and browser history preserve URL without document reloads', async ({ context, page, baseURL }) => {
  const fixture = await installDirectoryFixtures(context, page, baseURL);
  await page.goto('/?page=dashboard&limit=5&filter=retained#directory-trace');
  for (const directory of directories) await page.getByRole('button', { name: directory.label, exact: true }).click();
  await expect(row(page, directoryRows.employees[0].full_name)).toBeVisible();
  await page.goBack();
  await expect(row(page, directoryRows.drivers[0].full_name)).toBeVisible();
  await page.goForward();
  await expect(row(page, directoryRows.employees[0].full_name)).toBeVisible();
  expect(new URL(page.url()).searchParams.get('filter')).toBe('retained');
  expect(new URL(page.url()).hash).toBe('#directory-trace');
  settled(fixture);
});

for (const directory of directories) {
  test(`${directory.page} cached refresh failure retains rows and final-page shrink clamps safely`, async ({ context, page, baseURL }) => {
    const rows = createDirectoryRows();
    const fixture = await installDirectoryFixtures(context, page, baseURL, { rows });
    await page.clock.install();
    await page.goto(`/?page=${directory.page}&limit=5`);
    await expect(row(page, rows[directory.page][0].full_name)).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(row(page, rows[directory.page][12].full_name)).toBeVisible();
    fixture.setListError(directory.page, true);
    await revalidateIdentity(page);
    await expect(page.getByText(`Showing saved ${directory.noun}. Refresh failed.`, { exact: true })).toBeVisible();
    await expect(row(page, rows[directory.page][12].full_name)).toBeVisible();
    fixture.setListError(directory.page, false);
    fixture.replaceRows(directory.page, rows[directory.page].slice(0, 4));
    await page.getByRole('button', { name: 'Retry list', exact: true }).click();
    await expect(row(page, rows[directory.page][0].full_name)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
    await expect(page.locator('body')).not.toContainText(/NaN|Infinity|page 1 of 0/i);
    settled(fixture);
  });
}

test('first Patients entry after login and token refresh resolves authorized data', async ({ context, page, baseURL }) => {
  const fixture = await installDirectoryFixtures(context, page, baseURL, { signedOut: true });
  await page.goto('/?page=patients');
  await expect(page.getByRole('heading', { name: 'Login to your account' })).toBeVisible();
  expect(fixture.collectionRequests('patients')).toHaveLength(0);
  await page.getByLabel('Email', { exact: true }).fill(users.a.email);
  await page.getByLabel('Password', { exact: true }).fill('synthetic-test-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
  await broadcastSession(page, 'TOKEN_REFRESHED', syntheticSession(users.a));
  await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
  expect(fixture.collectionRequests('patients')).toHaveLength(1);
  settled(fixture);
});

test('account switch clears directory and draft before next identity resolves', async ({ context, page, baseURL }) => {
  const fixture = await installDirectoryFixtures(context, page, baseURL);
  await page.goto('/?page=patients');
  await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
  await page.getByRole('button', { name: 'Add Client', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const gate = deferred();
  fixture.state.membershipGate = gate; fixture.state.current = 'b';
  try {
    await broadcastSession(page, 'SIGNED_IN', syntheticSession(users.b));
    await expect(row(page, directoryRows.patients[0].full_name)).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally { gate.resolve(); }
  await expect(page.getByRole('button', { name: 'Startup Beta Company CRM System' })).toBeVisible();
  await expect(row(page, directoryRows.patients[0].full_name)).toHaveCount(0);
  settled(fixture);
});

test('company switch and membership removal never retain former tenant rows', async ({ context, page, baseURL }) => {
  const fixture = await installDirectoryFixtures(context, page, baseURL, { stateOverrides: { multiOrg: true } });
  await page.clock.install();
  await page.goto('/?page=employees');
  await expect(row(page, directoryRows.employees[0].full_name)).toBeVisible();
  fixture.state.defaultOrg = 'b';
  await revalidateIdentity(page);
  await expect(page.getByRole('button', { name: 'Startup Beta Company CRM System' })).toBeVisible();
  await expect(row(page, directoryRows.employees[0].full_name)).toHaveCount(0);
  fixture.state.hasMembership = false;
  await revalidateIdentity(page);
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('account');
  await expect(row(page, directoryRows.employees[0].full_name)).toHaveCount(0);
  settled(fixture);
});

test('restricted disabled driver cannot read Patients directory', async ({ context, page, baseURL }) => {
  const fixture = await installDirectoryFixtures(context, page, baseURL, { stateOverrides: { role: 'driver', hasDriver: true, driverDisabled: true } });
  await page.goto('/?page=patients');
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('trips');
  expect(fixture.collectionRequests('patients')).toHaveLength(0);
  await expect(row(page, directoryRows.patients[0].full_name)).toHaveCount(0);
  settled(fixture);
});

test('induced render failure is recoverable by navigating to another directory', async ({ context, page, baseURL }) => {
  const fixture = await installDirectoryFixtures(context, page, baseURL);
  await page.route(/\/(?:assets\/patients-page-[^/]+\.js|src\/components\/patients-page\.tsx)(?:\?.*)?$/, route => route.fulfill({ contentType: 'application/javascript', body: 'export function PatientsPage(){throw new Error("Synthetic render failure SYNTHETIC_PRIVATE_DIAGNOSTIC_MARKER");}' }));
  await page.goto('/?page=patients');
  await expect(page.getByText('Page Error', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Drivers', exact: true }).click();
  await expect(row(page, directoryRows.drivers[0].full_name)).toBeVisible();
  await expect(page.getByText('Page Error', { exact: true })).toHaveCount(0);
  expect(fixture.errors.every(error => error.includes('Synthetic render failure'))).toBe(true);
  expect(fixture.consoleMessages.join('\n')).not.toContain('SYNTHETIC_PRIVATE_DIAGNOSTIC_MARKER');
  await expect(page.locator('body')).not.toContainText('SYNTHETIC_PRIVATE_DIAGNOSTIC_MARKER');
  expect(fixture.consoleErrors.some(message => message.includes('UI boundary diagnostic'))).toBe(true);
  expect(JSON.stringify(await fixture.captureDiagnostics())).not.toContain('SYNTHETIC_PRIVATE_DIAGNOSTIC_MARKER');
  expect(fixture.documents).toHaveLength(1);
});

test('induced chunk failure stays distinct and allows navigation without reload loop', async ({ context, page, baseURL }) => {
  const fixture = await installDirectoryFixtures(context, page, baseURL);
  let requests = 0;
  await page.route(/\/(?:assets\/patients-page-[^/]+\.js|src\/components\/patients-page\.tsx)(?:\?.*)?$/, route => { requests++; return route.abort('failed'); });
  await page.goto('/?page=dashboard');
  await page.getByRole('button', { name: 'Patients', exact: true }).click();
  await expect(page.getByText('This page could not load', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('This page could not load', { exact: true })).toBeVisible();
  expect(requests).toBeLessThanOrEqual(2);
  await page.getByRole('button', { name: 'Employees', exact: true }).click();
  await expect(row(page, directoryRows.employees[0].full_name)).toBeVisible();
  expect(fixture.documents).toHaveLength(1);
});

test('expired saved session refreshes once before Patients collection loads', async ({ context, page, baseURL }) => {
  const fixture = await installDirectoryFixtures(context, page, baseURL, { expired: true });
  await page.goto('/?page=patients');
  await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
  expect(fixture.state.requests.filter(request => request.table === 'token')).toHaveLength(1);
  expect(fixture.collectionRequests('patients')).toHaveLength(1);
  settled(fixture);
});

for (const directory of directories.filter(item => item.page !== 'employees')) {
  test(`${directory.page} successful cached totals survive failed background refresh`, async ({ context, page, baseURL }) => {
    const fixture = await installDirectoryFixtures(context, page, baseURL);
    await page.clock.install();
    await page.goto(`/?page=${directory.page}`);
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
    const text = directory.page === 'patients' ? 'Trips: 12' : '17 trips';
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    fixture.setCountsError(true);
    await revalidateIdentity(page);
    await expect(page.getByText('Showing saved trip totals. Refresh failed.', { exact: true })).toBeVisible();
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
    fixture.setCountsError(false);
    await page.getByRole('button', { name: 'Retry totals', exact: true }).click();
    await expect(page.getByText('Showing saved trip totals. Refresh failed.', { exact: true })).toHaveCount(0);
    settled(fixture);
  });
}

test('employee role keeps authorized Employees bookmark access', async ({ context, page, baseURL }) => {
  const fixture = await installDirectoryFixtures(context, page, baseURL, { stateOverrides: { role: 'employee' } });
  await page.goto('/?page=employees');
  await expect(row(page, directoryRows.employees[0].full_name)).toBeVisible();
  expect(new URL(page.url()).searchParams.get('page')).toBe('employees');
  expect(fixture.collectionRequests('employees')).toHaveLength(1);
  settled(fixture);
});

test('page boundary user retry recovers with sanitized diagnostic reference', async ({ context, page, baseURL }) => {
  const fixture = await installDirectoryFixtures(context, page, baseURL);
  await page.route(/\/(?:assets\/patients-page-[^/]+\.js|src\/components\/patients-page\.tsx)(?:\?.*)?$/, route => route.fulfill({ contentType: 'application/javascript', body: 'export function PatientsPage(){if(!window.__syntheticRenderRecovered) throw new Error("SYNTHETIC_PRIVATE_DIAGNOSTIC_MARKER"); return "Synthetic recovered page";}' }));
  await page.goto('/?page=patients');
  await expect(page.getByText('Page Error', { exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('SYNTHETIC_PRIVATE_DIAGNOSTIC_MARKER');
  expect(fixture.consoleMessages.join('\n')).not.toContain('SYNTHETIC_PRIVATE_DIAGNOSTIC_MARKER');
  expect(fixture.consoleErrors.some(message => message.includes('UI boundary diagnostic'))).toBe(true);
  expect(JSON.stringify(await fixture.captureDiagnostics())).not.toContain('SYNTHETIC_PRIVATE_DIAGNOSTIC_MARKER');
  await page.evaluate(() => { window.__syntheticRenderRecovered = true; });
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('Synthetic recovered page', { exact: true })).toBeVisible();
  await expect(page.getByText('Page Error', { exact: true })).toHaveCount(0);
  expect(fixture.documents).toHaveLength(1);
});

test('authorization failure on refresh removes cached Patients and an open private draft', async ({ context, page, baseURL }) => {
  const fixture = await installDirectoryFixtures(context, page, baseURL);
  await page.clock.install();
  await page.goto('/?page=patients');
  const name = directoryRows.patients[0].full_name;
  await expect(row(page, name)).toBeVisible();
  await card(page, name).locator('button[aria-haspopup="menu"]').click();
  await page.getByRole('menuitem', { name: 'Edit Client', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const readsBeforeDenial = fixture.collectionRequests('patients').length;
  fixture.setListError('patients', true, 403);
  await revalidateIdentity(page);
  await expect(page.getByRole('alert')).toContainText('Access to clients could not be verified.', { timeout: 2_000 });
  expect(fixture.collectionRequests('patients')).toHaveLength(readsBeforeDenial + 1);
  await expect(row(page, name)).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  settled(fixture);
});

test('deferred form can close while its module suspends and reopen after fulfillment', async ({ context, page, baseURL }) => {
  const fixture = await installDirectoryFixtures(context, page, baseURL);
  const formGate = deferred();
  await page.route(/\/(?:assets\/patient-form-[^/]+\.js|src\/components\/forms\/patient-form\.tsx)(?:\?.*)?$/, async route => { await formGate.promise; await route.continue(); });
  try {
    await page.goto('/?page=patients');
    await expect(row(page, directoryRows.patients[0].full_name)).toBeVisible();
    await page.getByRole('button', { name: 'Add Client', exact: true }).click();
    const pending = page.getByRole('dialog', { name: 'Loading form', exact: true });
    await expect(pending).toBeVisible();
    await pending.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    formGate.resolve();
    await page.getByRole('button', { name: 'Add Client', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Add New Patient', exact: true });
    await expect(form).toBeVisible();
    await expect(form.getByPlaceholder('John Smith', { exact: true })).toHaveValue('');
    await form.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    settled(fixture);
  } finally { formGate.resolve(); }
});

for (const role of ['employee', 'owner']) {
  test(`${role} Employees empty-state upload respects the existing admin-only action`, async ({ context, page, baseURL }) => {
    const fixture = await installDirectoryFixtures(context, page, baseURL, {
      stateOverrides: { role }, rows: { ...directoryRows, employees: [] },
    });
    await page.goto('/?page=employees');
    await expect(page.getByRole('heading', { name: 'No team members yet', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Upload employee data', exact: true }).click();
    await frames(page);
    if (role === 'owner') {
      await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('upload');
    } else {
      expect(new URL(page.url()).searchParams.get('page')).toBe('employees');
      await expect(page.getByRole('heading', { name: 'No team members yet', exact: true })).toBeVisible();
    }
    settled(fixture);
  });
}
