// Firefox's separate macOS app-data lookup can reach a TCC-protected personal
// browser directory despite Playwright supplying a disposable -profile.
// https://github.com/microsoft/playwright/issues/42768
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const suites = process.argv.slice(2);
if (!suites.length) suites.push('startup', 'dashboard', 'router');
if (suites.some(suite => !['startup', 'dashboard', 'router'].includes(suite))) {
  throw new Error('Supported suites: startup dashboard router');
}
const firefoxAppData = process.platform === 'darwin'
  ? await mkdtemp(join(tmpdir(), 'meditrans-firefox-app-data-')) : null;
const environment = firefoxAppData
  ? { ...process.env, CFFIXED_USER_HOME: firefoxAppData } : process.env;
let failed = false;
try {
  for (const suite of suites) {
    const logPath = join(tmpdir(), `meditrans-firefox-${suite}.log`);
    const log = createWriteStream(logPath);
    const args = [join(root, 'node_modules/@playwright/test/cli.js'), 'test',
      '--config', `playwright.${suite}.config.ts`, '--project', 'firefox'];
    console.log(`Running Firefox ${suite}; output: ${logPath}`);
    const child = spawn(process.execPath, args, { cwd: root, env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
      process.stdout.write(chunk);
      log.write(chunk);
    });
    const exitCode = await new Promise((resolveExit, reject) => {
      child.once('error', reject);
      child.once('close', code => resolveExit(code ?? 1));
    });
    await new Promise(resolveLog => log.end(resolveLog));
    if (exitCode !== 0) failed = true;
  }
} finally {
  if (firefoxAppData) {
    // macOS creates deny-delete ACLs in this newly created fake home. Remove
    // only those disposable-tree ACLs; never change a real browser/home folder.
    const cleanup = spawnSync('/bin/chmod', ['-RN', firefoxAppData], { stdio: 'pipe' });
    if (cleanup.status !== 0) console.warn(`Temporary Firefox ACL cleanup failed: ${firefoxAppData}`);
    await rm(firefoxAppData, { recursive: true, force: true });
  }
}
process.exitCode = failed ? 1 : 0;
