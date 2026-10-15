import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// Match tests/firefox-ui/run.mjs: isolate Firefox's macOS application-data lookup.
const firefoxAppData = process.platform === 'darwin'
  ? await mkdtemp(join(tmpdir(), 'meditrans-directories-firefox-')) : null;
try {
  const child = spawn(process.execPath, [join(root, 'node_modules/@playwright/test/cli.js'), 'test',
    '--config', 'playwright.directories.config.ts', '--project=firefox', ...process.argv.slice(2)], {
    cwd: root,
    env: firefoxAppData ? { ...process.env, CFFIXED_USER_HOME: firefoxAppData } : process.env,
    stdio: 'inherit',
  });
  process.exitCode = await new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('close', code => resolveExit(code ?? 1));
  });
} finally {
  if (firefoxAppData) {
    const cleanup = spawnSync('/bin/chmod', ['-RN', firefoxAppData], { stdio: 'pipe' });
    if (cleanup.status !== 0) console.warn(`Temporary Firefox ACL cleanup failed: ${firefoxAppData}`);
    await rm(firefoxAppData, { recursive: true, force: true });
  }
}
