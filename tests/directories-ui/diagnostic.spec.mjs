// Optional bounded diagnostic against the untouched baseline dev server. This
// observes the original render-time setter without changing state or dependencies.
import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { broadcastSession, syntheticSession, users } from '../startup-ui/fixtures.mjs';
import { directoryRows, installDirectoryFixtures } from './fixtures.mjs';

test('baseline memo setter trace is bounded across mount, search and token refresh', async ({ context, page, baseURL }, info) => {
  test.skip(process.env.DIRECTORIES_DIAGNOSTIC !== '1', 'Opt-in baseline diagnostic only');
  const fixture = await installDirectoryFixtures(context, page, baseURL);
  await page.addInitScript(() => { window.__paginationMemoCalls = []; });
  let instrumentationCount = 0;
  await page.route(/\/src\/components\/patients-page\.tsx(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    const body = await response.text();
    const instrumented = body.replace(/useMemo\(\(\) => \{\s*setCurrentPage\(1\);\s*\}, \[searchQuery\]\);/, matched => {
      instrumentationCount++;
      return matched.replace('setCurrentPage(1);', 'window.__paginationMemoCalls.push({ at: performance.now(), stack: new Error("Observed original Patients pagination memo setter").stack }); setCurrentPage(1);');
    });
    await route.fulfill({ response, body: instrumented });
  });
  await page.goto('/?page=patients');
  await expect(page.getByRole('heading', { name: directoryRows.patients[0].full_name, exact: true })).toBeVisible();
  const phases = [{ phase: 'mounted', count: await page.evaluate(() => window.__paginationMemoCalls.length) }];
  await page.getByPlaceholder('Search clients by name, email, or phone...').fill('Alpha');
  await expect(page.getByRole('heading', { name: directoryRows.patients[1].full_name, exact: true })).toHaveCount(0);
  phases.push({ phase: 'searched', count: await page.evaluate(() => window.__paginationMemoCalls.length) });
  await broadcastSession(page, 'TOKEN_REFRESHED', syntheticSession(users.a));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  phases.push({ phase: 'session-refreshed', count: await page.evaluate(() => window.__paginationMemoCalls.length) });
  await page.getByPlaceholder('Search clients by name, email, or phone...').fill('');
  await expect(page.getByRole('heading', { name: directoryRows.patients[1].full_name, exact: true })).toBeVisible();
  phases.push({ phase: 'search-cleared', count: await page.evaluate(() => window.__paginationMemoCalls.length) });
  const evidence = { synthetic: true, instrumentation: 'Network response adds observation before unchanged setter; no state or dependency changes', instrumentationCount, phases,
    calls: await page.evaluate(() => window.__paginationMemoCalls), errors: fixture.errors, consoleErrors: fixture.consoleErrors };
  await writeFile(info.outputPath('original-memo-setter-trace.json'), JSON.stringify(evidence, null, 2));
  expect(instrumentationCount).toBe(1);
  expect(evidence.calls.length).toBeGreaterThan(0);
  expect(evidence.calls.length).toBeLessThan(15);
  expect(fixture.errors).toEqual([]);
  expect(fixture.consoleErrors).toEqual([]);
});
