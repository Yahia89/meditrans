// JS import graphs from production builds made with `vite build --manifest`.
// Usage: node scripts/measure-startup-bundles.mjs <build-directory>
// gzip is a reproducible local estimate, not a hosted transfer measurement.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const directory = process.argv[2];
if (!directory) throw new Error('Provide a production build directory with a manifest.');
const manifest = JSON.parse(readFileSync(resolve(directory, '.vite/manifest.json'), 'utf8'));
const keys = Object.keys(manifest);
function graph(entries) {
  const visited = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    if (!manifest[key]) throw new Error(`Missing manifest entry: ${key}`);
    visited.add(key);
    for (const dependency of manifest[key].imports || []) visit(dependency);
  }
  entries.forEach(visit);
  const chunks = [...visited].map(key => {
    const file = manifest[key].file;
    const bytes = readFileSync(resolve(directory, file));
    return { file, decoded: bytes.length, gzip: gzipSync(bytes).length };
  }).filter(chunk => /\.m?js$/.test(chunk.file));
  return {
    decoded: chunks.reduce((sum, chunk) => sum + chunk.decoded, 0),
    gzip: chunks.reduce((sum, chunk) => sum + chunk.gzip, 0),
    chunks,
  };
}
// The Router's split index component and WorkspacePage are needed by every
// workspace page. Include them rather than comparing only the tiny HTML entry.
const workspace = keys.filter(key => key.includes('router/WorkspacePage') ||
  (key.includes('routes/index') && key.includes('tsr-split=component')));
const shell = ['index.html', ...workspace];
const dashboardEntry = manifest['src/components/dashboard.tsx'] ? 'src/components/dashboard.tsx' :
  keys.find(key => manifest[key].name === 'dashboard');
if (!dashboardEntry) throw new Error('Missing dashboard module or named chunk.');
const dashboard = [...shell, dashboardEntry];
const chart = [...dashboard, 'src/components/dashboard/PerformanceChartPlot.tsx'];
console.log(JSON.stringify({ shell: graph(shell), dashboard: graph(dashboard), chart: graph(chart) }, null, 2));
