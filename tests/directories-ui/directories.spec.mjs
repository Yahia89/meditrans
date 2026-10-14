import { expect, test } from '@playwright/test';
import { deferred } from '../startup-ui/fixtures.mjs';
import { directoryRows, installDirectoryFixtures, tripCounts } from './fixtures.mjs';

const directories = [
  { page: 'patients', sidebar: 'Patients', search: 'Search clients by name, email, or phone...',
    add: 'Add Client', edit: 'Edit Client', createTitle: 'Add New Patient', editTitle: 'Edit Patient', namePlaceholder: 'John Smith', form: 'patient-form' },
  { page: 'drivers', sidebar: 'Drivers', search: 'Search drivers by name, email, phone or license plate...',
    add: 'Add Driver', edit: 'Edit Driver', createTitle: 'Add New Driver', editTitle: 'Edit Driver', namePlaceholder: 'Michael Chen', form: 'driver-form' },
  { page: 'employees', sidebar: 'Employees', search: 'Search employees by name, email, department or position...',
    add: 'Add Employee', edit: 'Edit Employee', createTitle: 'Add New Employee', editTitle: 'Edit Employee', namePlaceholder: 'Sarah Johnson', form: 'employee-form' },
];

const formChunks = chunks => chunks.filter(chunk => /\/(patient-form|driver-form|employee-form)-/.test(chunk));
const card = (page, name) => page.locator('div.rounded-2xl').filter({ has: page.getByRole('heading', { name, exact: true }) });
const tripsText = (directory, count) => directory.page === 'patients' ? `Trips: ${count}` : `${count} trips`;

test('all directories render and search, then reuse their collection reads on immediate revisits', async ({ context, page, baseURL }) => {
  const fixture = await installDirectoryFixtures(context, page, baseURL);
  await page.goto('/?page=patients&limit=5&filter=retained#directory-check');
  for (const directory of directories) {
    if (directory.page !== 'patients') await page.getByRole('button', { name: directory.sidebar, exact: true }).click();
    const [alpha, beta] = directoryRows[directory.page];
    await expect(page.getByRole('heading', { name: alpha.full_name, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: beta.full_name, exact: true })).toBeVisible();
    await page.getByPlaceholder(directory.search).fill('Alpha');
    await expect(page.getByRole('heading', { name: alpha.full_name, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: beta.full_name, exact: true })).toHaveCount(0);
    await page.getByPlaceholder(directory.search).fill('');
    await expect(page.getByRole('heading', { name: beta.full_name, exact: true })).toBeVisible();
    expect(fixture.collectionRequests(directory.page)).toHaveLength(1);
    expect(fixture.collectionRequests(directory.page)[0].search.get('select')).toBe('*');
    expect(formChunks(fixture.chunks)).toHaveLength(0);
  }

  for (const directory of directories) {
    await page.getByRole('button', { name: directory.sidebar, exact: true }).click();
    await expect(page.getByRole('heading', { name: directoryRows[directory.page][0].full_name, exact: true })).toBeVisible();
    const location = new URL(page.url());
    expect(location.searchParams.get('page')).toBe(directory.page);
    expect(location.searchParams.get('limit')).toBe('5');
    expect(location.searchParams.get('filter')).toBe('retained');
    expect(location.hash).toBe('#directory-check');
  }
  await page.goBack();
  await expect(page.getByRole('heading', { name: directoryRows.drivers[0].full_name, exact: true })).toBeVisible();
  for (const directory of directories) expect(fixture.collectionRequests(directory.page)).toHaveLength(1);
  for (const directory of ['patients', 'drivers']) {
    expect(fixture.requests.filter(request => request.table === 'directory_trip_counts'
      && request.body?.p_directory === directory)).toHaveLength(1);
  }
  expect(fixture.documents).toHaveLength(1);
  expect(fixture.errors).toEqual([]);
});

