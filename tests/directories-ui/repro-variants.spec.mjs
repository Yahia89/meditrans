import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { directoryRows, installDirectoryFixtures } from './fixtures.mjs';

const variants = [
  { name: 'empty real records', empty: true },
  { name: 'empty real records with saved list', empty: true, view: 'list' },
  { name: 'empty real records with demo enabled', empty: true, demo: true },
  { name: 'demo enabled alongside real records', demo: true },
  { name: 'invalid saved preference', view: 'grid' },
  { name: 'blocked preference storage', blockedPreferences: true },
  { name: 'duplicate supported limits', query: 'page=patients&limit=5&limit=10' },
  { name: 'duplicate malformed limits', query: 'page=patients&limit=foo&limit=bar' },
  { name: 'JSON-like page size', query: 'page=patients&limit=%5B5%2C10%5D&view=list' },
  { name: 'encoded infinity limit', query: 'page=patients&limit=Infinity&view=%7B%7D' },
  { name: 'empty limit value', query: 'page=patients&limit=&view=list' },
  { name: 'duplicate page key', query: 'page=patients&page=patients&limit=5' },
  { name: 'saved list with ISO date and direct reloads', view: 'list', query: 'page=patients&date=2026-10-02T05%3A00%3A00.000Z', reloads: 2 },
];
for (const variant of variants) {
  test(`Patients reproduction variant: ${variant.name}`, async ({ context, page, baseURL }, info) => {
    const fixture = await installDirectoryFixtures(context, page, baseURL, { rows: variant.empty ? { ...directoryRows, patients: [] } : directoryRows });
    await context.addInitScript(variant => {
      if (variant.view) localStorage.setItem('patients-view-mode', variant.view);
      if (variant.demo) {
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) { return set.call(this, key, key === 'onboarding:isDemoMode' ? 'true' : value); };
        localStorage.setItem('onboarding:isDemoMode', 'true');
      }
      if (variant.blockedPreferences) {
        const get = Storage.prototype.getItem;
        const set = Storage.prototype.setItem;
        Storage.prototype.getItem = function(key) { if (key === 'patients-view-mode' || key === 'onboarding:isDemoMode') throw new DOMException('Synthetic storage denied', 'SecurityError'); return get.call(this, key); };
        Storage.prototype.setItem = function(key, value) { if (key === 'patients-view-mode') throw new DOMException('Synthetic storage denied', 'SecurityError'); return set.call(this, key, value); };
      }
    }, variant);
    await page.goto(`/?${variant.query ?? 'page=patients'}`);
    await expect(page.getByRole('button', { name: 'Patients', exact: true })).toBeVisible();
    const awaitContent = async () => {
      if (variant.name.includes('duplicate page')) return;
      if (variant.empty && !variant.demo) await expect(page.getByText('No patients yet', { exact: true })).toBeVisible();
      else await expect(page.getByText(variant.empty ? 'John Smith' : directoryRows.patients[0].full_name, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
      await expect(page.getByTestId('directory-rows-skeleton')).toHaveCount(0);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    await awaitContent();
    for (let repeat = 0; repeat < (variant.reloads ?? 0); repeat++) {
      await page.reload();
      await awaitContent();
    }
    const search = page.getByPlaceholder('Search clients by name, email, or phone...');
    if (await search.count()) {
      await search.fill('Alpha');
      await search.fill('');
      if (variant.blockedPreferences) await page.getByRole('button', { name: 'List view', exact: true }).click();
    }
    await awaitContent();
    const diagnostics = await fixture.captureDiagnostics();
    await writeFile(info.outputPath('variant.json'), JSON.stringify({ synthetic: true, variant, url: page.url(), errors: fixture.errors, consoleErrors: fixture.consoleErrors, diagnostics,
      collectionReads: fixture.collectionRequests('patients').length, totalRequests: fixture.requests.length,
      documents: fixture.documents,
      body: await page.locator('main').first().innerText(),
    }, null, 2));
    expect(fixture.errors).toEqual([]);
    expect(fixture.consoleErrors).toEqual([]);
    await expect(page.getByText('Page Error', { exact: true })).toHaveCount(0);
    if (!variant.name.includes('duplicate page')) await expect(search).toBeVisible();
    expect(fixture.requests.length).toBeLessThan(100);
  });
}
