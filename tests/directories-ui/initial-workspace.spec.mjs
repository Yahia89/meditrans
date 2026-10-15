import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { deferred } from '../startup-ui/fixtures.mjs';
import { directoryRows, installDirectoryFixtures } from './fixtures.mjs';

test('initial workspace code keeps a visible status after identity resolves', async ({ context, page, baseURL }, testInfo) => {
  const workspaceGate = deferred();
  const membershipGate = deferred();
  const fixture = await installDirectoryFixtures(context, page, baseURL, { stateOverrides: { membershipGate } });
  const blockedModules = [];
  await page.route(/\/(?:assets\/routes-[^/]+\.js|src\/routes\/index\.tsx\?tsr-split=component)(?:\?.*)?$/, async route => {
    blockedModules.push(new URL(route.request().url()).pathname);
    await workspaceGate.promise;
    return route.continue();
  });
  await page.addInitScript(() => {
    const samples = [];
    window.__initialWorkspaceFrames = samples;
    const sample = () => {
      const root = document.getElementById('root');
      if (samples.length < 1200) samples.push({ at: performance.now(), content: Boolean(root?.innerText.trim()),
        authLoading: root?.innerText.trim() === 'Loading...',
        workspacePending: root?.innerText.includes('Opening workspace') ?? false,
        shell: Boolean(document.querySelector('[data-sidebar="sidebar"]')),
      });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  try {
    await page.goto('/?page=patients', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Loading...', { exact: true })).toBeVisible();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    membershipGate.resolve();
    await expect.poll(() => blockedModules.length).toBeGreaterThan(0);
    await expect(page.getByText('Opening workspace…', { exact: true })).toBeVisible();
    // The gate, rather than a timed network sleep, keeps this phase reproducible.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const pendingFrames = await page.evaluate(() => window.__initialWorkspaceFrames);
    workspaceGate.resolve();
    await expect(page.getByRole('heading', { name: directoryRows.patients[0].full_name, exact: true })).toBeVisible();
    const firstContent = pendingFrames.findIndex(frame => frame.authLoading);
    const relevant = pendingFrames.slice(firstContent);
    const blankFrames = relevant.filter(frame => !frame.content);
    const result = { synthetic: true, blockedModules, pendingFrames: relevant, blankFrames,
      blankSpanMs: blankFrames.length ? blankFrames.at(-1).at - blankFrames[0].at : 0,
      documents: fixture.documents, chunks: fixture.chunks, errors: fixture.errors };
    await writeFile(testInfo.outputPath('initial-workspace.json'), JSON.stringify(result, null, 2));
    await testInfo.attach('initial-workspace', { body: JSON.stringify(result), contentType: 'application/json' });
    expect(firstContent).toBeGreaterThanOrEqual(0);
    expect(blankFrames, 'Identity loading must hand off directly to a visible workspace status').toEqual([]);
    expect(fixture.documents).toHaveLength(1);
    expect(fixture.errors).toEqual([]);
  } finally {
    membershipGate.resolve();
    workspaceGate.resolve();
  }
});