for (const directory of directories.filter(directory => directory.page !== 'employees')) {
  test(`${directory.page} render and search while trip totals wait, then show real counts and zero`, async ({ context, page, baseURL }) => {
    const countsGate = deferred();
    const fixture = await installDirectoryFixtures(context, page, baseURL, { countsGate });
    const [alpha, beta] = directoryRows[directory.page];
    try {
      await page.goto(`/?page=${directory.page}`);
      await expect(page.getByRole('heading', { name: alpha.full_name, exact: true })).toBeVisible();
      await expect(page.getByText('Trip totals are loading…', { exact: true })).toBeVisible();
      await expect(card(page, alpha.full_name).getByText(tripsText(directory, '…'), { exact: true })).toBeVisible();
      await expect(card(page, beta.full_name).getByText(tripsText(directory, '…'), { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
      await page.screenshot({ path: test.info().outputPath(`${directory.page}-counts-pending.png`), fullPage: true });
      await page.getByPlaceholder(directory.search).fill('Alpha');
      await expect(page.getByRole('heading', { name: alpha.full_name, exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: beta.full_name, exact: true })).toHaveCount(0);
      await page.getByPlaceholder(directory.search).fill('');
      countsGate.resolve();
      await expect(card(page, alpha.full_name).getByText(tripsText(directory, tripCounts[directory.page]), { exact: true })).toBeVisible();
      await expect(card(page, beta.full_name).getByText(tripsText(directory, 0), { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
      await page.screenshot({ path: test.info().outputPath(`${directory.page}-counts-loaded.png`), fullPage: true });
      expect(fixture.collectionRequests(directory.page)).toHaveLength(1);
      expect(fixture.errors).toEqual([]);
    } finally {
      countsGate.resolve();
    }
  });

  test(`${directory.page} count failure preserves records and prevents inaccurate exports until retry succeeds`, async ({ context, page, baseURL }) => {
    const fixture = await installDirectoryFixtures(context, page, baseURL, { countsError: true });
    const [alpha, beta] = directoryRows[directory.page];
    await page.goto(`/?page=${directory.page}`);
    await expect(page.getByRole('heading', { name: alpha.full_name, exact: true })).toBeVisible();
    await expect(page.getByText('Trip totals could not be loaded.', { exact: true })).toBeVisible();
    await expect(card(page, alpha.full_name).getByText(tripsText(directory, '—'), { exact: true })).toBeVisible();
    await expect(card(page, beta.full_name).getByText(tripsText(directory, '—'), { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
    fixture.setCountsError(false);
    await page.getByRole('button', { name: 'Retry totals', exact: true }).click();
    await expect(card(page, alpha.full_name).getByText(tripsText(directory, tripCounts[directory.page]), { exact: true })).toBeVisible();
    await expect(card(page, beta.full_name).getByText(tripsText(directory, 0), { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
    expect(fixture.collectionRequests(directory.page)).toHaveLength(1);
    expect(fixture.errors).toEqual([]);
  });
}

test('employees remain usable while presence is pending and enrich by linked user without extra directory reads', async ({ context, page, baseURL }) => {
  const presenceGate = deferred();
  const fixture = await installDirectoryFixtures(context, page, baseURL, { presenceGate });
  try {
    await page.goto('/?page=employees');
    const alpha = directoryRows.employees[0];
    await expect(page.getByRole('heading', { name: alpha.full_name, exact: true })).toBeVisible();
    await expect.poll(() => fixture.collectionRequests('organization_memberships').length).toBe(1);
    await page.getByPlaceholder(directories[2].search).fill('Alpha');
    await expect(page.getByRole('heading', { name: alpha.full_name, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: directoryRows.employees[1].full_name, exact: true })).toHaveCount(0);
    presenceGate.resolve();
    await expect(card(page, alpha.full_name).getByTitle('Online', { exact: true })).toBeVisible();
    await page.getByPlaceholder(directories[2].search).fill('');
    await page.screenshot({ path: test.info().outputPath('employees-presence-loaded.png'), fullPage: true });
    expect(fixture.collectionRequests('employees')).toHaveLength(1);
    expect(fixture.requests.filter(request => request.table === 'org_invites'
      && request.search.get('accepted_at') === 'not.is.null')).toHaveLength(0);
    expect(fixture.requests.filter(request => request.table === 'user_profiles'
      && request.search.get('user_id')?.startsWith('in.'))).toHaveLength(0);
    expect(formChunks(fixture.chunks)).toHaveLength(0);
    expect(fixture.errors).toEqual([]);
  } finally {
    presenceGate.resolve();
  }
});

for (const directory of directories) {
  test(`${directory.page} defer the form until editing and reset it when creating`, async ({ context, page, baseURL }) => {
    const fixture = await installDirectoryFixtures(context, page, baseURL);
    const name = directoryRows[directory.page][0].full_name;
    await page.goto(`/?page=${directory.page}`);
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    expect(formChunks(fixture.chunks)).toHaveLength(0);
    // The existing card action trigger has no label, but its menu semantics are stable.
    await card(page, name).locator('button[aria-haspopup="menu"]').click();
    await page.getByRole('menuitem', { name: directory.edit, exact: true }).click();
    const editDialog = page.getByRole('dialog', { name: directory.editTitle, exact: true });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByPlaceholder(directory.namePlaceholder, { exact: true })).toHaveValue(name);
    expect(formChunks(fixture.chunks).filter(chunk => chunk.includes(`/${directory.form}-`))).toHaveLength(1);
    await editDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: directory.add, exact: true }).click();
    const addDialog = page.getByRole('dialog', { name: directory.createTitle, exact: true });
    await expect(addDialog).toBeVisible();
    await expect(addDialog.getByPlaceholder(directory.namePlaceholder, { exact: true })).toHaveValue('');
    await addDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(formChunks(fixture.chunks).filter(chunk => chunk.includes(`/${directory.form}-`))).toHaveLength(1);
    expect(fixture.requests.filter(request => ['POST', 'PATCH', 'DELETE'].includes(request.method)
      && !request.path.includes('/rpc/'))).toHaveLength(0);
    expect(fixture.errors).toEqual([]);
  });
}
